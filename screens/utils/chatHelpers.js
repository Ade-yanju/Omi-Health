import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { firestore } from "../services/firebase";

// This is STEP 1:
export const ensureChatExists = async (chatId, members) => {
  const chatRef = doc(firestore, "chats", chatId);
  const chatDoc = await getDoc(chatRef);
  if (!chatDoc.exists()) {
    await setDoc(chatRef, { members, createdAt: serverTimestamp() });
  }
};
