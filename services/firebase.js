// services/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import Constants from "expo-constants";
// Your Firebase config object
const firebaseConfig = {
  apiKey: "AIzaSyADGfkEr6RJ7_r6Nsehlk5zUfjV-UFUfQc",
  authDomain: "omi-health-6adb9.firebaseapp.com",
  projectId: "omi-health-6adb9",
  storageBucket: "omi-health-6adb9.appspot.com", // <- FIXED this line
  messagingSenderId: "64230223791",
  appId: "1:64230223791:web:b6d40fb3e094732fb7495a",
  measurementId: "G-L2R9YM68WR",
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);

export { auth, firestore, storage };
