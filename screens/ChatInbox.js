import React, { useEffect, useState, useCallback } from "react";
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
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { firestore } from "../services/firebase";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

// Fetch user profile by uid
const fetchUserProfile = async (uid) => {
  try {
    const userDoc = await getDoc(doc(firestore, "users", uid));
    if (userDoc.exists()) return { ...userDoc.data(), id: uid };
    return { id: uid, name: "Unknown" };
  } catch {
    return { id: uid, name: "Unknown" };
  }
};

const ChatInboxScreen = ({ navigation }) => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  const currentUser = getAuth().currentUser;
  const myUid = currentUser?.uid;

  // Fetch my profile
  useEffect(() => {
    if (!myUid) return;
    fetchUserProfile(myUid).then(setProfile);
  }, [myUid]);

  // Listen for all chats (real-time) where user is a participant
  useEffect(() => {
    if (!myUid) return;
    setLoading(true);

    const q = query(
      collection(firestore, "chats"),
      where("participants", "array-contains", myUid)
    );

    // Real-time snapshot
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        setChats([]);
        setLoading(false);
        return;
      }

      // Fetch all "other" users in all chats
      const fetchedChats = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const chat = docSnap.data();
          chat.id = docSnap.id;
          const others = (chat.participants || []).filter((id) => id !== myUid);
          const otherUid = others[0]; // 1:1 chat
          let otherUser = { name: "Unknown" };
          if (otherUid) {
            otherUser = await fetchUserProfile(otherUid);
          }
          return {
            ...chat,
            otherUser,
            unreadCount: (chat.unread && chat.unread[myUid]) || 0,
          };
        })
      );

      // Sort by latest message
      fetchedChats.sort(
        (a, b) =>
          (b.lastMessageTime?.toMillis?.() || 0) -
          (a.lastMessageTime?.toMillis?.() || 0)
      );

      setChats(fetchedChats);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [myUid]);

  // Handler to open chat and reset unread count
  const openChat = useCallback(
    async (chat) => {
      if (!profile || !myUid) return;
      // Reset unread count
      if (chat.unreadCount > 0) {
        const chatRef = doc(firestore, "chats", chat.id);
        await updateDoc(chatRef, { [`unread.${myUid}`]: 0 });
      }
      // Determine correct navigation target and params based on role
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
            Loading Chats...
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
        renderItem={({ item }) => (
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
                {item.lastMessage || ""}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              {item.lastMessageTime?.toDate && (
                <Text style={styles.timeText}>
                  {item.lastMessageTime.toDate().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              )}
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unreadCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="chatbubble-outline" size={64} color="#B2DFDB" />
            <Text style={{ color: "#777", marginTop: 12, fontSize: 16 }}>
              No chats yet
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E8F5E9" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
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
  nameText: { fontWeight: "bold", fontSize: 16, color: "#00796b" },
  lastMessage: { color: "#333", marginTop: 2, fontSize: 14, maxWidth: 180 },
  timeText: { color: "#777", fontSize: 11, marginBottom: 2 },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    backgroundColor: "#E53935",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    paddingHorizontal: 5,
  },
  unreadText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
  },
});

export default ChatInboxScreen;
