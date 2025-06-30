import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Audio, Video } from "expo-av";
import { useTranslation } from "react-i18next";
import * as FileSystem from "expo-file-system";
import { base64StringToBlob } from "blob-util";
import {
  collection,
  query,
  where,
  orderBy,
  addDoc,
  onSnapshot,
  serverTimestamp,
  getDoc,
  setDoc,
  doc,
} from "firebase/firestore";
import { firestore } from "../services/firebase";
import { supabase } from "../services/supabase";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { getAuth } from "firebase/auth";

// Deterministic chat ID (alphabetical)
const getChatId = (a, b) => [a, b].sort().join("_");

// Fetch user profile
const fetchUserProfile = async (uid) => {
  if (!uid) return null;
  try {
    const userDoc = await getDoc(doc(firestore, "users", uid));
    if (userDoc.exists()) return { ...userDoc.data(), id: uid };
    return null;
  } catch (e) {
    console.error(`Error fetching user profile for ${uid}:`, e);
    return null;
  }
};

// Ensure chat exists in Firestore
const ensureChatExists = async (chatId, uid1, uid2) => {
  const chatRef = doc(firestore, "chats", chatId);
  const chatDoc = await getDoc(chatRef);
  if (!chatDoc.exists()) {
    await setDoc(chatRef, {
      chatId,
      members: [uid1, uid2], // Match your Firestore rules!
      status: "active",
      createdAt: serverTimestamp(),
      lastMessage: "",
      lastMessageTime: serverTimestamp(),
    });
  }
};

