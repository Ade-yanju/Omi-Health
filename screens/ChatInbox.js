// ChatInboxScreen.js

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { firestore } from "../services/firebase";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

// Fetch a user profile by UID
const fetchUserProfile = async (uid) => {
  try {
    const userDoc = await getDoc(doc(firestore, "users", uid));
    return userDoc.exists()
      ? { id: uid, ...userDoc.data() }
      : { id: uid, name: "Unknown" };
  } catch {
    return { id: uid, name: "Unknown" };
  }
};

export default function ChatInboxScreen({ navigation }) {
  const auth = getAuth();
  const myUid = auth.currentUser?.uid;

  const [profile, setProfile] = useState(null);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadMap, setUnreadMap] = useState({});

  // keep refs to unsubscribe unread subscriptions
  const unreadUnsubs = useRef({});

  // get my own profile (to decide which chat screen to push)
  useEffect(() => {
    if (!myUid) return;
    fetchUserProfile(myUid).then(setProfile);
  }, [myUid]);

  // subscribe to all chats I'm in
  useEffect(() => {
    if (!myUid) return setLoading(false);

    setLoading(true);
    const q = query(
      collection(firestore, "chats"),
      where("participants", "array-contains", myUid)
    );
    const unsub = onSnapshot(q, async (snap) => {
      if (snap.empty) {
        setChats([]);
        setLoading(false);
        return;
      }

      // build list of chats with the other user's data
      const fetched = await Promise.all(
        snap.docs.map(async (docSnap) => {
          const chat = { id: docSnap.id, ...docSnap.data() };
          const otherUid = chat.participants.find((u) => u !== myUid);
          const otherUser = otherUid
            ? await fetchUserProfile(otherUid)
            : { id: null, name: "Unknown" };
          return {
            ...chat,
            otherUser,
            lastMessage: chat.lastMessage || "",
            lastMessageTime: chat.lastMessageTime,
          };
        })
      );

      // sort by most recent
      fetched.sort(
        (a, b) =>
          (b.lastMessageTime?.toMillis?.() || 0) -
          (a.lastMessageTime?.toMillis?.() || 0)
      );

      setChats(fetched);
      setLoading(false);
    });

    return () => unsub();
  }, [myUid]);

  // subscribe to unread counts for each chat
  useEffect(() => {
    // clean up old
    Object.values(unreadUnsubs.current).forEach((u) => u && u());
    unreadUnsubs.current = {};

    chats.forEach((chat) => {
      const qUn = query(
        collection(firestore, "messages"),
        where("chatId", "==", chat.id),
        where("read", "==", false),
        where("receiverId", "==", myUid)
      );
      unreadUnsubs.current[chat.id] = onSnapshot(qUn, (snap) => {
        setUnreadMap((m) => ({ ...m, [chat.id]: snap.size }));
      });
    });

    return () => {
      Object.values(unreadUnsubs.current).forEach((u) => u && u());
      unreadUnsubs.current = {};
    };
  }, [chats, myUid]);

  // open a chat: mark all its messages read, then navigate
  const openChat = useCallback(
    async (chat) => {
      if (!profile || !myUid) return;

      // mark unread messages as read
      const qUn = query(
        collection(firestore, "messages"),
        where("chatId", "==", chat.id),
        where("read", "==", false),
        where("receiverId", "==", myUid)
      );
      const snaps = await getDocs(qUn);
      await Promise.all(
        snaps.docs.map((d) => updateDoc(d.ref, { read: true }))
      );

      // navigate to the correct chat screen
      navigation.navigate(
        profile.role === "healthworker"
          ? "ChatWithPatient"
          : "ChatWithHealthWorker",
        {
          chatId: chat.id,
          patientId: profile.role === "patient" ? myUid : chat.otherUser.id,
          healthworkerId:
            profile.role === "healthworker" ? myUid : chat.otherUser.id,
        }
      );
    },
    [navigation, profile, myUid]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#00796b" />
          <Text style={{ color: "#00796b", marginTop: 10 }}>
            Loading chats…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const unreadCount = unreadMap[item.id] || 0;
          return (
            <TouchableOpacity
              style={styles.chatItem}
              onPress={() => openChat(item)}
            >
              {item.otherUser.profilePic ? (
                <Image
                  source={{ uri: item.otherUser.profilePic }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={28} color="#555" />
                </View>
              )}
              <View style={styles.chatTextArea}>
                <Text style={styles.nameText}>{item.otherUser.name}</Text>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.lastMessage}
                </Text>
              </View>
              <View style={styles.metaArea}>
                {item.lastMessageTime?.toDate && (
                  <Text style={styles.timeText}>
                    {item.lastMessageTime.toDate().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                )}
                {unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="chatbubble-outline" size={64} color="#B2DFDB" />
            <Text
              style={{
                color: "#777",
                marginTop: 12,
                fontSize: 16,
              }}
            >
              No chats yet
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E8F5E9" },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 12,
    padding: 12,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
    backgroundColor: "#B2DFDB",
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
    backgroundColor: "#B2DFDB",
    justifyContent: "center",
    alignItems: "center",
  },
  chatTextArea: { flex: 1, minWidth: 0 },
  nameText: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#00796b",
  },
  lastMessage: {
    color: "#333",
    marginTop: 2,
    fontSize: 14,
    maxWidth: 180,
  },
  metaArea: {
    alignItems: "flex-end",
  },
  timeText: { color: "#777", fontSize: 11, marginBottom: 2 },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    backgroundColor: "#E53935",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
  },
});
