import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Speech from "expo-speech";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import AnimatedModal from "../components/AnimatedModal"; // ✅ Custom modal

const LoginScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalSuccess, setModalSuccess] = useState(false);

  const auth = getAuth();
  const db = getFirestore();

  const speak = (text) => {
    Speech.speak(text, {
      language: t("lang_code") === "yo" ? "yo" : "en-US",
    });
  };

  const showModal = (message, success = false) => {
    setModalMessage(message);
    setModalSuccess(success);
    setModalVisible(true);
    speak(message);
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        redirectByRole(user.uid);
      }
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      return showModal(t("enter_credentials"));
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const { uid } = userCredential.user;
      showModal(t("login_successful"), true);
      redirectByRole(uid);
    } catch (error) {
      const msg = error.message || t("error_occurred");
      showModal(msg);
    } finally {
      setLoading(false);
    }
  };

  const redirectByRole = async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (!userDoc.exists()) {
        return showModal(t("user_not_found"));
      }
      const userData = userDoc.data();
      const { role, verified } = userData;
      if (["healthworker", "doctor", "volunteer"].includes(role) && !verified) {
        return showModal(t("account_not_verified"));
      }
      switch (role) {
        case "patient":
          navigation.replace("PatientDashboard");
          break;
        case "healthworker":
        case "doctor":
        case "volunteer":
          navigation.replace("HealthWorkerDashboard");
          break;
        case "admin":
          navigation.replace("AdminDashboard");
          break;
        default:
          showModal(t("unauthorized"));
      }
    } catch (error) {
      showModal(error.message || t("error_occurred"));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{t("login")}</Text>
      <TextInput
        style={styles.input}
        placeholder={t("email")}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder={t("password")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {loading ? (
        <ActivityIndicator size="large" color="#00796b" />
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>{t("login")}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")}>
        <Text style={styles.forgotText}>{t("forgot_password")}</Text>
      </TouchableOpacity>

      <Text style={styles.signupPrompt}>{t("no_account")}</Text>

      <View style={styles.signupContainer}>
        <TouchableOpacity
          style={styles.signupButton}
          onPress={() => navigation.navigate("PatientSignUp")}
        >
          <Text style={styles.signupButtonText}>{t("signup_patient")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.signupButton, styles.healthWorkerButton]}
          onPress={() => navigation.navigate("HealthWorkerSignUp")}
        >
          <Text style={styles.signupButtonText}>
            {t("signup_healthworker")}
          </Text>
        </TouchableOpacity>
      </View>

      <AnimatedModal
        visible={modalVisible}
        message={modalMessage}
        success={modalSuccess}
        onClose={() => setModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
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
    borderWidth: 1,
    borderColor: "#00796b",
    borderRadius: 10,
    backgroundColor: "white",
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#00796b",
    padding: 15,
    borderRadius: 10,
    width: "80%",
    alignItems: "center",
  },
  buttonText: { color: "white", fontSize: 16, fontWeight: "bold" },
  forgotText: { marginTop: 10, color: "#00796b", fontSize: 14 },
  signupPrompt: {
    marginTop: 20,
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  signupContainer: { flexDirection: "row", marginTop: 15, gap: 10 },
  signupButton: {
    backgroundColor: "#00796b",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  healthWorkerButton: { backgroundColor: "#004d40" },
  signupButtonText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
});

export default LoginScreen;
