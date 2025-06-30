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
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import AnimatedModal from "../components/AnimatedModal"; // ✅ Custom modal

const PatientAppointments = ({ navigation }) => {
  const { t } = useTranslation();
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);

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

  useEffect(() => {
    speak(t("schedule_appointment"));
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const q = query(
        collection(firestore, "users"),
        where("role", "==", "healthworker")
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDoctors(list);
    } catch (error) {
      showModal(t("fetch_doctors_failed"), "error");
      speak(t("fetch_doctors_failed"));
    }
  };

  const showModal = (message, type = "success") => {
    setModal({ visible: true, message, type });
  };

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
        patient_id: user.uid,
        doctor_id: selectedDoctor.id,
        date: date.toISOString().split("T")[0],
        time: time.toTimeString().split(" ")[0],
        status: "pending",
        createdAt: serverTimestamp(),
      });

      showModal(t("appointment_booked"), "success");
      speak(t("appointment_booked"));
      navigation.navigate("ChatScreen");
    } catch (error) {
      showModal(t("appointment_failed"), "error");
      speak(t("appointment_failed"));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>{t("select_date_time")}</Text>

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
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.doctorButton,
              selectedDoctor?.id === item.id && styles.selectedDoctor,
            ]}
            onPress={() => setSelectedDoctor(item)}
          >
            <Text style={styles.doctorText}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        style={styles.confirmButton}
        onPress={confirmAppointment}
      >
        <Text style={styles.confirmText}>{t("confirm_appointment")}</Text>
      </TouchableOpacity>

      {/* ✅ Reusable animated modal */}
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
  },
  header: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#00796b",
  },
  button: {
    backgroundColor: "#00796b",
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    width: "90%",
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
    width: "90%",
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
  confirmButton: {
    backgroundColor: "#004D40",
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    width: "90%",
  },
  confirmText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    fontWeight: "bold",
  },
});

export default PatientAppointments;
