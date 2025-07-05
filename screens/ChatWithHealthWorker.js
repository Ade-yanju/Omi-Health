// ChatWithHealthworker.js

import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  Modal,
  Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Video } from "expo-av";
import { useTranslation } from "react-i18next";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";

import AnimatedModal from "../components/AnimatedModal";

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
  deleteDoc,
} from "firebase/firestore";
import { firestore } from "../services/firebase";
import { getAuth } from "firebase/auth";

// ─── setup notification handler ───────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Cloudinary config ─────────────────────────────────────────────────────────
const CLOUD_NAME = "drnn7agvh";
const UPLOAD_PRESET = "mobile_preset";
const CLOUD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;
async function uploadToCloudinary(uri, type) {
  const ext = type === "image" ? "jpg" : "mp4";
  const mimeType = type === "image" ? "image/jpeg" : "video/mp4";
  const form = new FormData();
  form.append("file", { uri, name: `upload.${ext}`, type: mimeType });
  form.append("upload_preset", UPLOAD_PRESET);
  form.append("folder", "chat_media");
  const res = await fetch(CLOUD_URL, { method: "POST", body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error?.message || "Upload failed");
  return body.secure_url;
}

// ─── Main Chat Component ────────────────────────────────────────────────────────
export default function ChatWithHealthworker({ route, navigation }) {
  const { t } = useTranslation();
  const { patientId, healthworkerId } = route.params || {};
  const currentUser = getAuth().currentUser;
  const myUid = currentUser?.uid;
  const chatId =
    myUid && patientId && healthworkerId
      ? [patientId, healthworkerId].sort().join("_")
      : null;

  // ─── state ───────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [showAttachments, setShowAttachments] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modal, setModal] = useState({
    visible: false,
    message: "",
    type: "error", // "error" | "success" | "confirm"
    onConfirm: null,
  });
  const [mediaViewer, setMediaViewer] = useState({
    visible: false,
    uri: null,
    type: null,
  });

  const showModal = (message, type = "error", onConfirm = null) =>
    setModal({ visible: true, message, type, onConfirm });
  const hideModal = () =>
    setModal((m) => ({ ...m, visible: false, onConfirm: null }));

  const openMedia = (uri, type) => setMediaViewer({ visible: true, uri, type });
  const closeMedia = () =>
    setMediaViewer({ visible: false, uri: null, type: null });

  // ─── request notification permission on mount ────────────────────────────────
  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);

  // ─── ensure chat doc ──────────────────────────────────────────────────────────
  const ensureChatExists = async () => {
    if (!chatId) return;
    const ref = doc(firestore, "chats", chatId);
    if (!(await getDoc(ref)).exists()) {
      await setDoc(ref, {
        chatId,
        participants: [patientId, healthworkerId],
        status: "active",
        createdAt: serverTimestamp(),
        lastMessage: "",
        lastMessageTime: serverTimestamp(),
      });
    }
  };

  // ─── send any kind of message ─────────────────────────────────────────────────
  const sendMsg = async (data) => {
    try {
      await ensureChatExists();
      const payload = {
        ...data,
        chatId,
        senderId: myUid,
        createdAt: serverTimestamp(),
        read: false,
      };
      if (replyingTo) {
        payload.replyToId = replyingTo.id;
        payload.replyToText = replyingTo.message || "[media]";
      }
      await addDoc(collection(firestore, "messages"), payload);
      // bump lastMessage
      await setDoc(
        doc(firestore, "chats", chatId),
        {
          lastMessage: data.message
            ? data.message
            : data.imageUrl
            ? "[image]"
            : "[video]",
          lastMessageTime: serverTimestamp(),
        },
        { merge: true }
      );
      setReplyingTo(null);
    } catch (e) {
      showModal(e.message, "error");
    }
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    sendMsg({ message: input.trim() });
    setInput("");
  };

  // ─── pick & upload image/video ────────────────────────────────────────────────
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return showModal("Permission required", "error");
    }
    const { canceled, assets } = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!canceled && assets.length) {
      try {
        const url = await uploadToCloudinary(assets[0].uri, "image");
        await sendMsg({ imageUrl: url });
      } catch (e) {
        showModal(e.message, "error");
      }
    }
  };
  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return showModal("Permission required", "error");
    }
    const { canceled, assets } = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
    });
    if (!canceled && assets.length) {
      try {
        const url = await uploadToCloudinary(assets[0].uri, "video");
        await sendMsg({ videoUrl: url });
      } catch (e) {
        showModal(e.message, "error");
      }
    }
  };

  // ─── subscribe to Firestore messages & push notifications ────────────────────
  useEffect(() => {
    if (!chatId) return;
    setLoading(true);
    const q = query(
      collection(firestore, "messages"),
      where("chatId", "==", chatId),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        // notify on new incoming!
        snap.docChanges().forEach((ch) => {
          if (ch.type === "added" && ch.doc.data().senderId !== myUid) {
            const data = ch.doc.data();
            const bodyText = data.message
              ? data.message
              : data.imageUrl
              ? "📷 Image"
              : "🎥 Video";
            Notifications.scheduleNotificationAsync({
              content: {
                title: "New message",
                body: bodyText,
              },
              trigger: null,
            });
          }
        });

        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        setLoadError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [chatId]);

  if (loadError) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.error}>{loadError}</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Chat</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#00796b" />
      ) : (
        <FlatList
          data={messages}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onLongPress={() =>
                showModal("Delete this message?", "confirm", async () => {
                  await deleteDoc(doc(firestore, "messages", item.id));
                  hideModal();
                })
              }
              onPress={() => setReplyingTo(item)}
            >
              <View
                style={[
                  styles.bubble,
                  item.senderId === myUid ? styles.sent : styles.received,
                ]}
              >
                {item.replyToText && (
                  <View style={styles.replyBox}>
                    <Text style={styles.replyPreview}>{item.replyToText}</Text>
                  </View>
                )}
                {item.message && (
                  <Text style={styles.text}>{item.message}</Text>
                )}
                {item.imageUrl && (
                  <TouchableOpacity
                    onPress={() => openMedia(item.imageUrl, "image")}
                  >
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.media}
                    />
                  </TouchableOpacity>
                )}
                {item.videoUrl && (
                  <TouchableOpacity
                    onPress={() => openMedia(item.videoUrl, "video")}
                  >
                    <Video
                      source={{ uri: item.videoUrl }}
                      useNativeControls={false}
                      style={styles.media}
                      resizeMode="cover"
                    />
                    <View style={styles.playIconOverlay}>
                      <Feather
                        name="play"
                        size={32}
                        color="rgba(255,255,255,0.8)"
                      />
                    </View>
                  </TouchableOpacity>
                )}
                <Text style={styles.ts}>
                  {item.createdAt?.toDate().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 10 }}
        />
      )}

      {/* Reply banner */}
      {replyingTo && (
        <View style={styles.replyBanner}>
          <Text style={styles.replyingText}>
            Replying to:{" "}
            {replyingTo.message
              ? replyingTo.message.slice(0, 30) + "…"
              : "[media]"}
          </Text>
          <TouchableOpacity onPress={() => setReplyingTo(null)}>
            <Feather name="x" size={20} color="#444" />
          </TouchableOpacity>
        </View>
      )}

      {/* Input + attachments toggle */}
      <View style={styles.inputBar}>
        <TouchableOpacity onPress={() => setShowAttachments((v) => !v)}>
          <Feather name="plus" size={24} color="#444" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={t("type_message")}
        />
        <TouchableOpacity onPress={sendMessage}>
          <Ionicons name="send" size={24} color="#00796b" />
        </TouchableOpacity>
      </View>

      {/* Image / Video buttons */}
      {showAttachments && (
        <View style={styles.attachBar}>
          <TouchableOpacity onPress={pickImage} style={styles.attachBtn}>
            <Feather name="image" size={20} color="#00796b" />
            <Text style={styles.attachText}>Image</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={pickVideo} style={styles.attachBtn}>
            <Feather name="video" size={20} color="#00796b" />
            <Text style={styles.attachText}>Video</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Fullscreen media viewer */}
      <Modal visible={mediaViewer.visible} transparent>
        <TouchableWithoutFeedback onPress={closeMedia}>
          <View style={styles.fullscreenContainer}>
            {mediaViewer.type === "image" ? (
              <Image
                source={{ uri: mediaViewer.uri }}
                style={styles.fullscreenMedia}
                resizeMode="contain"
              />
            ) : (
              <Video
                source={{ uri: mediaViewer.uri }}
                useNativeControls
                style={styles.fullscreenMedia}
                resizeMode="contain"
              />
            )}
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <AnimatedModal
        visible={modal.visible}
        message={modal.message}
        type={modal.type}
        onClose={hideModal}
        onConfirm={modal.onConfirm}
      />
    </SafeAreaView>
  );
}

