import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { WebView } from "react-native-webview";

import { firestore, storage } from "../services/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  addDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const ChatWithPatient = ({ route }) => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { chatId, userId, healthWorkerName } = route.params;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isTTSMuted, setIsTTSMuted] = useState(false);
  const [showJitsi, setShowJitsi] = useState(false);

  useEffect(() => {
    Speech.setDefaultRate(0.5);
    Speech.setDefaultLanguage("en");

    const msgQuery = query(
      collection(firestore, "messages"),
      where("chatId", "==", chatId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(msgQuery, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [chatId]);

  const speak = (text) => {
    if (!isTTSMuted && text) {
      Speech.speak(text, {
        language: t("lang_code") === "yo" ? "yo" : "en-US",
      });
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    await addDoc(collection(firestore, "messages"), {
      chatId,
      senderId: userId,
      message: input,
      createdAt: serverTimestamp(),
    });
    speak(input);
    setInput("");
  };

  const startRecording = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== "granted") return alert(t("mic_permission"));

    const newRecording = new Audio.Recording();
    await newRecording.prepareToRecordAsync(
      Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
    );
    await newRecording.startAsync();
    setRecording(newRecording);
    speak(t("recording_started"));
  };

  const stopRecording = async () => {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    const response = await fetch(uri);
    const blob = await response.blob();

    const filename = `${Date.now()}.m4a`;
    const audioRef = ref(storage, `audios/${filename}`);
    await uploadBytes(audioRef, blob);
    const downloadURL = await getDownloadURL(audioRef);

    await addDoc(collection(firestore, "messages"), {
      chatId,
      senderId: userId,
      audioUrl: downloadURL,
      createdAt: serverTimestamp(),
    });

    setRecording(null);
    speak(t("recording_stopped"));
  };

  const playAudio = async (url) => {
    const { sound } = await Audio.Sound.createAsync({ uri: url });
    await sound.playAsync();
    speak(t("playing_audio"));
  };

  const toggleTTSMute = () => {
    const newStatus = !isTTSMuted;
    setIsTTSMuted(newStatus);
    speak(newStatus ? t("tts_muted") : t("tts_unmuted"));
  };

  const startVideoCall = () => {
    speak(t("video_call_started"));
    setShowJitsi(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#00796b" />
      </SafeAreaView>
    );
  }

  if (showJitsi) {
    return (
      <WebView
        source={{
          uri: `https://meet.jit.si/${chatId}#userInfo.displayName="${encodeURIComponent(
            healthWorkerName
          )}"`,
        }}
        style={{ flex: 1 }}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>
        {t("chat_with")} {healthWorkerName}
      </Text>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        inverted
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageBubble,
              item.senderId === userId ? styles.sent : styles.received,
            ]}
          >
            {item.message && (
              <Text style={styles.messageText}>{item.message}</Text>
            )}
            {item.audioUrl && (
              <TouchableOpacity onPress={() => playAudio(item.audioUrl)}>
                <Text style={styles.audioPlayText}>{t("play_audio")}</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.timestamp}>
              {item.createdAt?.toDate().toLocaleTimeString() || ""}
            </Text>
          </View>
        )}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={t("type_message")}
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendText}>{t("send")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.recordButton}
          onPress={recording ? stopRecording : startRecording}
        >
          <Text style={styles.recordText}>
            {recording ? t("stop") : t("record")}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toggleSection}>
        <TouchableOpacity
          style={styles.toggleTTSButton}
          onPress={toggleTTSMute}
        >
          <Text style={styles.toggleTTSButtonText}>
            {isTTSMuted ? t("unmute_tts") : t("mute_tts")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.videoButton} onPress={startVideoCall}>
          <Text style={styles.videoButtonText}>{t("start_video_call")}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E8F5E9", padding: 10 },
  header: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    color: "#00796b",
    marginBottom: 10,
  },
  messageBubble: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 5,
    maxWidth: "80%",
  },
  sent: {
    alignSelf: "flex-end",
    backgroundColor: "#00796b",
  },
  received: {
    alignSelf: "flex-start",
    backgroundColor: "#A5D6A7",
  },
  messageText: { color: "white", fontSize: 16 },
  timestamp: { fontSize: 12, color: "gray", alignSelf: "flex-end" },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "white",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#00796b",
  },
  sendButton: {
    backgroundColor: "#00796b",
    padding: 10,
    borderRadius: 10,
    marginLeft: 5,
  },
  sendText: { color: "white", fontWeight: "bold" },
  recordButton: {
    backgroundColor: "#d32f2f",
    padding: 10,
    borderRadius: 10,
    marginLeft: 5,
  },
  recordText: { color: "white", fontWeight: "bold" },
  audioPlayText: {
    color: "blue",
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 5,
  },
  toggleSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  toggleTTSButton: {
    backgroundColor: "#0288D1",
    padding: 10,
    borderRadius: 10,
  },
  toggleTTSButtonText: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
  videoButton: {
    backgroundColor: "#4CAF50",
    padding: 10,
    borderRadius: 10,
  },
  videoButtonText: { color: "white", fontWeight: "bold" },
});

export default ChatWithPatient;
