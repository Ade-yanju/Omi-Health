// services/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import Constants from "expo-constants";
// Your Firebase config object
const firebaseConfig = {
  apiKey: "AIzaSyB8qRv3riVqbBdcbIGvswbKdGuI1GXOjeM",
  authDomain: "omi-healthcare.firebaseapp.com",
  databaseURL: "https://omi-healthcare-default-rtdb.firebaseio.com",
  projectId: "omi-healthcare",
  storageBucket: "omi-healthcare.firebasestorage.app",
  messagingSenderId: "1075154794466",
  appId: "1:1075154794466:web:7635dbba71ec41333dabbb",
  measurementId: "G-4C3KVDF213",
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);

export { auth, firestore, storage };