const ChatWithPatient = ({ route, navigation }) => {
  const { t } = useTranslation();
  const params = route?.params ?? {};

  const patientId = params.patientId;
  const healthworkerId = params.healthworkerId;

  const currentUser = getAuth().currentUser;
  const myUid = currentUser?.uid || null;

  const otherUid = myUid === patientId ? healthworkerId : patientId;
  const chatId =
    patientId && healthworkerId ? getChatId(patientId, healthworkerId) : null;

  const [myProfile, setMyProfile] = useState(null);
  const [otherProfile, setOtherProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showAttachments, setShowAttachments] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [recording, setRecording] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Helper to read local files as Blob
  const uriToBlob = async (uri, mimeType) => {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64StringToBlob(base64, mimeType);
  };

  // --- Upload to Supabase Storage ---
  const uploadToSupabase = useCallback(
    async (typeFolder, fileUri, fileName, isAudio = false) => {
      try {
        if (!supabase || !supabase.storage) {
          throw new Error("Supabase client is not initialized.");
        }
        if (!myUid) throw new Error("User not authenticated.");
        const folder =
          typeFolder === "images"
            ? "images"
            : typeFolder === "videos"
            ? "videos"
            : "audios";
        const path = `${folder}/${myUid}_${Date.now()}_${fileName}`;

        // Convert the local file to Blob using base64
        const mime =
          typeFolder === "images"
            ? "image/jpeg"
            : typeFolder === "videos"
            ? "video/mp4"
            : "audio/m4a";
        const blob = await uriToBlob(fileUri, mime);

        const { error } = await supabase.storage
          .from("chat-media")
          .upload(path, blob, {
            cacheControl: "3600",
            contentType: mime,
            upsert: false,
          });
        if (error) throw error;
        const { data } = supabase.storage.from("chat-media").getPublicUrl(path);
        if (!data || !data.publicUrl)
          throw new Error("Failed to get public URL after upload.");

        return data.publicUrl;
      } catch (error) {
        console.error("Supabase upload error:", error);
        Alert.alert(
          "Upload Failed",
          error.message || "Network request failed."
        );
        return null;
      }
    },
    [myUid]
  );

  // Pick image
  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission Denied", "Image library access required.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.length > 0 && myUid) {
        const asset = result.assets[0];
        const uri = asset.uri;
        const fileName = uri.split("/").pop() || "image.jpg";
        const publicUrl = await uploadToSupabase("images", uri, fileName);
        if (publicUrl) {
          await safeAddMessage({ imageUrl: publicUrl });
        }
      }
    } catch (e) {
      Alert.alert("Image Upload Failed", e.message);
    }
  };

  // Pick video
  const pickVideo = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission Denied", "Video library access required.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length > 0 && myUid) {
        const asset = result.assets[0];
        const uri = asset.uri;
        const fileName = uri.split("/").pop() || "video.mp4";
        const publicUrl = await uploadToSupabase("videos", uri, fileName);
        if (publicUrl) {
          await safeAddMessage({ videoUrl: publicUrl });
        }
      }
    } catch (e) {
      Alert.alert("Video Upload Failed", e.message);
    }
  };

  // Audio recording
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Microphone permission denied.");
        return;
      }
      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
      await newRecording.startAsync();
      setRecording(newRecording);
      setRecordingDuration(0);
      const intervalId = setInterval(async () => {
        const status = await newRecording.getStatusAsync();
        if (status.isRecording) {
          setRecordingDuration(Math.floor(status.durationMillis / 1000));
        } else {
          clearInterval(intervalId);
        }
      }, 1000);
    } catch (err) {
      Alert.alert("Recording error", "Failed to start recording.");
    }
  };

  const stopRecording = async () => {
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const fileName = "audio.m4a";
      const publicUrl = await uploadToSupabase("audios", uri, fileName, true);
      if (publicUrl) {
        await safeAddMessage({ audioUrl: publicUrl });
      }
    } catch (err) {
      Alert.alert("Recording error", "Recording upload failed");
    } finally {
      setRecording(null);
    }
  };

  // Audio playback
  const playAudio = async (url) => {
    const { sound } = await Audio.Sound.createAsync({ uri: url });
    await sound.playAsync();
  };

  // Send message to Firestore
  const safeAddMessage = async (data) => {
    try {
      await ensureChatExists(chatId, patientId, healthworkerId);
      await addDoc(collection(firestore, "messages"), {
        ...data,
        chatId,
        senderId: myUid,
        createdAt: serverTimestamp(),
        read: false,
      });
      await setDoc(
        doc(firestore, "chats", chatId),
        {
          lastMessage: data.message
            ? data.message
            : data.imageUrl
            ? "[image]"
            : data.videoUrl
            ? "[video]"
            : data.audioUrl
            ? "[audio]"
            : "[media]",
          lastMessageTime: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      Alert.alert("Send Failed", e.message || "Could not send message");
      throw e;
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !myUid || !chatId) return;
    await safeAddMessage({ message: input.trim() });
    setInput("");
  };

  // Profiles/messages loading
  useEffect(() => {
    if (!myUid || !patientId || !healthworkerId) return;
    fetchUserProfile(myUid).then(setMyProfile);
    fetchUserProfile(otherUid).then(setOtherProfile);
  }, [myUid, patientId, healthworkerId]);

  useEffect(() => {
    if (!chatId || !myUid || !patientId || !healthworkerId) return;
    ensureChatExists(chatId, patientId, healthworkerId).catch((e) =>
      setLoadError("Error creating chat: " + e.message)
    );
  }, [chatId, myUid, patientId, healthworkerId]);

  useEffect(() => {
    if (!chatId) return;
    setLoading(true);
    const msgQuery = query(
      collection(firestore, "messages"),
      where("chatId", "==", chatId),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(
      msgQuery,
      (snapshot) => {
        const arr = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setMessages(arr);
        setLoading(false);
      },
      (error) => {
        setLoadError("Permission error: " + error.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [chatId]);

  // --- UI: Error and loading ---
  if (loadError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity
            style={styles.goBackButton}
            onPress={() => navigation.goBack?.()}
          >
            <Text style={styles.goBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  if (
    !chatId ||
    !myUid ||
    !patientId ||
    !healthworkerId ||
    !myProfile ||
    !otherProfile
  ) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#00796b" />
        <Text style={{ textAlign: "center", marginTop: 15 }}>
          Loading chat...
        </Text>
      </SafeAreaView>
    );
  }

  // --- Main Chat UI ---
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.header}>
          Chat:{" "}
          {myProfile?.role === "healthworker"
            ? `${myProfile?.name || "Healthworker"} ↔ ${
                otherProfile?.name || "Patient"
              }`
            : `${otherProfile?.name || "Healthworker"} ↔ ${
                myProfile?.name || "Patient"
              }`}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#00796b" />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          inverted
          renderItem={({ item }) => (
            <View
              style={[
                styles.messageBubble,
                item.senderId === myUid ? styles.sent : styles.received,
              ]}
            >
              {item.message && (
                <Text style={styles.messageText}>{item.message}</Text>
              )}
              {item.imageUrl && (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={{
                    width: 180,
                    height: 130,
                    marginTop: 5,
                    borderRadius: 8,
                  }}
                  resizeMode="cover"
                />
              )}
              {item.videoUrl && (
                <Video
                  source={{ uri: item.videoUrl }}
                  useNativeControls
                  style={{ width: 200, height: 140, marginTop: 5 }}
                  resizeMode="contain"
                />
              )}
              {item.audioUrl && (
                <TouchableOpacity onPress={() => playAudio(item.audioUrl)}>
                  <Text style={styles.audioPlayText}>▶ Audio</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.timestamp}>
                {item.createdAt?.toDate?.().toLocaleTimeString?.() || ""}
              </Text>
            </View>
          )}
        />
      )}
      {/* Input/controls */}
      <View style={styles.bottomBar}>
        <TouchableOpacity onPress={() => setShowAttachments(!showAttachments)}>
          <Feather
            name="plus"
            size={24}
            color="#444"
            style={{ marginRight: 8 }}
          />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={t("type_message")}
        />
        {recording ? (
          <TouchableOpacity onPress={stopRecording}>
            <MaterialCommunityIcons name="stop" size={24} color="red" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={startRecording}>
            <Feather name="mic" size={24} color="#00796b" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={sendMessage}>
          <Ionicons
            name="send"
            size={24}
            color="#00796b"
            style={{ marginLeft: 10 }}
          />
        </TouchableOpacity>
      </View>
      {recording && (
        <Text style={styles.recordingStatus}>
          🎙 Recording... {recordingDuration}s
        </Text>
      )}
      {showAttachments && (
        <View style={styles.attachmentBar}>
          <TouchableOpacity onPress={pickImage}>
            <Text style={styles.attachText}>📷 Image</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={pickVideo}>
            <Text style={styles.attachText}>🎥 Video</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E8F5E9", padding: 10 },
  headerContainer: { alignItems: "center", marginBottom: 6 },
  header: { fontSize: 18, fontWeight: "bold", color: "#00796b" },
  messageBubble: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 5,
    maxWidth: "80%",
  },
  sent: { alignSelf: "flex-end", backgroundColor: "#00796b" },
  received: { alignSelf: "flex-start", backgroundColor: "#A5D6A7" },
  messageText: { color: "white", fontSize: 16 },
  timestamp: { fontSize: 12, color: "gray", alignSelf: "flex-end" },
  audioPlayText: { color: "white", fontWeight: "bold", marginTop: 6 },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    backgroundColor: "#fff",
    borderRadius: 25,
    borderColor: "#00796b",
    borderWidth: 1,
    marginTop: 10,
  },
  input: { flex: 1, padding: 10, borderRadius: 20, fontSize: 16 },
  recordingStatus: {
    color: "#d32f2f",
    textAlign: "center",
    marginTop: 6,
    fontWeight: "bold",
  },
  attachmentBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#eee",
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  attachText: { fontSize: 16, fontWeight: "bold", color: "#00796b" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: {
    color: "red",
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 8,
  },
  goBackButton: {
    backgroundColor: "#00796b",
    padding: 10,
    borderRadius: 6,
    marginTop: 8,
    minWidth: 120,
  },
  goBackText: { color: "white", textAlign: "center" },
});

export default ChatWithPatient;
