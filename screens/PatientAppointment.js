import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTranslation } from "react-i18next";
import * as Speech from "expo-speech";
import {
  getFirestore,
  collection,
  where,
  query,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import AnimatedModal from "../components/AnimatedModal";

// Utility for deterministic chat ID (always order alphabetically)
const getChatId = (a, b) => [a, b].sort().join("_");

// Ensure the chat exists before navigation (awaits chat creation)
const ensureChatExists = async (firestore, chatId, uid1, uid2) => {
  const chatRef = doc(firestore, "chats", chatId);
  const chatDoc = await getDoc(chatRef);
  if (!chatDoc.exists()) {
    await setDoc(chatRef, {
      chatId,
      participants: [uid1, uid2],
      status: "active",
      createdAt: serverTimestamp(),
      lastMessage: "",
      lastMessageTime: serverTimestamp(),
    });
  }
};

const isFutureDateTime = (dateStr, timeStr) => {
  // Expects: dateStr "2025-06-06", timeStr "02:03:00"
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute, second] = timeStr.split(":").map(Number);
  const apptDate = new Date(year, month - 1, day, hour, minute, second);
  return apptDate.getTime() > Date.now();
};

const PatientAppointments = ({ navigation }) => {
  const { t } = useTranslation();
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  const [appointments, setAppointments] = useState([]);
  const [healthworkerCache, setHealthworkerCache] = useState({});
  const [modal, setModal] = useState({
    visible: false,
    message: "",
    type: "success",
  });

  const firestore = getFirestore();
  const auth = getAuth();

  const speak = (msg) => {
    Speech.speak(msg, {
      language: t("lang_code") === "yo" ? "yo" : "en-US",
      pitch: 1,
      rate: 1,
    });
  };

  // Fetch doctors on mount
  useEffect(() => {
    speak(t("schedule_appointment"));
    fetchDoctors();
  }, []);

  // Subscribe to actionable appointments on mount and on auth state change
  useEffect(() => {
    let unsub = () => {};
    const setup = () => {
      if (!auth.currentUser) return;
      const q = query(
        collection(firestore, "appointments"),
        where("patientId", "==", auth.currentUser.uid),
        orderBy("createdAt", "desc")
      );
      unsub = onSnapshot(
        q,
        async (snapshot) => {
          let data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          // Only actionable appointments: pending AND future date/time
          data = data.filter(
            (appt) =>
              appt.status === "pending" &&
              appt.date &&
              appt.time &&
              isFutureDateTime(appt.date, appt.time)
          );
          setAppointments(data);

          // Cache healthworkers for the list
          const uniqueHWIds = Array.from(
            new Set(data.map((a) => a.healthworkerId))
          );
          const uncachedIds = uniqueHWIds.filter(
            (id) => !(id in healthworkerCache)
          );
          if (uncachedIds.length > 0) {
            const fetches = uncachedIds.map((id) =>
              getDoc(doc(firestore, "users", id))
            );
            const docs = await Promise.all(fetches);
            const newCache = { ...healthworkerCache };
            docs.forEach((d) => {
              if (d.exists()) newCache[d.id] = d.data();
            });
            setHealthworkerCache(newCache);
          }
        },
        (error) => {
          setAppointments([]);
          showModal(t("fetch_appointments_failed"), "error");
          speak(t("fetch_appointments_failed"));
        }
      );
    };
    // Subscribe only if logged in
    if (auth.currentUser) setup();
    return () => unsub && unsub();
    // eslint-disable-next-line
  }, [auth.currentUser]);

  // Fetch only verified healthworkers for booking
  const fetchDoctors = async () => {
    try {
      const q = query(
        collection(firestore, "users"),
        where("role", "==", "healthworker"),
        where("verified", "==", true)
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDoctors(list);

      // For caching healthworker details by uid
      const cache = {};
      list.forEach((hw) => {
        cache[hw.id] = hw;
      });
      setHealthworkerCache((prev) => ({ ...prev, ...cache }));
    } catch (error) {
      showModal(t("fetch_doctors_failed"), "error");
      speak(t("fetch_doctors_failed"));
    }
  };

  // Show modal
  const showModal = (message, type = "success") => {
    setModal({ visible: true, message, type });
  };

  // Book a new appointment
  const confirmAppointment = async () => {
    const user = auth.currentUser;
    if (!user) {
      showModal(t("login_required"), "error");
      speak(t("login_required"));
      return;
    }
    if (!selectedDoctor) {
      showModal(t("select_doctor"), "error");
      speak(t("select_doctor"));
      return;
    }
    try {
      await addDoc(collection(firestore, "appointments"), {
        patientId: user.uid,
        healthworkerId: selectedDoctor.id,
        date: date.toISOString().split("T")[0],
        time: time.toTimeString().split(" ")[0],
        status: "pending",
        createdAt: serverTimestamp(),
      });
      showModal(t("appointment_booked"), "success");
      speak(t("appointment_booked"));
    } catch (error) {
      showModal(t("appointment_failed"), "error");
      speak(t("appointment_failed"));
    }
  };

  // Patient accepts an appointment
  const acceptAppointment = async (appointment) => {
    try {
      await updateDoc(doc(firestore, "appointments", appointment.id), {
        status: "accepted",
        respondedAt: serverTimestamp(),
      });
      showModal(t("appointment_accepted"), "success");
      speak(t("appointment_accepted"));
      // Optionally, you could immediately remove it from UI by filtering, but useEffect handles that on the next snapshot.
      // Optionally, navigate to chat:
      const chatId = getChatId(
        appointment.patientId,
        appointment.healthworkerId
      );
      await ensureChatExists(
        firestore,
        chatId,
        appointment.patientId,
        appointment.healthworkerId
      );
      navigation.navigate("ChatWithHealthWorker", {
        chatId,
        patientId: appointment.patientId,
        healthworkerId: appointment.healthworkerId,
        patientName: auth.currentUser.displayName || "No Name",
        healthworkerName:
          healthworkerCache[appointment.healthworkerId]?.name || "No Name",
        otherUserProfile: healthworkerCache[appointment.healthworkerId] || {},
      });
    } catch (err) {
      showModal(t("appointment_accept_failed"), "error");
      speak(t("appointment_accept_failed"));
    }
  };

  // Patient rejects an appointment
  const rejectAppointment = async (appointment) => {
    try {
      await updateDoc(doc(firestore, "appointments", appointment.id), {
        status: "rejected",
        respondedAt: serverTimestamp(),
      });
      showModal(t("appointment_rejected"), "success");
      speak(t("appointment_rejected"));
    } catch (err) {
      showModal(t("appointment_reject_failed"), "error");
      speak(t("appointment_reject_failed"));
    }
  };

  // UI for booking doctor
  const renderDoctorItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.doctorButton,
        selectedDoctor?.id === item.id && styles.selectedDoctor,
      ]}
      onPress={() => setSelectedDoctor(item)}
    >
      <Text style={styles.doctorText}>{item.name || "No Name"}</Text>
      {item.specialization ? (
        <Text style={styles.specialtyText}>{item.specialization}</Text>
      ) : null}
    </TouchableOpacity>
  );

  // UI for each appointment row
  const renderAppointmentItem = ({ item }) => {
    const healthworker = healthworkerCache[item.healthworkerId] || {};
    return (
      <View style={styles.appointmentRow}>
        <Text style={styles.appointmentText}>
          <Text style={{ fontWeight: "bold" }}>{t("with_healthworker")}:</Text>{" "}
          {healthworker.name || "Healthworker"} {"\n"}
          <Text style={{ fontWeight: "bold" }}>{t("date")}:</Text> {item.date}{" "}
          {"  "}
          <Text style={{ fontWeight: "bold" }}>{t("time")}:</Text> {item.time}{" "}
          {"\n"}
          <Text style={{ fontWeight: "bold" }}>{t("status")}:</Text>{" "}
          {t(item.status)}
        </Text>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.accept]}
            onPress={() => acceptAppointment(item)}
          >
            <Text style={styles.actionText}>{t("accept")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.reject]}
            onPress={() => rejectAppointment(item)}
          >
            <Text style={styles.actionText}>{t("reject")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Book section is separated, below the FlatList
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>{t("your_appointments")}</Text>
      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        renderItem={renderAppointmentItem}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t("no_appointments")}</Text>
        }
        contentContainerStyle={{ flexGrow: 1 }}
        style={{ width: "100%", marginBottom: 20 }}
      />
      {/* Book new appointment UI */}
      <View style={styles.bookingSection}>
        <Text style={styles.header}>{t("book_new_appointment")}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.buttonText}>
            {t("pick_date")}: {date.toDateString()}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) setDate(selectedDate);
            }}
          />
        )}

        <TouchableOpacity
          style={styles.button}
          onPress={() => setShowTimePicker(true)}
        >
          <Text style={styles.buttonText}>
            {t("pick_time")}: {time.toLocaleTimeString()}
          </Text>
        </TouchableOpacity>
        {showTimePicker && (
          <DateTimePicker
            value={time}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(event, selectedTime) => {
              setShowTimePicker(false);
              if (selectedTime) setTime(selectedTime);
            }}
          />
        )}

        <Text style={styles.header}>{t("select_doctor")}</Text>
        <FlatList
          data={doctors}
          keyExtractor={(item) => item.id}
          renderItem={renderDoctorItem}
          style={{ width: "100%" }}
          contentContainerStyle={{ paddingBottom: 10 }}
        />

        <TouchableOpacity
          style={styles.confirmButton}
          onPress={confirmAppointment}
        >
          <Text style={styles.confirmText}>{t("confirm_appointment")}</Text>
        </TouchableOpacity>
      </View>
      <AnimatedModal
        visible={modal.visible}
        message={modal.message}
        type={modal.type}
        onClose={() => setModal({ ...modal, visible: false })}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8F5E9",
    padding: 20,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  header: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#00796b",
    textAlign: "left",
    width: "100%",
  },
  button: {
    backgroundColor: "#00796b",
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    width: "100%",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
  },
  doctorButton: {
    backgroundColor: "#00897b",
    padding: 12,
    borderRadius: 8,
    marginVertical: 5,
    width: "100%",
    alignItems: "center",
  },
  selectedDoctor: {
    backgroundColor: "#004D40",
  },
  doctorText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  specialtyText: {
    color: "#B2DFDB",
    fontSize: 14,
    marginTop: 2,
    fontStyle: "italic",
  },
  confirmButton: {
    backgroundColor: "#004D40",
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    width: "100%",
  },
  confirmText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    fontWeight: "bold",
  },
  appointmentRow: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginVertical: 6,
    padding: 16,
    elevation: 2,
    shadowColor: "#888",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    width: "100%",
  },
  appointmentText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  actionButton: {
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 15,
    marginLeft: 10,
  },
  accept: {
    backgroundColor: "#43A047",
  },
  reject: {
    backgroundColor: "#E53935",
  },
  actionText: {
    color: "white",
    fontWeight: "bold",
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    fontSize: 16,
    marginVertical: 20,
    width: "100%",
  },
  bookingSection: {
    width: "100%",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: "#e0e0e0",
  },
});

export default PatientAppointments;
