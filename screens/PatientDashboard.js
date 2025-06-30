import React, { useEffect, useState, useCallback } from "react";
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
  onSnapshot,
  collection,
  query,
  where,
  updateDoc,
  orderBy,
} from "firebase/firestore";
import { useFocusEffect } from "@react-navigation/native";
import AnimatedModal from "../components/AnimatedModal";
import { supabase } from "../services/supabase";

const APPOINTMENTS_PER_PAGE = 3;

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
  const [currentPage, setCurrentPage] = useState(1);

  const auth = getAuth();
  const db = getFirestore();

  // Prevent repeated TTS
  const [lastSpoken, setLastSpoken] = useState("");
  // Used to cancel TTS on navigation
  const stopTTS = () => Speech.stop();

  // Features (ensure translation)
  const features = [
    {
      id: "1",
      name: t("Appointments"),
      screen: "PatientAppointment",
      icon: "📅",
    },
    {
      id: "2",
      name: t("Chat"),
      screen: "ChatInbox",
      icon: "💬",
    },
    {
      id: "3",
      name: t("Symptoms Checker"),
      screen: "SymptomsChecker",
      icon: "🔍",
    },
    {
      id: "5",
      name: t("Search for HealthWorkers"),
      screen: "SearchForHealthWorkers",
      icon: "🩺",
    },
  ];

  // Speak if not already spoken
  const speak = useCallback(
    (text) => {
      if (!text || text === lastSpoken) return;
      setLastSpoken(text);
      Speech.stop();
      Speech.speak(text, {
        language: t("lang_code") === "yo" ? "yo" : "en-US",
        rate: 0.5,
        onDone: () => setLastSpoken(""),
        onStopped: () => setLastSpoken(""),
        onError: () => setLastSpoken(""),
      });
    },
    [lastSpoken, t]
  );

  const showModal = (message, type = "success") => {
    speak(message);
    setModal({ visible: true, message, type });
  };

  useFocusEffect(
    useCallback(() => {
      stopTTS();
      setLastSpoken("");
      setTimeout(() => {
        speak(t("welcome_dashboard"));
      }, 300);
      return () => {
        stopTTS();
      };
    }, [t, speak])
  );

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }
    registerForPushNotifications();

    // Live profile
    const unsubscribeUser = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setPatient(data);
          speak(`${t("welcome_back")} ${data.name || ""}`);
        }
        setLoading(false);
      },
      () => setLoading(false)
    );

    // Live appointments (ONLY those not canceled or deleted)
    const appointmentsQuery = query(
      collection(db, "appointments"),
      where("patientId", "==", user.uid),
      orderBy("date", "desc")
    );
    const unsubscribeAppointments = onSnapshot(
      appointmentsQuery,
      (snapshot) => {
        // Only show appointments that are not canceled or deleted
        const validAppointments = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((a) => a.status !== "canceled" && a.status !== "deleted");
        setAppointments(validAppointments);
        setCurrentPage(1); // Reset page if data changes
      }
    );

    return () => {
      unsubscribeUser();
      unsubscribeAppointments();
      stopTTS();
    };
    // eslint-disable-next-line
  }, []);

  // Cancel and (optionally) hard-delete appointment from Firestore
  const cancelAppointment = async (id) => {
    await updateDoc(doc(db, "appointments", id), { status: "canceled" });
    showModal(t("appointment_canceled"));
    // No need to manually filter, real-time listener will update UI
  };

  const registerForPushNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") showModal(t("push_permission_denied"), "error");
  };

  const handleLogout = async () => {
    stopTTS();
    await signOut(auth);
    navigation.replace("LoginScreen");
  };

  const pickImageAndUpload = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      return Alert.alert(t("permission_denied"), t("gallery_access_required"));
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Image, // Correct! (case sensitive)
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    // Check new structure for Expo SDK 49/50+
    if (result.canceled || !result.assets || result.assets.length === 0) {
      showModal(t("no_image_selected"), "error");
      return;
    }
    try {
      const user = auth.currentUser;
      const imageBlob = await (await fetch(result.assets[0].uri)).blob();
      const filePath = `${user.uid}/${Date.now()}_profile.jpg`;
      const { error } = await supabase.storage
        .from("profile-pictures")
        .upload(filePath, imageBlob, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/jpeg",
        });
      if (error) throw error;
      const { data } = supabase.storage
        .from("profile-pictures")
        .getPublicUrl(filePath);
      await updateDoc(doc(db, "users", user.uid), {
        profilePic: data.publicUrl,
      });
      showModal(t("profile_updated"));
    } catch (err) {
      showModal(t("upload_failed"), "error");
    }
  };

  // PAGINATION logic
  const totalPages = Math.ceil(appointments.length / APPOINTMENTS_PER_PAGE);
  const paginatedAppointments = appointments.slice(
    (currentPage - 1) * APPOINTMENTS_PER_PAGE,
    currentPage * APPOINTMENTS_PER_PAGE
  );

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
        <TouchableOpacity
          onPress={() => {
            stopTTS();
            pickImageAndUpload();
          }}
        >
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
        {patient?.age && (
          <Text style={styles.profileSubText}>
            {t("Age")}: {patient.age}
          </Text>
        )}
        {patient?.gender && (
          <Text style={styles.profileSubText}>
            {t("Gender")}: {patient.gender}
          </Text>
        )}
      </View>

      <FlatList
        data={features}
        numColumns={2}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => {
              stopTTS();
              navigation.navigate(item.screen); // always route to ChatInbox for chat
              speak(item.name);
            }}
            onLongPress={() => speak(item.name)}
          >
            <Text style={styles.emoji}>{item.icon}</Text>
            <Text style={styles.cardText}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />

      <Text style={styles.header}>{t("your_appointments")}</Text>
      <FlatList
        data={paginatedAppointments}
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
              onPress={() => {
                stopTTS();
                cancelAppointment(item.id);
                speak(t("appointment_canceled"));
              }}
            >
              <Text style={styles.cancelText}>{t("cancel_appointment")}</Text>
            </TouchableOpacity>
          </View>
        )}
        ListFooterComponent={() =>
          appointments.length > APPOINTMENTS_PER_PAGE && (
            <View style={styles.paginationContainer}>
              <TouchableOpacity
                disabled={currentPage === 1}
                onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={[
                  styles.paginationButton,
                  currentPage === 1 && styles.paginationButtonDisabled,
                ]}
              >
                <Text style={styles.paginationText}>{t("previous")}</Text>
              </TouchableOpacity>
              <Text style={styles.paginationPageIndicator}>
                {currentPage}/{totalPages}
              </Text>
              <TouchableOpacity
                disabled={currentPage === totalPages}
                onPress={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                style={[
                  styles.paginationButton,
                  currentPage === totalPages && styles.paginationButtonDisabled,
                ]}
              >
                <Text style={styles.paginationText}>{t("next")}</Text>
              </TouchableOpacity>
            </View>
          )
        }
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
  profileSubText: { fontSize: 16, color: "#666", marginTop: 2 },
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
  // Pagination styles
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  paginationButton: {
    padding: 10,
    backgroundColor: "#00796b",
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
    marginHorizontal: 5,
  },
  paginationButtonDisabled: {
    backgroundColor: "#B2DFDB",
  },
  paginationText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  paginationPageIndicator: {
    marginHorizontal: 12,
    fontSize: 16,
    fontWeight: "bold",
    color: "#00796b",
  },
});

export default PatientDashboard;
