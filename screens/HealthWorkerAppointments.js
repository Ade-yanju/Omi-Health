import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Speech from "expo-speech";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../services/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import AnimatedModal from "../components/AnimatedModal"; // ✅ Import the modal

const DoctorAppointments = () => {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [doctorId, setDoctorId] = useState(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalSuccess, setModalSuccess] = useState(false);

  const speak = (message) => {
    Speech.speak(message, {
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

  useEffect(() => {
    speak(t("doctor_appointments"));
    getDoctorId();
  }, []);

  const getDoctorId = async () => {
    try {
      const storedUser = await AsyncStorage.getItem("user");
      if (storedUser) {
        const user = JSON.parse(storedUser);
        setDoctorId(user.uid);
        subscribeToAppointments(user.uid);
      } else {
        showModal(t("login_required"));
        setLoading(false);
      }
    } catch (error) {
      showModal(t("fetch_failed"));
      setLoading(false);
    }
  };

  const subscribeToAppointments = (uid) => {
    const q = query(
      collection(db, "appointments"),
      where("doctor_id", "==", uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAppointments(data);
        setLoading(false);
        speak(t("appointments_fetched"));
      },
      (error) => {
        showModal(t("fetch_failed"));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  };

  const handleApproval = async (id, status) => {
    try {
      const appointmentRef = doc(db, "appointments", id);
      await updateDoc(appointmentRef, { status });
      showModal(t("status_updated"), true);
    } catch (error) {
      showModal(t("update_failed"));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00796b" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>{t("appointments_list")}</Text>

      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardText}>
              {t("patient")}: {item.patient_id} | {t("date")}: {item.date} |{" "}
              {t("time")}: {item.time}
            </Text>
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
          </View>
        )}
      />

      <AnimatedModal
        visible={modalVisible}
        message={modalMessage}
        success={modalSuccess}
        onClose={() => setModalVisible(false)}
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
    marginBottom: 20,
    color: "#00796b",
    textAlign: "center",
  },
  card: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    elevation: 3,
  },
  cardText: { fontSize: 16, color: "#333" },
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
});

export default DoctorAppointments;