const { width, height } = Dimensions.get("window");
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8F5E9",
    padding: 10,
  },
  header: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 8,
  },
  bubble: {
    padding: 8,
    borderRadius: 8,
    marginVertical: 4,
    maxWidth: "75%",
    position: "relative",
  },
  sent: {
    backgroundColor: "#DCF8C6",
    alignSelf: "flex-end",
    borderTopRightRadius: 2,
  },
  received: {
    backgroundColor: "#fff",
    alignSelf: "flex-start",
    borderTopLeftRadius: 2,
  },
  replyBox: {
    backgroundColor: "rgba(0,0,0,0.05)",
    padding: 4,
    borderLeftWidth: 3,
    borderLeftColor: "#00796b",
    marginBottom: 4,
  },
  replyPreview: { fontStyle: "italic", color: "#555" },
  text: { fontSize: 16, color: "#000" },
  media: {
    width: 200,
    height: 140,
    borderRadius: 8,
    backgroundColor: "#000",
    marginTop: 4,
  },
  playIconOverlay: {
    position: "absolute",
    top: "40%",
    left: "40%",
  },
  ts: {
    fontSize: 10,
    color: "#444",
    alignSelf: "flex-end",
    marginTop: 4,
  },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF9C4",
    padding: 8,
  },
  replyingText: { flex: 1, fontStyle: "italic", color: "#333" },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#ccc",
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 6,
  },
  input: { flex: 1, marginHorizontal: 8, height: 40 },
  attachBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#eee",
    padding: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  attachBtn: { flexDirection: "row", alignItems: "center" },
  attachText: { marginLeft: 4, fontWeight: "bold", color: "#00796b" },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenMedia: {
    width: width - 20,
    height: height - 100,
  },
  error: { color: "red", textAlign: "center", marginVertical: 20 },
  backBtn: {
    backgroundColor: "#00796b",
    padding: 10,
    borderRadius: 6,
    alignSelf: "center",
  },
  backBtnText: { color: "#fff" },
});
