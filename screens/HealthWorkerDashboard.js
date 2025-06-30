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
import { useNavigation } from "@react-navigation/native"; // <-- Use this for navigation safety
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

const HealthWorkerDashboard = (props) => {
  const { t } = useTranslation();
  const [healthWorker, setHealthWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appointmentBadge, setAppointmentBadge] = useState(0);
  const [chatBadge, setChatBadge] = useState(0);

  const auth = getAuth();
  const db = getFirestore();
  const navigation = props.navigation || useNavigation(); // Always works

  const ttsHasRun = useRef(false);

  // Welcome with TTS
  useEffect(() => {
    if (healthWorker && !ttsHasRun.current) {
      const dashboardText = `${t("welcome_back")} ${healthWorker.name}. ${t(
        "dashboard_overview",
        {
          appointments: appointmentBadge,
          messages: chatBadge,
        }
      )}`;
      Speech.speak(dashboardText, {
        language: t("lang_code") === "yo" ? "yo" : "en-US",
        pitch: 1,
        rate: 1,
      });
      ttsHasRun.current = true;
    }
  }, [healthWorker, t, appointmentBadge, chatBadge]);

  // Listen for user profile and auth status
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // No user: go to login screen
        navigation.reset({
          index: 0,
          routes: [{ name: "Login" }], // Update route name to match your navigator!
        });
      }
    });

    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
      return () => unsubscribeAuth();
    }

    const ref = doc(db, "users", user.uid);
    const unsubscribeUser = onSnapshot(ref, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.role === "healthworker") {
          setHealthWorker(data);
        } else {
          // Not a healthworker; sign out and redirect
          signOut(auth).finally(() =>
            navigation.reset({ index: 0, routes: [{ name: "Login" }] })
          );
        }
      } else {
        setHealthWorker(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeUser();
    };
  }, [db, auth, navigation]);

  // Real-time notification badges
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Appointment badge
    const apptQ = query(
      collection(db, "appointments"),
      where("healthworkerId", "==", user.uid),
      where("status", "in", ["pending", "scheduled_by_patient"])
    );
    const unsubAppointments = onSnapshot(apptQ, (snap) => {
      setAppointmentBadge(snap.size);
    });

    // Chat badge (sum unread)
    const chatQ = query(
      collection(db, "chats"),
      where("healthworkerId", "==", user.uid),
      where("unreadForHealthWorker", ">", 0)
    );
    const unsubChats = onSnapshot(chatQ, (snap) => {
      let unread = 0;
      snap.forEach((doc) => {
        unread += doc.data().unreadForHealthWorker || 0;
      });
      setChatBadge(unread);
    });

    return () => {
      unsubAppointments();
      unsubChats();
    };
  }, [db, auth]);

  // Profile picture upload
  const pickImageAndUpload = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Permission to access media library is required."
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled) {
        const user = auth.currentUser;
        if (!user) throw new Error("Not signed in");
        const imageUri = result.assets[0].uri;
        const imageResponse = await fetch(imageUri);
        const imageBlob = await imageResponse.blob();
        const fileExt = imageUri.split(".").pop();
        const fileName = `${user.uid}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("profile-pictures")
          .upload(fileName, imageBlob, { upsert: true });
        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("profile-pictures")
          .getPublicUrl(fileName);

        await updateDoc(doc(db, "users", user.uid), {
          profilePic: data.publicUrl,
        });
      }
    } catch (error) {
      console.error("Supabase upload failed", error);
      Alert.alert("Upload Error", "Failed to upload profile picture.");
    }
  };

  const navigateToChat = async () => {
    try {
      const user = auth.currentUser;
      if (!user || !healthWorker) {
        Alert.alert("Error", "User information not available.");
        return;
      }
      navigation.navigate("ChatInbox", {
        userId: user.uid,
        healthWorkerName: healthWorker.name,
      });
    } catch (error) {
      console.error("Chat navigation error:", error);
      Alert.alert("Navigation Error", "Failed to navigate to chat.");
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    } catch (e) {
      Alert.alert("Logout Failed", "Unable to logout at this time.");
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
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
        <FlatList
          data={features}
          numColumns={2}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <TouchableOpacity
                style={styles.card}
                onPress={() => {
                  if (item.screen === "ChatInbox") {
                    navigateToChat();
                  } else {
                    navigation.navigate(item.screen);
                  }
                }}
              >
                <Text style={styles.emoji}>{item.icon}</Text>
                <Text style={styles.cardText}>{t(item.name)}</Text>
                {/* Notification badge */}
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
          ListFooterComponent={
            <View style={{ height: 80 }} /> // Space for the logout button at the bottom
          }
        />
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>{t("Logout") || "Logout"}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
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
  cardText: { color: "white", fontSize: 16, fontWeight: "bold" },
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
  badgeText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
  },
  logoutBtn: {
    backgroundColor: "#D32F2F",
    borderRadius: 10,
    padding: 15,
    marginTop: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoutText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
    letterSpacing: 1.1,
  },
});

export default HealthWorkerDashboard;
