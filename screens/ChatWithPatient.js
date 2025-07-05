// ChatWithPatient.js

import React, { useState, useEffect } from "react";
import {
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
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Video } from "expo-av";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";

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

// Cloudinary config
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

const getChatId = (a, b) => [a, b].sort().join("_");
const fetchUserProfile = async (uid) => {
  const snap = await getDoc(doc(firestore, "users", uid));
  return snap.exists() ? { id: uid, ...snap.data() } : null;
};
const ensureChatExists = async (chatId, u1, u2) => {
  const ref = doc(firestore, "chats", chatId);
  if (!(await getDoc(ref)).exists()) {
    await setDoc(ref, {
      chatId,
      participants: [u1, u2],
      status: "active",
      createdAt: serverTimestamp(),
      lastMessage: "",
      lastMessageTime: serverTimestamp(),
    });
  }
};

export default function ChatWithPatient({ route, navigation }) {
  const { t } = useTranslation();
  const { patientId, healthworkerId } = route.params || {};
  const auth = getAuth();
  const myUid = auth.currentUser?.uid;
  const otherUid = myUid === patientId ? healthworkerId : patientId;
  const chatId =
    patientId && healthworkerId ? getChatId(patientId, healthworkerId) : null;

  // ─── state ─────────────────────────────────────────
  const [myProfile, setMyProfile] = useState(null);
  const [otherProfile, setOtherProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [showAttachments, setShowAttachments] = useState(false);
  const [loading, setLoading] = useState(true);

  // modal: for both errors and confirm dialogs
  const [modal, setModal] = useState({
    visible: false,
    message: "",
    type: "error", // "error" or "confirm"
    onConfirm: null, // callback if type==="confirm"
  });
  const showModal = (message, type = "error", onConfirm = null) =>
    setModal({ visible: true, message, type, onConfirm });
  const hideModal = () =>
    setModal((m) => ({ ...m, visible: false, onConfirm: null }));

  // fullscreen media viewer
  const [mediaViewer, setMediaViewer] = useState({
    visible: false,
    uri: null,
    type: null,
  });
  const openMedia = (uri, type) => setMediaViewer({ visible: true, uri, type });
  const closeMedia = () =>
    setMediaViewer({ visible: false, uri: null, type: null });

  // ─── add / reply / upload ────────────────────────────
  const safeAddMessage = async (data) => {
    await ensureChatExists(chatId, patientId, healthworkerId);
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
  };
  const sendMessage = () => {
    if (!input.trim()) return;
    safeAddMessage({ message: input.trim() }).catch((e) =>
      showModal(e.message, "error")
    );
    setInput("");
  };
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return showModal("Permission Denied", "error");
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!res.canceled && res.assets.length) {
      try {
        const url = await uploadToCloudinary(res.assets[0].uri, "image");
        await safeAddMessage({ imageUrl: url });
      } catch (e) {
        showModal(e.message, "error");
      }
    }
  };
  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return showModal("Permission Denied", "error");
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
    });
    if (!res.canceled && res.assets.length) {
      try {
        const url = await uploadToCloudinary(res.assets[0].uri, "video");
        await safeAddMessage({ videoUrl: url });
      } catch (e) {
        showModal(e.message, "error");
      }
    }
  };

  // ─── load profiles ─────────────────────────────────────
  useEffect(() => {
    if (!myUid) return;
    fetchUserProfile(myUid).then(setMyProfile);
    fetchUserProfile(otherUid).then(setOtherProfile);
  }, [myUid, otherUid]);

  // ─── subscribe to messages ─────────────────────────────
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
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        showModal(err.message, "error");
        setLoading(false);
      }
    );
    return () => unsub();
  }, [chatId]);

  // ─── delete via confirm modal ─────────────────────────
  const promptDelete = (msg) => {
    showModal("Delete this message?", "confirm", async () => {
      try {
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
        await deleteDoc(doc(firestore, "messages", msg.id));
      } catch (e) {
        showModal(e.message, "error");
      } finally {
        hideModal();
      }
    });
  };

  // ─── render each bubble ─────────────────────────────────
  const renderItem = ({ item }) => (
    <TouchableOpacity
      key={item.id}
      onLongPress={() => promptDelete(item)}
      onPress={() => setReplyingTo(item)}
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
      {item.message && <Text style={styles.text}>{item.message}</Text>}
      {item.imageUrl && (
        <TouchableOpacity onPress={() => openMedia(item.imageUrl, "image")}>
          <Image source={{ uri: item.imageUrl }} style={styles.media} />
        </TouchableOpacity>
      )}
      {item.videoUrl && (
        <TouchableOpacity onPress={() => openMedia(item.videoUrl, "video")}>
          <Video
            source={{ uri: item.videoUrl }}
            useNativeControls={false}
            style={styles.media}
            resizeMode="cover"
          />
          <View style={styles.playIconOverlay}>
            <Feather name="play" size={32} color="#fff" />
          </View>
        </TouchableOpacity>
      )}
      <Text style={styles.ts}>
        {item.createdAt?.toDate().toLocaleTimeString()}
      </Text>
    </TouchableOpacity>
  );

  // ─── loading stub ───────────────────────────────────────
  if (loading || !myProfile || !otherProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#128C7E" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={(i) => i.id}
        inverted
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 10 }}
      />

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
          <Feather name="send" size={24} color="#128C7E" />
        </TouchableOpacity>
      </View>

      {showAttachments && (
        <View style={styles.attachBar}>
          <TouchableOpacity onPress={pickImage}>
            <Text style={styles.attachText}>📷 Image</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={pickVideo}>
            <Text style={styles.attachText}>🎥 Video</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Fullscreen media modal */}
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
    backgroundColor: "#ECE5DD",
    padding: 8,
  },
  bubble: {
    padding: 8,
    borderRadius: 16,
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
    borderLeftColor: "#128C7E",
    marginBottom: 4,
  },
  replyPreview: { color: "#555", fontStyle: "italic" },
  text: { color: "#000", fontSize: 16 },
  media: {
    width: 180,
    height: 120,
    marginTop: 6,
    borderRadius: 8,
    backgroundColor: "#000",
  },
  playIconOverlay: {
    position: "absolute",
    top: "40%",
    left: "40%",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 24,
    padding: 4,
  },
  ts: {
    fontSize: 10,
    color: "#666",
    alignSelf: "flex-end",
    marginTop: 4,
  },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF8E1",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  replyingText: { flex: 1, color: "#333", fontStyle: "italic" },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 6,
    marginTop: 8,
  },
  input: { flex: 1, marginHorizontal: 8, height: 40, fontSize: 16 },
  attachBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#f0f0f0",
    padding: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  attachText: { fontWeight: "600", color: "#128C7E" },
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
});
