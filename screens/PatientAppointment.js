// PatientAppointments.js

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTranslation } from "react-i18next";
import * as Speech from "expo-speech";
import * as Notifications from "expo-notifications";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import AnimatedModal from "../components/AnimatedModal";

// ensure notifications show
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// deterministic chatId
const getChatId = (a, b) => [a, b].sort().join("_");

// create chat doc if needed
const ensureChatExists = async (firestore, chatId, uid1, uid2) => {
  const ref = doc(firestore, "chats", chatId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      chatId,
      participants: [uid1, uid2],
      status: "active",
      createdAt: serverTimestamp(),
      lastMessage: "",
      lastMessageTime: serverTimestamp(),
    });
  }
};

// helper: is future?
const isFuture = (dateStr, timeStr) => {
  const [Y, M, D] = dateStr.split("-").map(Number);
  const [h, m, s] = timeStr.split(":").map(Number);
  return new Date(Y, M - 1, D, h, m, s).getTime() > Date.now();
};

export default function PatientAppointments({ navigation }) {
  const { t } = useTranslation();
  const auth = getAuth();
  const firestore = getFirestore();
  const user = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [hwCache, setHwCache] = useState({});

  // booking form
  const [showSchedule, setShowSchedule] = useState(false);
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  // modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState("success");

  // unsubscribe ref
  const unsubRef = useRef(null);

  // TTS + modal helper
  const speak = (msg) => {
    Speech.speak(msg, {
      language: t("lang_code") === "yo" ? "yo" : "en-US",
      pitch: 1,
      rate: 1,
    });
  };
  const showModal = (message, type = "success") => {
    setModalMessage(message);
    setModalType(type);
    setModalVisible(true);
    speak(message);
  };

  // Fetch list of verified doctors once
  useEffect(() => {
    (async () => {
      try {
        const q = query(
          collection(firestore, "users"),
          where("role", "==", "healthworker"),
          where("verified", "==", true)
        );
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setDoctors(list);
        // cache
        const cache = {};
        list.forEach((hw) => (cache[hw.id] = hw));
        setHwCache(cache);
      } catch {
        showModal("Failed to load doctors", "error");
      }
    })();
  }, [firestore]);

  // Subscribe to this patient's appointments, filter out rejected/past
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(firestore, "appointments"),
      where("patientId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    unsubRef.current = onSnapshot(
      q,
      (snap) => {
        const apps = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter(
            (a) =>
              a.status !== "rejected" &&
              a.date &&
              a.time &&
              isFuture(a.date, a.time)
          );

        setAppointments(apps);

        // cache any new healthworkers
        const ids = Array.from(
          new Set(apps.map((a) => a.healthworkerId).filter(Boolean))
        );
        ids.forEach(async (hwId) => {
          if (!hwCache[hwId]) {
            const docSnap = await getDoc(doc(firestore, "users", hwId));
            if (docSnap.exists()) {
              setHwCache((prev) => ({
                ...prev,
                [hwId]: docSnap.data(),
              }));
            }
          }
        });

        // notify on new incoming
        snap.docChanges().forEach((ch) => {
          const data = ch.doc.data();
          if (
            ch.type === "added" &&
            data.status === "scheduled_by_healthworker" &&
            isFuture(data.date, data.time)
          ) {
            const hw = hwCache[data.healthworkerId] || {};
            Notifications.scheduleNotificationAsync({
              content: {
                title: "New Appointment",
                body: `${hw.name || "Doctor"} scheduled ${data.date} @ ${
                  data.time
                }`,
              },
              trigger: null,
            });
            speak(`New appointment from Dr. ${hw.name || "doctor"}`);
          }
          if (ch.type === "modified") {
            const hw = hwCache[data.healthworkerId] || {};
            if (data.status === "approved") {
              const msg = `Appointment approved by Dr. ${hw.name}`;
              speak(msg);
              Notifications.scheduleNotificationAsync({
                content: { title: "Approved", body: msg },
                trigger: null,
              });
            }
            if (data.status === "rejected") {
              const msg = `Appointment rejected by Dr. ${hw.name}`;
              speak(msg);
              Notifications.scheduleNotificationAsync({
                content: { title: "Rejected", body: msg },
                trigger: null,
              });
            }
          }
        });

        setLoading(false);
      },
      (err) => {
        console.error(err);
        showModal("Failed to load appointments", "error");
        setLoading(false);
      }
    );

    return () => unsubRef.current && unsubRef.current();
  }, [firestore, user, hwCache]);

  // Booking
  const confirmAppointment = async () => {
    if (!user) {
      showModal("Please log in", "error");
      return;
    }
    if (!selectedDoctor) {
      showModal("Select a doctor", "error");
      return;
    }
    try {
      await addDoc(collection(firestore, "appointments"), {
        patientId: user.uid,
        healthworkerId: selectedDoctor.id,
        date: date.toISOString().split("T")[0],
        time: time.toTimeString().split(" ")[0],
        status: "scheduled_by_patient",
        createdAt: serverTimestamp(),
      });
      showModal("Appointment requested", "success");
    } catch {
      showModal("Booking failed", "error");
    }
  };

  // Patient responds to doctor‐scheduled
  const handleResponse = async (appt, decision) => {
    const hw = hwCache[appt.healthworkerId] || {};
    const doctorName = hw.name || "Doctor";
    try {
      await updateDoc(doc(firestore, "appointments", appt.id), {
        status: decision,
        respondedAt: serverTimestamp(),
      });
      showModal(
        decision === "approved"
          ? `Appointment accepted with Dr. ${doctorName}`
          : `Appointment rejected with Dr. ${doctorName}`,
        "success"
      );
      if (decision === "approved") {
        const chatId = getChatId(user.uid, appt.healthworkerId);
        await ensureChatExists(
          firestore,
          chatId,
          user.uid,
          appt.healthworkerId
        );
        navigation.navigate("ChatWithHealthWorker", {
          chatId,
          patientId: user.uid,
          healthworkerId: appt.healthworkerId,
        });
      }
    } catch {
      showModal("Operation failed", "error");
    }
  };

  // Render each appointment
  const renderItem = ({ item }) => {
    const hw = hwCache[item.healthworkerId] || {};
    const incoming = item.status === "scheduled_by_healthworker";
    const outgoing = item.status === "scheduled_by_patient";
    const bg =
      item.status === "scheduled_by_healthworker"
        ? "#FFF3E0"
        : item.status === "scheduled_by_patient"
        ? "#E3F2FD"
        : item.status === "approved"
        ? "#C8E6C9"
        : "#FFF";

    return (
      <View style={[styles.card, { backgroundColor: bg }]}>
        <Text style={styles.cardText}>
          {t("with_doctor")}: Dr. {hw.name || "—"}
          {"\n"}
          {t("date")}: {item.date} {t("time")}: {item.time}
          {"\n"}
          <Text style={{ fontStyle: "italic" }}>{t(item.status)}</Text>
        </Text>

        {incoming && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.btn, styles.accept]}
              onPress={() => handleResponse(item, "approved")}
            >
              <Text style={styles.btnText}>{t("accept")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.reject]}
              onPress={() => handleResponse(item, "rejected")}
            >
              <Text style={styles.btnText}>{t("reject")}</Text>
            </TouchableOpacity>
          </View>
        )}
        {outgoing && (
          <Text style={styles.pending}>{t("pending_doctor_response")}</Text>
        )}
      </View>
    );
  };

  // Render doctor list for booking
  const renderDoctor = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.docItem,
        selectedDoctor?.id === item.id && styles.docSelected,
      ]}
      onPress={() => setSelectedDoctor(item)}
    >
      <Text style={styles.docName}>{item.name}</Text>
      {item.specialization && (
        <Text style={styles.docSpec}>{item.specialization}</Text>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#00796b" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>{t("your_appointments")}</Text>
      <FlatList
        data={appointments}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.empty}>{t("no_appointments")}</Text>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {/* Toggle button */}
      <TouchableOpacity
        style={styles.scheduleBtn}
        onPress={() => setShowSchedule((v) => !v)}
      >
        <Text style={styles.scheduleBtnText}>
          {showSchedule ? t("cancel_schedule") : t("schedule_appointment")}
        </Text>
      </TouchableOpacity>

      {showSchedule && (
        <View style={styles.booking}>
          <Text style={styles.header}>{t("book_appointment")}</Text>

          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.pickerText}>
              {t("pick_date")}: {date.toDateString()}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_, d) => {
                setShowDatePicker(false);
                d && setDate(d);
              }}
            />
          )}

          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={styles.pickerText}>
              {t("pick_time")}: {time.toLocaleTimeString()}
            </Text>
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={time}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_, t) => {
                setShowTimePicker(false);
                t && setTime(t);
              }}
            />
          )}

          <Text style={styles.subheader}>{t("select_doctor")}</Text>
          <FlatList
            data={doctors}
            keyExtractor={(i) => i.id}
            renderItem={renderDoctor}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 10 }}
          />

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={confirmAppointment}
          >
            <Text style={styles.confirmText}>{t("confirm")}</Text>
          </TouchableOpacity>
        </View>
      )}

      <AnimatedModal
        visible={modalVisible}
        message={modalMessage}
        type={modalType}
        onClose={() => setModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ECE5DD", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#128C7E",
  },
  empty: { textAlign: "center", marginTop: 20, color: "#666" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
    elevation: 2,
  },
  cardText: { fontSize: 16, color: "#333" },
  actionRow: { flexDirection: "row", marginTop: 8 },
  btn: {
    flex: 1,
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 4,
  },
  accept: { backgroundColor: "#388E3C" },
  reject: { backgroundColor: "#D32F2F" },
  btnText: { color: "#fff", textAlign: "center", fontWeight: "bold" },
  pending: {
    marginTop: 8,
    fontStyle: "italic",
    color: "#555",
    textAlign: "right",
  },

  scheduleBtn: {
    backgroundColor: "#1976D2",
    padding: 12,
    borderRadius: 8,
    marginVertical: 16,
    alignItems: "center",
  },
  scheduleBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },

  booking: {
    marginBottom: 20,
  },
  picker: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    marginVertical: 6,
  },
  pickerText: { color: "#333" },

  subheader: {
    fontSize: 16,
    marginTop: 12,
    marginBottom: 6,
    color: "#00796B",
  },
  docItem: {
    backgroundColor: "#AAF1E8",
    padding: 10,
    borderRadius: 8,
    marginRight: 8,
    alignItems: "center",
  },
  docSelected: {
    backgroundColor: "#128C7E",
  },
  docName: { fontWeight: "bold", color: "#000" },
  docSpec: { fontSize: 12, color: "#333" },

  confirmBtn: {
    backgroundColor: "#128C7E",
    padding: 14,
    borderRadius: 8,
    marginTop: 12,
    alignItems: "center",
  },
  confirmText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
