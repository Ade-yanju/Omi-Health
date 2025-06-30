import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Speech from "expo-speech";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { getAuth, signOut } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import AnimatedModal from "../components/AnimatedModal";

const PatientDashboard = ({ navigation }) => {
  const { t } = useTranslation();
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({
    visible: false,
    message: "",
    type: "success",
  });

  const auth = getAuth();
  const db = getFirestore();
  const storage = getStorage();

  const features = [
    { id: "1", name: "Appointments", screen: "PatientAppointment", icon: "📅" },
    { id: "2", name: "Chat", screen: "ChatWithHealthWorker", icon: "💬" },
    {
      id: "3",
      name: "Symptoms Checker",
      screen: "SymptomsChecker",
      icon: "🔍",
    },
    {
      id: "5",
      name: "Search for HealthWorkers",
      screen: "SearchForHealthWorkers",
      icon: "🩺",
    },
  ];

  const speak = (text) => {
    Speech.speak(text, {
      language: t("lang_code") === "yo" ? "yo" : "en-US",
      rate: 0.5,
    });
  };

  const showModal = (message, type = "success") => {
    speak(message);
    setModal({ visible: true, message, type });
  };

  useEffect(() => {
    registerForPushNotifications();
    fetchPatientData();
    fetchAppointments();
  }, []);

  const fetchPatientData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error(t("unauthenticated"));

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        setPatient(data);
        speak(`${t("welcome_back")} ${data.name}`);
      }
    } catch (error) {
      showModal(t("fetch_failed"), "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const q = query(
        collection(db, "appointments"),
        where("patient_id", "==", user.uid)
      );
      const snapshot = await getDocs(q);
      setAppointments(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
    } catch (err) {
      console.error("Appointment Fetch Error:", err);
    }
  };

  const cancelAppointment = async (id) => {
    try {
      const appointmentRef = doc(db, "appointments", id);
      await updateDoc(appointmentRef, { status: "canceled" });
      showModal(t("appointment_canceled"));
      fetchAppointments();
    } catch (err) {
      showModal(t("cancel_failed"), "error");
    }
  };

  const registerForPushNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") showModal(t("push_permission_denied"), "error");
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.replace("LoginScreen");
    } catch (err) {
      showModal(t("logout_failed"), "error");
    }
  };

  const pickImageAndUpload = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission denied", "We need access to your gallery.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      try {
        const user = auth.currentUser;
        const imageUri = result.assets[0].uri;
        const imageBlob = await (await fetch(imageUri)).blob();
        const storageRef = ref(storage, `profilePictures/${user.uid}.jpg`);
        await uploadBytes(storageRef, imageBlob);
        const downloadURL = await getDownloadURL(storageRef);

        await updateDoc(doc(db, "users", user.uid), {
          profilePic: downloadURL,
        });
        setPatient((prev) => ({ ...prev, profilePic: downloadURL }));
        showModal(t("profile_updated"));
      } catch (error) {
        console.error("Upload failed:", error);
        showModal(t("upload_failed"), "error");
      }
    }
  };

  const navigateToChat = async () => {
    try {
      const user = auth.currentUser;
      if (!user || !patient) {
        showModal(t("unauthenticated"), "error");
        return;
      }

      const chatId = `${user.uid}_healthworker`;
      navigation.navigate("ChatWithHealthWorker", {
        chatId,
        userId: user.uid,
        patientName: patient.name,
      });
    } catch (err) {
      console.error("Chat navigation error:", err);
      showModal(t("chat_nav_error"), "error");
    }
  };

  const handleFeatureNavigation = (item) => {
    item.screen === "ChatWithHealthWorker"
      ? navigateToChat()
      : navigation.navigate(item.screen);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#00796b" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AnimatedModal
        visible={modal.visible}
        message={modal.message}
        type={modal.type}
        onClose={() => setModal({ ...modal, visible: false })}
      />

      <View style={styles.profileSection}>
        <TouchableOpacity onPress={pickImageAndUpload}>
          {patient?.profilePic ? (
            <Image
              source={{ uri: patient.profilePic }}
              style={styles.profileImage}
            />
          ) : (
            <View style={[styles.profileImage, styles.nullProfile]}>
              <Text style={{ fontSize: 30, color: "#fff" }}>👤</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.profileText}>{patient?.name || t("user")}</Text>
      </View>

      <FlatList
        data={features}
        numColumns={2}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => handleFeatureNavigation(item)}
          >
            <Text style={styles.emoji}>{item.icon}</Text>
            <Text style={styles.cardText}>{t(item.name)}</Text>
          </TouchableOpacity>
        )}
      />

      <Text style={styles.header}>{t("your_appointments")}</Text>
      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.appointmentCard}>
            <Text style={styles.appointmentText}>
              {t("date")}: {item.date}
            </Text>
            <Text style={styles.appointmentText}>
              {t("time")}: {item.time}
            </Text>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => cancelAppointment(item.id)}
            >
              <Text style={styles.cancelText}>{t("cancel_appointment")}</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>{t("logout")}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E8F5E9", padding: 20 },
  profileSection: { alignItems: "center", marginBottom: 20 },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
    backgroundColor: "#ccc",
  },
  nullProfile: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#999",
  },
  profileText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#00796b",
    marginTop: 8,
  },
  card: {
    flex: 1,
    margin: 10,
    backgroundColor: "#00796b",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  emoji: { fontSize: 30, marginBottom: 5 },
  cardText: { color: "white", fontSize: 16, fontWeight: "bold" },
  header: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00796b",
    marginTop: 20,
  },
  appointmentCard: {
    backgroundColor: "white",
    padding: 15,
    marginVertical: 5,
    borderRadius: 10,
  },
  appointmentText: { fontSize: 14, marginBottom: 5, color: "#333" },
  cancelButton: {
    backgroundColor: "#d32f2f",
    padding: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  cancelText: { color: "white", textAlign: "center", fontWeight: "bold" },
  logoutButton: {
    backgroundColor: "#d32f2f",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  logoutText: { color: "white", fontWeight: "bold", fontSize: 16 },
});

export default PatientDashboard;
