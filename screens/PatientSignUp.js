import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Speech from "expo-speech";
import { useTranslation } from "react-i18next";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import AnimatedModal from "../components/AnimatedModal"; // ✅ Import animated modal

const PatientSignupScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [modalText, setModalText] = useState("");
  const [modalType, setModalType] = useState("success");

  const auth = getAuth();
  const db = getFirestore();

  const speakAndShowModal = (text, type = "error") => {
    setModalText(text);
    setModalType(type);
    setModalVisible(true);
    Speech.speak(text, {
      language: t("lang_code") === "yo" ? "yo" : "en-US",
    });
  };

  const handleSignup = async () => {
    if (!name || !email || !password) {
      speakAndShowModal(t("all_fields_required"), "error");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "users", uid), {
        uid,
        name,
        email,
        role: "patient",
        verified: true,
        createdAt: serverTimestamp(),
      });

      speakAndShowModal(t("signup_success"), "success");
      setTimeout(() => {
        navigation.navigate("LoginScreen");
      }, 1500);
    } catch (error) {
      const msg = `${t("signup_failed")}: ${error.message}`;
      speakAndShowModal(msg, "error");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{t("signup_patient")}</Text>

      <TextInput
        placeholder={t("full_name")}
        value={name}
        onChangeText={setName}
        style={styles.input}
      />
      <TextInput
        placeholder={t("email")}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />
      <TextInput
        placeholder={t("password")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <TouchableOpacity style={styles.signupButton} onPress={handleSignup}>
        <Text style={styles.signupText}>{t("sign_up")}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate("HealthWorkerSignUp")}
      >
        <Text style={styles.switchText}>{t("are_you_healthworker")}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("LoginScreen")}>
        <Text style={styles.loginLink}>{t("already_have_account")}</Text>
      </TouchableOpacity>

      <AnimatedModal
        visible={modalVisible}
        type={modalType}
        message={modalText}
        onClose={() => setModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#00796b",
    marginBottom: 20,
  },
  input: {
    width: "90%",
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#00796b",
    borderRadius: 10,
    backgroundColor: "white",
  },
  signupButton: {
    backgroundColor: "#00796b",
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    width: "80%",
    alignItems: "center",
  },
  signupText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  switchText: { marginTop: 10, color: "#00796b", fontSize: 14 },
  loginLink: { marginTop: 10, color: "#00796b", fontSize: 14 },
});

export default PatientSignupScreen;
