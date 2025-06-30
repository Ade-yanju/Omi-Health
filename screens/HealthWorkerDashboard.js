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
import { onSnapshot, doc, getFirestore, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const features = [
  {
    id: "1",
    name: "Book Appointments",
    screen: "HealthWorkerAppointments",
    icon: "📅",
  },
  { id: "2", name: "Chat With Patient", screen: "ChatWithPatient", icon: "💬" },
];

const HealthWorkerDashboard = ({ navigation }) => {
  const { t } = useTranslation();
  const [healthWorker, setHealthWorker] = useState(null);
  const [loading, setLoading] = useState(true);

  const auth = getAuth();
  const db = getFirestore();
  const storage = getStorage();

  const speak = (msg) => {
    Speech.speak(msg, {
      language: t("lang_code") === "yo" ? "yo" : "en-US",
      pitch: 1,
      rate: 1,
    });
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const ref = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(ref, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.role === "healthworker") {
          setHealthWorker(data);
          speak(`${t("welcome_back")} ${data.name}`);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleFeaturePress = (featureName) => {
    speak(t("feature_selected", { feature: t(featureName) }));
  };

  const pickImageAndUpload = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission denied",
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
      } catch (error) {
        console.error("Upload failed", error);
        Alert.alert("Error", "Failed to upload profile picture.");
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#00796b" />
      </SafeAreaView>
    );
    const navigateToChat = async () => {
      try {
        const user = auth.currentUser;
        if (!user || !healthWorker) {
          Alert.alert("Error", "User information not available.");
          return;
        }
        const chatId = `${user.uid}_patient`; // You can make this more specific if needed
        console.log("Navigating to patient chat:", {
          chatId,
          userId: user.uid,
          healthWorkerName: healthWorker.name,
        });
        navigation.navigate("ChatWithPatient", {
          chatId,
          userId: user.uid,
          healthWorkerName: healthWorker.name,
        });
      } catch (error) {
        console.error("Chat navigation error:", error);
        Alert.alert("Error", "Failed to navigate to chat.");
      }
    };
  }

  return (
    <SafeAreaView style={styles.container}>
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
          {healthWorker?.specialty} | {t("experience")}:{" "}
          {healthWorker?.experience} {t("years")}
        </Text>
      </View>

      <FlatList
        data={features}
        numColumns={2}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => {
              handleFeaturePress(item.name);
              if (item.screen === "ChatWithPatient") {
                navigateToChat();
              } else {
                navigation.navigate(item.screen);
              }
            }}
          >
            <Text style={styles.emoji}>{item.icon}</Text>
            <Text style={styles.cardText}>{t(item.name)}</Text>
          </TouchableOpacity>
        )}
      />
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
  },
  emoji: { fontSize: 30, marginBottom: 5 },
  cardText: { color: "white", fontSize: 16, fontWeight: "bold" },
});

export default HealthWorkerDashboard;
