// PatientDashboard.js

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
} from "firebase/firestore";
import { useFocusEffect } from "@react-navigation/native";
import AnimatedModal from "../components/AnimatedModal";
import { supabase } from "../services/supabase";

export default function PatientDashboard({ navigation }) {
  const { t } = useTranslation();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [appointmentCount, setAppointmentCount] = useState(0);

  const auth = getAuth();
  const db = getFirestore();
  const myUid = auth.currentUser?.uid;

  // TTS guard
  const [lastSpoken, setLastSpoken] = useState("");
  const stopTTS = () => Speech.stop();

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
      setTimeout(() => speak(t("welcome_dashboard")), 300);
      return () => stopTTS();
    }, [t, speak])
  );

  // Subscribe to profile + appointment count
  useEffect(() => {
    if (!myUid) {
      setLoading(false);
      return;
    }
    Notifications.requestPermissionsAsync().then(({ status }) => {
      if (status !== "granted") showModal(t("push_permission_denied"), "error");
    });

    const unsubUser = onSnapshot(
      doc(db, "users", myUid),
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

    const apptQ = query(
      collection(db, "appointments"),
      where("patientId", "==", myUid),
      where("status", "not-in", ["canceled", "deleted"])
    );
    const unsubAppts = onSnapshot(apptQ, (snap) => {
      setAppointmentCount(snap.size);
    });

    return () => {
      unsubUser();
      unsubAppts();
      stopTTS();
    };
  }, [db, myUid, speak, t]);

  const handleLogout = async () => {
    stopTTS();
    await signOut(auth);
    navigation.replace("LoginScreen");
  };

  const pickImageAndUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted")
      return Alert.alert(t("permission_denied"), t("gallery_access_required"));

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) {
      showModal(t("no_image_selected"), "error");
      return;
    }

    try {
      const blob = await (await fetch(result.assets[0].uri)).blob();
      const filePath = `${myUid}/${Date.now()}_profile.jpg`;
      const { error } = await supabase.storage
        .from("profile-pictures")
        .upload(filePath, blob, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/jpeg",
        });
      if (error) throw error;
      const { data } = supabase.storage
        .from("profile-pictures")
        .getPublicUrl(filePath);
      await updateDoc(doc(db, "users", myUid), {
        profilePic: data.publicUrl,
      });
      showModal(t("profile_updated"));
    } catch {
      showModal(t("upload_failed"), "error");
    }
  };

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
      id: "4",
      name: t("Search for HealthWorkers"),
      screen: "SearchForHealthWorkers",
      icon: "🩺",
    },
  ];

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
        onClose={() => setModal((m) => ({ ...m, visible: false }))}
      />

      {/* Profile */}
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
        <Text style={styles.profileName}>{patient?.name || t("user")}</Text>
        {patient?.age && (
          <Text style={styles.profileSub}>
            {t("Age")}: {patient.age}
          </Text>
        )}
        {patient?.gender && (
          <Text style={styles.profileSub}>
            {t("Gender")}: {patient.gender}
          </Text>
        )}
      </View>

      {/* Feature Grid */}
      <FlatList
        data={features}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => {
              stopTTS();
              navigation.navigate(item.screen);
              speak(item.name);
            }}
            onLongPress={() => speak(item.name)}
          >
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={styles.cardText}>{item.name}</Text>
            {item.badge > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>{t("logout")}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

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
  profileName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#00796b",
    marginTop: 8,
  },
  profileSub: { fontSize: 16, color: "#666", marginTop: 2 },
  card: {
    flex: 1,
    margin: 8,
    backgroundColor: "#00796b",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
    position: "relative",
  },
  icon: { fontSize: 30, marginBottom: 5 },
  cardText: { color: "white", fontSize: 16, fontWeight: "bold" },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#E53935",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  logoutBtn: {
    backgroundColor: "#d32f2f",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: "auto",
  },
  logoutText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
