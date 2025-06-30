import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Speech from "expo-speech";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
  getDocs,
  orderBy,
} from "firebase/firestore";
import AnimatedModal from "../components/AnimatedModal";
import DateTimePicker from "@react-native-community/datetimepicker";

// Utility: deterministic chatId (sorted order)
const getChatId = (a, b) => [a, b].sort().join("_");

const DoctorAppointments = ({ navigation }) => {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState([]);
  const [patientMap, setPatientMap] = useState({}); // { patientId: {name, email, ...} }
  const [loading, setLoading] = useState(true);
  const [doctorProfile, setDoctorProfile] = useState(null);

  // Scheduling state
  const [showSchedule, setShowSchedule] = useState(false);
  const [patientNameInput, setPatientNameInput] = useState("");
  const [foundPatients, setFoundPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [time, setTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalSuccess, setModalSuccess] = useState(false);
  const [lastError, setLastError] = useState("");

  // Unread messages state
  const [unreadMap, setUnreadMap] = useState({}); // { [chatId]: unreadCount }

  const auth = getAuth();
  const firestore = getFirestore();
  const unsubRef = useRef(null);
  const unsubMsgRef = useRef(null);

  // --- Helper functions ---
  const speak = (msg) => {
    Speech.speak(msg, {
      language: t("lang_code") === "yo" ? "yo" : "en-US",
      pitch: 1,
      rate: 1,
    });
  };
  // By Ogunyade Olamilekan Adeyanju
  const showModal = (message, success = false, errorType = "") => {
    setModalMessage(message);
    setModalSuccess(success);
    setLastError(errorType);
    setModalVisible(true);
    speak(message);
  };

  // Unread badge
  const subscribeToUnread = useCallback(
    (appointments, doctorUid) => {
      if (unsubMsgRef.current) {
        for (let unsub of Object.values(unsubMsgRef.current)) {
          if (typeof unsub === "function") unsub();
        }
      }
      unsubMsgRef.current = {};

      appointments.forEach((appt) => {
        if (!appt.patientId || !doctorUid) return;
        const chatId = getChatId(appt.patientId, doctorUid);
        const q = query(
          collection(firestore, "messages"),
          where("chatId", "==", chatId),
          where("read", "==", false),
          where("receiverId", "==", doctorUid)
        );
        unsubMsgRef.current[chatId] = onSnapshot(q, (snapshot) => {
          setUnreadMap((prev) => ({ ...prev, [chatId]: snapshot.size }));
        });
      });
    },
    [firestore]
  );

  // Fetch all patients in appointments (batch fetch)
  const fetchPatientsForAppointments = useCallback(
    async (apps) => {
      const uniqueIds = Array.from(
        new Set(apps.map((a) => a.patientId).filter(Boolean))
      );
      if (uniqueIds.length === 0) {
        setPatientMap({});
        return;
      }
      const patientMapObj = {};
      for (const pid of uniqueIds) {
        try {
          const pRef = doc(firestore, "users", pid);
          const snap = await getDoc(pRef);
          if (snap.exists()) {
            patientMapObj[pid] = snap.data();
          }
        } catch (e) {
          // If user not found, leave blank
          patientMapObj[pid] = { name: pid };
        }
      }
      setPatientMap(patientMapObj);
    },
    [firestore]
  );

  // Fetch doctor profile and appointments
  const initialize = useCallback(async () => {
    setLoading(true);
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (unsubMsgRef.current) {
      for (let unsub of Object.values(unsubMsgRef.current)) {
        if (typeof unsub === "function") unsub();
      }
      unsubMsgRef.current = {};
    }

    try {
      const user = auth.currentUser;
      // SAFEGUARD: Only check login once, and never modal repeatedly
      if (!user) {
        setDoctorProfile(null);
        setAppointments([]);
        setLoading(false);
        return;
      }
      // Get doctor profile
      const profileRef = doc(firestore, "users", user.uid);
      const profileSnap = await getDoc(profileRef);
      if (!profileSnap.exists()) {
        showModal(t("profile_not_found"), false, "profile");
        setLoading(false);
        return;
      }
      const profileData = profileSnap.data();
      if (profileData.role !== "healthworker") {
        showModal(t("not_doctor"), false, "profile");
        setLoading(false);
        return;
      }
      setDoctorProfile({ ...profileData, id: user.uid });

      // Subscribe to appointments for this healthworker
      const q = query(
        collection(firestore, "appointments"),
        where("healthworkerId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      unsubRef.current = onSnapshot(
        q,
        async (snapshot) => {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setAppointments(data);
          // Fetch all patients for mapping after loading appointments
          await fetchPatientsForAppointments(data);
          setLoading(false);
          subscribeToUnread(data, user.uid);
        },
        (error) => {
          // Only show modal if truly needed (avoid infinite loop)
          console.error("Appointment fetch error:", error);
          showModal(t("fetch_failed"), false, "fetch");
          setLoading(false);
        }
      );

      speak(t("doctor_appointments"));
    } catch (error) {
      console.error("Doctor Appointments Screen error:", error);
      showModal(t("fetch_failed"), false, "fetch");
      setLoading(false);
    }
  }, [t, subscribeToUnread, firestore, auth, fetchPatientsForAppointments]);

  useEffect(() => {
    initialize();
    return () => {
      if (unsubRef.current) unsubRef.current();
      if (unsubMsgRef.current) {
        for (let unsub of Object.values(unsubMsgRef.current)) {
          if (typeof unsub === "function") unsub();
        }
        unsubMsgRef.current = {};
      }
    };
  }, [initialize]);

  const handleModalClose = () => {
    setModalVisible(false);
  };

  // Approve or reject appointment (only if not scheduled_by_healthworker)
  const handleApproval = async (id, status) => {
    try {
      const appointmentRef = doc(firestore, "appointments", id);
      await updateDoc(appointmentRef, { status });
      showModal(t("status_updated"), true, "");
    } catch (error) {
      showModal(t("update_failed"), false, "fetch");
    }
  };

  // --- PATIENT NAME TO UID SEARCH ---
  // Search as you type (case insensitive, client side)
  const searchPatientByName = useCallback(
    async (name) => {
      setSelectedPatient(null);
      setFoundPatients([]);
      if (!name.trim()) return;
      setSearchLoading(true);

      const nameLower = name.trim().toLowerCase();

      const q = query(
        collection(firestore, "users"),
        where("role", "==", "patient")
      );
      const snapshot = await getDocs(q);
      const matches = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((u) => (u.name || "").toLowerCase().includes(nameLower));
      setFoundPatients(matches);
      setSearchLoading(false);
    },
    [firestore]
  );

  // Schedule appointment for a found patient
  const scheduleAppointment = async () => {
    if (!selectedPatient) {
      showModal(t("select_patient"), false, "");
      return;
    }
    try {
      const user = auth.currentUser;
      if (!user) {
        showModal(t("login_required"), false, "auth");
        return;
      }
      await addDoc(collection(firestore, "appointments"), {
        patientId: selectedPatient.id,
        healthworkerId: user.uid,
        date: date.toISOString().split("T")[0],
        time: time.toTimeString().split(" ")[0],
        status: "scheduled_by_healthworker",
        createdAt: serverTimestamp(),
      });
      showModal(t("appointment_scheduled"), true, "");
      setShowSchedule(false);
      setPatientNameInput("");
      setSelectedPatient(null);
      setFoundPatients([]);
    } catch (error) {
      showModal(t("appointment_failed"), false, "fetch");
    }
  };

  // Appointment card + unread badge + patient detail display
  const renderAppointmentItem = ({ item }) => {
    const chatId =
      item.patientId && doctorProfile
        ? getChatId(item.patientId, doctorProfile.id)
        : null;
    const unread = unreadMap[chatId] || 0;
    const patient = patientMap[item.patientId] || {};
    const showAction = item.status !== "scheduled_by_healthworker"; // If scheduled by doctor, no Accept/Reject

    return (
      <View style={styles.card}>
        <Text style={styles.cardText}>
          {t("patient")}: {patient.name || item.patientId}
          {patient.age && ` | Age: ${patient.age}`}
          {patient.gender && ` | Gender: ${patient.gender}`}
          {"\n"}
          {patient.email && `Email: ${patient.email}\n`}
          {t("date")}: {item.date} | {t("time")}: {item.time} | {t("status")}:{" "}
          {item.status}
        </Text>
        {unread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{unread}</Text>
          </View>
        )}
        {showAction && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleApproval(item.id, "approved")}
            >
              <Text style={styles.buttonText}>{t("approve")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => handleApproval(item.id, "rejected")}
            >
              <Text style={styles.buttonText}>{t("reject")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Patient search UI and selection
  const renderPatientSearch = () => (
    <View style={styles.scheduleForm}>
      <Text style={styles.formLabel}>{t("enter_patient_name")}</Text>
      <TextInput
        style={styles.input}
        value={patientNameInput}
        onChangeText={async (val) => {
          setPatientNameInput(val);
          setSelectedPatient(null);
          setFoundPatients([]);
          if (val.length >= 2) {
            await searchPatientByName(val);
          }
        }}
        placeholder={t("patient_name")}
        autoCapitalize="words"
      />
      {searchLoading && (
        <ActivityIndicator
          size="small"
          color="#00796b"
          style={{ marginBottom: 5 }}
        />
      )}
      {foundPatients.length > 0 && (
        <View>
          <Text style={{ color: "#00796b", fontWeight: "bold" }}>
            {t("select_patient")}
          </Text>
          <FlatList
            data={foundPatients}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.patientOption,
                  selectedPatient?.id === item.id &&
                    styles.selectedPatientOption,
                ]}
                onPress={() => setSelectedPatient(item)}
              >
                <Text>
                  {item.name} ({item.id}){item.email && ` | ${item.email}`}
                </Text>
              </TouchableOpacity>
            )}
            style={{ maxHeight: 120 }}
          />
        </View>
      )}

      <TouchableOpacity
        style={styles.dateButton}
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
        style={styles.dateButton}
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
      <TouchableOpacity
        style={[
          styles.confirmButton,
          !selectedPatient && { backgroundColor: "#BDBDBD" },
        ]}
        onPress={scheduleAppointment}
        disabled={!selectedPatient}
      >
        <Text style={styles.confirmText}>{t("schedule")}</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00796b" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>
        {t("appointments_list")}{" "}
        {doctorProfile?.name ? `- ${doctorProfile.name}` : ""}
      </Text>
      <Text style={styles.subHeader}>
        {doctorProfile?.specialization
          ? `${t("specialization")}: ${doctorProfile.specialization}`
          : ""}
      </Text>
      <Text style={styles.subHeader}>
        {doctorProfile?.yearsExperience
          ? `${t("experience")}: ${doctorProfile.yearsExperience} ${t("years")}`
          : ""}
      </Text>

      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={{ textAlign: "center", marginTop: 20, color: "#888" }}>
            {t("no_appointments")}
          </Text>
        }
        renderItem={renderAppointmentItem}
      />

      {/* Schedule New Appointment */}
      <TouchableOpacity
        style={styles.scheduleButton}
        onPress={() => setShowSchedule((prev) => !prev)}
      >
        <Text style={styles.scheduleText}>
          {showSchedule ? t("cancel_schedule") : t("schedule_new_appointment")}
        </Text>
      </TouchableOpacity>

      {showSchedule && renderPatientSearch()}

      <AnimatedModal
        visible={modalVisible}
        message={modalMessage}
        success={modalSuccess}
        onClose={handleModalClose}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E8F5E9", padding: 20 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
  },
  header: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#00796b",
    textAlign: "center",
  },
  subHeader: {
    fontSize: 15,
    color: "#377772",
    textAlign: "center",
    marginBottom: 2,
  },
  card: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    elevation: 3,
    position: "relative",
  },
  cardText: { fontSize: 16, color: "#333" },
  unreadBadge: {
    position: "absolute",
    right: 12,
    top: 8,
    backgroundColor: "#D32F2F",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
  },
  unreadText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  acceptButton: {
    backgroundColor: "green",
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginRight: 5,
  },
  rejectButton: {
    backgroundColor: "red",
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginLeft: 5,
  },
  buttonText: { color: "white", textAlign: "center", fontWeight: "bold" },
  // Schedule section
  scheduleButton: {
    backgroundColor: "#1976D2",
    padding: 12,
    borderRadius: 10,
    marginVertical: 10,
    alignItems: "center",
  },
  scheduleText: { color: "white", fontWeight: "bold", fontSize: 16 },
  scheduleForm: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
  },
  formLabel: { fontSize: 14, color: "#00796b", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#00796b",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "white",
  },
  patientOption: {
    backgroundColor: "#E0F7FA",
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
  },
  selectedPatientOption: {
    backgroundColor: "#B2EBF2",
    borderWidth: 2,
    borderColor: "#00796b",
  },
  dateButton: {
    backgroundColor: "#00897b",
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  confirmButton: {
    backgroundColor: "#004D40",
    padding: 13,
    borderRadius: 10,
    marginTop: 10,
  },
  confirmText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    fontWeight: "bold",
  },
});

export default DoctorAppointments;
