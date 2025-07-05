// DoctorAppointments.js

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
import * as Notifications from "expo-notifications";
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
  getDocs,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import AnimatedModal from "../components/AnimatedModal";
import DateTimePicker from "@react-native-community/datetimepicker";

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

export default function DoctorAppointments({ navigation }) {
  const { t } = useTranslation();
  const auth = getAuth();
  const firestore = getFirestore();
  const user = auth.currentUser;

  // state
  const [loading, setLoading] = useState(true);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [patientMap, setPatientMap] = useState({});
  const [unreadMap, setUnreadMap] = useState({});

  // schedule form
  const [showSchedule, setShowSchedule] = useState(false);
  const [patientNameInput, setPatientNameInput] = useState("");
  const [foundPatients, setFoundPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalSuccess, setModalSuccess] = useState(false);

  // refs to unsubscribe
  const unsubAppsRef = useRef(null);
  const unsubMsgsRef = useRef({});

  // ─── Helpers ───────────────────────────────────────────

  const speak = (msg) => {
    Speech.speak(msg, {
      language: t("lang_code") === "yo" ? "yo" : "en-US",
      pitch: 1,
      rate: 1,
    });
  };
  const showModal = (message, success = false) => {
    setModalMessage(message);
    setModalSuccess(success);
    setModalVisible(true);
    speak(message);
  };
  const hideModal = () => setModalVisible(false);

  // subscribe to unread counts per chat
  const subscribeToUnread = useCallback(
    (apps) => {
      Object.values(unsubMsgsRef.current).forEach((u) => u && u());
      unsubMsgsRef.current = {};

      apps.forEach((appt) => {
        if (!appt.patientId) return;
        const chatId = getChatId(appt.patientId, user.uid);
        const q = query(
          collection(firestore, "messages"),
          where("chatId", "==", chatId),
          where("read", "==", false),
          where("receiverId", "==", user.uid)
        );
        unsubMsgsRef.current[chatId] = onSnapshot(q, (snap) => {
          setUnreadMap((prev) => ({ ...prev, [chatId]: snap.size }));
        });
      });
    },
    [firestore, user.uid]
  );

  // batch‐fetch patient profiles
  const fetchPatientsForAppointments = useCallback(
    async (apps) => {
      const ids = Array.from(
        new Set(apps.map((a) => a.patientId).filter(Boolean))
      );
      const map = {};
      await Promise.all(
        ids.map(async (pid) => {
          const snap = await getDoc(doc(firestore, "users", pid));
          if (snap.exists()) {
            const d = snap.data();
            map[pid] = { name: d.name, email: d.email };
          }
        })
      );
      setPatientMap(map);
    },
    [firestore]
  );

  // ─── Real‐time appointment subscription ─────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      // load doctor profile
      const profSnap = await getDoc(doc(firestore, "users", user.uid));
      if (!profSnap.exists() || profSnap.data().role !== "healthworker") {
        showModal("Not a healthworker—access denied.");
        setLoading(false);
        return;
      }
      setDoctorProfile({ id: user.uid, ...profSnap.data() });

      // notif permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        console.warn("Notifications permission not granted");
      }

      // subscribe
      const q = query(
        collection(firestore, "appointments"),
        where("healthworkerId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      unsubAppsRef.current = onSnapshot(
        q,
        async (snap) => {
          const apps = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

          // notify new incoming
          snap.docChanges().forEach((ch) => {
            if (
              ch.type === "added" &&
              ch.doc.data().status === "scheduled_by_patient"
            ) {
              const d = ch.doc.data();
              const pat = patientMap[d.patientId] || {};
              Notifications.scheduleNotificationAsync({
                content: {
                  title: "New Appointment Request",
                  body: `${pat.name || "A patient"} requested ${d.date} at ${
                    d.time
                  }`,
                },
                trigger: null,
              });
              speak(`New request from ${pat.name || "patient"}`);
            }
          });

          setAppointments(apps);
          await fetchPatientsForAppointments(apps);
          subscribeToUnread(apps);
          setLoading(false);
          speak("Your appointments list is ready");
        },
        (err) => {
          console.error(err);
          showModal("Failed to load appointments");
          setLoading(false);
        }
      );
    })();

    return () => {
      unsubAppsRef.current && unsubAppsRef.current();
      Object.values(unsubMsgsRef.current).forEach((u) => u && u());
    };
  }, [
    firestore,
    user,
    fetchPatientsForAppointments,
    subscribeToUnread,
    patientMap,
  ]);

  // ─── Approve / Reject ──────────────────────────────────
  const handleApproval = async (id, status) => {
    try {
      await updateDoc(doc(firestore, "appointments", id), { status });
      showModal("Status updated", true);
    } catch {
      showModal("Update failed");
    }
  };

  // ─── Search patients by name via Firestore query ───────
  const searchPatientByName = useCallback(
    async (name) => {
      setFoundPatients([]);
      if (name.trim().length < 2) return;
      setSearchLoading(true);
      try {
        const patientsQuery = query(
          collection(firestore, "users"),
          where("role", "==", "patient"),
          where("name", ">=", name.trim()),
          where("name", "<=", name.trim() + "\uf8ff")
        );
        const snap = await getDocs(patientsQuery);
        const matches = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name,
          email: d.data().email,
        }));
        setFoundPatients(matches);
      } catch (e) {
        console.error(e);
        showModal("Error searching patients");
      } finally {
        setSearchLoading(false);
      }
    },
    [firestore]
  );

  // ─── Schedule appointment ──────────────────────────────
  const scheduleAppointment = async () => {
    if (!selectedPatient) {
      if (foundPatients.length === 0 && patientNameInput.trim().length >= 2) {
        showModal("No user found with that name");
      } else {
        showModal("Please select a patient");
      }
      return;
    }
    try {
      await addDoc(collection(firestore, "appointments"), {
        patientId: selectedPatient.id,
        healthWorkerId: user.uid,
        date: date.toISOString().split("T")[0],
        time: time.toTimeString().split(" ")[0],
        status: "scheduled_by_healthworker",
        createdAt: serverTimestamp(),
      });
      showModal("Appointment scheduled", true);
      setShowSchedule(false);
      setPatientNameInput("");
      setFoundPatients([]);
      setSelectedPatient(null);
    } catch {
      showModal("Failed to schedule");
    }
  };

  // ─── Render one appointment ────────────────────────────
  const renderAppointmentItem = ({ item }) => {
    const pat = patientMap[item.patientId] || {};
    const chatId = getChatId(item.patientId, user.uid);
    const unread = unreadMap[chatId] || 0;

    const bgColor =
      item.status === "scheduled_by_patient"
        ? "#FFF3E0"
        : item.status === "scheduled_by_healthworker"
        ? "#E3F2FD"
        : item.status === "approved"
        ? "#C8E6C9"
        : item.status === "rejected"
        ? "#FFCDD2"
        : "#fff";

    const isIncoming = item.status === "scheduled_by_patient";
    const isOutgoing = item.status === "scheduled_by_healthworker";

    return (
      <View style={[styles.card, { backgroundColor: bgColor }]}>
        <Text style={styles.cardText}>
          {pat.name || item.patientId}
          {pat.email && ` | ${pat.email}`}
          {"\n"}
          {item.date} @ {item.time}
          {"\n"}
          <Text style={{ fontStyle: "italic" }}>{item.status}</Text>
        </Text>
        {unread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{unread}</Text>
          </View>
        )}
        {isIncoming && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleApproval(item.id, "approved")}
            >
              <Text style={styles.buttonText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => handleApproval(item.id, "rejected")}
            >
              <Text style={styles.buttonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
        {isOutgoing && (
          <Text style={styles.pendingText}>Pending patient response…</Text>
        )}
      </View>
    );
  };

  // ─── Patient search form ──────────────────────────────
  const renderPatientSearch = () => (
    <View style={styles.form}>
      <TextInput
        style={styles.input}
        value={patientNameInput}
        onChangeText={(val) => {
          setPatientNameInput(val);
          setSelectedPatient(null);
          searchPatientByName(val);
        }}
        placeholder="Enter patient name…"
      />
      {searchLoading && <ActivityIndicator size="small" color="#00796b" />}
      {foundPatients.map((p) => (
        <TouchableOpacity
          key={p.id}
          style={[
            styles.option,
            selectedPatient?.id === p.id && styles.optionSelected,
          ]}
          onPress={() => setSelectedPatient(p)}
        >
          <Text>
            {p.name} — {p.email}
          </Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={styles.buttonText}>Date: {date.toDateString()}</Text>
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
        style={styles.pickerButton}
        onPress={() => setShowTimePicker(true)}
      >
        <Text style={styles.buttonText}>Time: {time.toLocaleTimeString()}</Text>
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

      <TouchableOpacity
        style={styles.confirmButton}
        onPress={scheduleAppointment}
      >
        <Text style={styles.confirmText}>Schedule</Text>
      </TouchableOpacity>
    </View>
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
      <Text style={styles.title}>
        Appointments for Dr. {doctorProfile?.name || user.uid}
      </Text>

      <FlatList
        data={appointments}
        keyExtractor={(i) => i.id}
        renderItem={renderAppointmentItem}
        ListEmptyComponent={
          <Text style={styles.empty}>No appointments yet.</Text>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setShowSchedule((v) => !v)}
      >
        <Text style={styles.toggleText}>
          {showSchedule ? "Cancel" : "New Appointment"}
        </Text>
      </TouchableOpacity>

      {showSchedule && renderPatientSearch()}

      <AnimatedModal
        visible={modalVisible}
        message={modalMessage}
        success={modalSuccess}
        onClose={hideModal}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
    color: "#00796b",
  },
  empty: { textAlign: "center", marginTop: 20, color: "#888" },

  card: {
    padding: 14,
    borderRadius: 10,
    marginVertical: 6,
    elevation: 2,
    position: "relative",
  },
  cardText: { fontSize: 16, color: "#333" },
  unreadBadge: {
    position: "absolute",
    top: 8,
    right: 12,
    backgroundColor: "#D32F2F",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  unreadText: { color: "#fff", fontSize: 12, fontWeight: "bold" },

  buttonContainer: { flexDirection: "row", marginTop: 10 },
  acceptButton: {
    flex: 1,
    backgroundColor: "#388E3C",
    padding: 10,
    borderRadius: 6,
    marginRight: 6,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#D32F2F",
    padding: 10,
    borderRadius: 6,
    marginLeft: 6,
  },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "bold" },

  pendingText: {
    marginTop: 8,
    fontStyle: "italic",
    color: "#555",
    textAlign: "right",
  },

  toggleButton: {
    backgroundColor: "#1976D2",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 12,
  },
  toggleText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  form: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    elevation: 2,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#00796b",
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  option: {
    backgroundColor: "#E0F7FA",
    padding: 8,
    borderRadius: 6,
    marginVertical: 4,
  },
  optionSelected: {
    backgroundColor: "#B2EBF2",
    borderWidth: 2,
    borderColor: "#00796b",
  },
  pickerButton: {
    backgroundColor: "#00897b",
    padding: 10,
    borderRadius: 6,
    marginVertical: 6,
    alignItems: "center",
  },
  confirmButton: {
    backgroundColor: "#004D40",
    padding: 12,
    borderRadius: 6,
    marginTop: 10,
    alignItems: "center",
  },
  confirmText: { color: "#fff", fontWeight: "bold" },
});
