// HealthWorkerDashboard.js

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Speech from "expo-speech";
import * as ImagePicker from "expo-image-picker";
import {
  onSnapshot,
  doc,
  getFirestore,
  updateDoc,
  collection,
  query,
  where,
} from "firebase/firestore";
import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../services/supabase";

const features = [
  {
    id: "1",
    name: "Appointments",
    screen: "HealthWorkerAppointments",
    icon: "📅",
    badge: "appointmentBadge",
  },
  {
    id: "2",
    name: "Chat Inbox",
    screen: "ChatInbox",
    icon: "💬",
    badge: "chatBadge",
  },
];

export default function HealthWorkerDashboard(props) {
  const { t } = useTranslation();
  const [healthWorker, setHealthWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appointmentBadge, setAppointmentBadge] = useState(0);
  const [chatBadge, setChatBadge] = useState(0);

  const auth = getAuth();
  const db = getFirestore();
  const navigation = props.navigation || useNavigation();

  // ensure we only speak once
  const ttsHasRun = useRef(false);

  // Speak dashboard summary once
  useEffect(() => {
    if (healthWorker && !ttsHasRun.current) {
      const msg = `${t("welcome_back")} ${healthWorker.name}. ${t(
        "dashboard_overview",
        { appointments: appointmentBadge, messages: chatBadge }
      )}`;
      Speech.speak(msg, {
        language: t("lang_code") === "yo" ? "yo" : "en-US",
        pitch: 1,
        rate: 1,
      });
      ttsHasRun.current = true;
    }
  }, [healthWorker, appointmentBadge, chatBadge]);

  // Auth listener & load profile
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
      }
    });

    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
      return unsubAuth;
    }

    const userRef = doc(db, "users", user.uid);
    const unsubUser = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.role === "healthworker") {
          setHealthWorker({ id: user.uid, ...data });
        } else {
          signOut(auth).finally(() =>
            navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] })
          );
        }
      }
      setLoading(false);
    });

    return () => {
      unsubAuth();
      unsubUser();
    };
  }, [auth, db, navigation]);

  // Real-time badges
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Appointments badge
    const apptQ = query(
      collection(db, "appointments"),
      where("healthworkerId", "==", user.uid),
      where("status", "in", ["pending", "scheduled_by_patient"])
    );
    const unsubAppts = onSnapshot(apptQ, (snap) => {
      setAppointmentBadge(snap.size);
    });

    // Chat badge (only if participant)
    const chatQ = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid),
      where("unreadForHealthWorker", ">", 0)
    );
    const unsubChats = onSnapshot(chatQ, (snap) => {
      let cnt = 0;
      snap.forEach((d) => {
        cnt += d.data().unreadForHealthWorker || 0;
      });
      setChatBadge(cnt);
    });

    return () => {
      unsubAppts();
      unsubChats();
    };
  }, [auth, db]);

  // Profile pic upload via Supabase
  const pickImageAndUpload = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission Required", "Media library access is required.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (res.canceled) return;

      const uri = res.assets[0].uri;
      const blob = await (await fetch(uri)).blob();
      const ext = uri.split(".").pop();
      const fileName = `${auth.currentUser.uid}.${ext}`;

      const { error } = await supabase.storage
        .from("profile-pictures")
        .upload(fileName, blob, { upsert: true });
      if (error) throw error;

      const { data } = supabase.storage
        .from("profile-pictures")
        .getPublicUrl(fileName);

      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        profilePic: data.publicUrl,
      });
    } catch (e) {
      console.error("Upload failed", e);
      Alert.alert("Upload Error", "Could not upload profile picture.");
    }
  };

  // Navigate to ChatInbox
  const navigateToChat = () => {
    const user = auth.currentUser;
    if (!user || !healthWorker) {
      Alert.alert("Error", "User info not available.");
      return;
    }
    navigation.navigate("ChatInbox", {
      userId: user.uid,
      healthWorkerName: healthWorker.name,
    });
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
    } catch (e) {
      console.error("Logout failed", e);
      Alert.alert("Logout Failed", "Unable to logout right now.");
    }
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={pickImageAndUpload}>
            {healthWorker?.profilePic ? (
              <Image
                source={{ uri: healthWorker.profilePic }}
                style={styles.profileImage}
              />
            ) : (
              <View style={[styles.profileImage, styles.nullProfile]}>
                <Text style={{ fontSize: 30, color: "#fff" }}>👤</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.profileText}>{healthWorker?.name}</Text>
          <Text style={styles.profileSubText}>
            {healthWorker?.specialization} | {t("experience")}:{" "}
            {healthWorker?.yearsExperience} {t("years")}
          </Text>
        </View>

        {/* Feature Cards */}
        <FlatList
          data={features}
          numColumns={2}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <TouchableOpacity
                style={styles.card}
                onPress={() =>
                  item.screen === "ChatInbox"
                    ? navigateToChat()
                    : navigation.navigate(item.screen)
                }
              >
                <Text style={styles.emoji}>{item.icon}</Text>
                <Text style={styles.cardText}>{t(item.name)}</Text>
                {item.badge === "appointmentBadge" && appointmentBadge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {appointmentBadge > 99 ? "99+" : appointmentBadge}
                    </Text>
                  </View>
                )}
                {item.badge === "chatBadge" && chatBadge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {chatBadge > 99 ? "99+" : chatBadge}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}
          ListFooterComponent={<View style={{ height: 80 }} />}
        />

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>{t("Logout") || "Logout"}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
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
  profileText: { fontSize: 22, fontWeight: "bold", color: "#00796b" },
  profileSubText: { fontSize: 14, color: "#555" },
  card: {
    flex: 1,
    margin: 10,
    backgroundColor: "#00796b",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
    position: "relative",
    minWidth: 120,
    minHeight: 90,
    justifyContent: "center",
  },
  emoji: { fontSize: 30, marginBottom: 5 },
  cardText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  badge: {
    position: "absolute",
    top: 7,
    right: 18,
    backgroundColor: "red",
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    zIndex: 3,
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  logoutBtn: {
    backgroundColor: "#D32F2F",
    borderRadius: 10,
    padding: 15,
    marginTop: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoutText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  loading: { textAlign: "center", marginTop: 15 },
});
