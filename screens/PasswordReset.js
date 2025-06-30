import React, { useState } from "react";
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
import { getAuth, updatePassword } from "firebase/auth";
import AnimatedModal from "../components/AnimatedModal"; // ✅ Import modal

const PasswordResetScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({
    visible: false,
    message: "",
    type: "success",
  });

  const auth = getAuth();

  const speak = (message) => {
    Speech.speak(message, {
      language: t("lang_code") === "yo" ? "yo" : "en-US",
    });
  };

  const validatePassword = (password) => password.length >= 6;

  const showModal = (message, type = "success", callback) => {
    setModal({ visible: true, message, type });
    speak(message);
    setTimeout(() => {
      setModal({ visible: false, message: "", type: "success" });
      if (callback) callback();
    }, 2500);
  };

  const handleReset = async () => {
    if (!newPassword || !confirmPassword) {
      showModal(t("enter_password"), "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showModal(t("password_mismatch"), "error");
      return;
    }

    if (!validatePassword(newPassword)) {
      showModal(t("password_too_short"), "error");
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error(t("unauthenticated"));

      await updatePassword(user, newPassword);
      showModal(t("password_reset_success"), "success", () => {
        navigation.replace("LoginScreen");
      });
    } catch (error) {
      const msg =
        error.code === "auth/requires-recent-login"
          ? t("requires_recent_login")
          : error.message || t("error_occurred");
      showModal(msg, "error");
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{t("reset_password")}</Text>

      <TextInput
        style={styles.input}
        placeholder={t("new_password")}
        value={newPassword}
        secureTextEntry
        onChangeText={setNewPassword}
      />
      <TextInput
        style={styles.input}
        placeholder={t("confirm_password")}
        value={confirmPassword}
        secureTextEntry
        onChangeText={setConfirmPassword}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleReset}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{t("save_relogin")}</Text>
        )}
      </TouchableOpacity>

      {/* ✅ Modal */}
      <AnimatedModal
        visible={modal.visible}
        type={modal.type}
        message={modal.message}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00796b",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    width: "100%",
    height: 50,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginVertical: 10,
    borderColor: "#00796b",
    backgroundColor: "white",
  },
  button: {
    backgroundColor: "#00796b",
    padding: 15,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
    marginVertical: 10,
  },
  buttonText: { color: "white", fontSize: 16, fontWeight: "bold" },
});

export default PasswordResetScreen;
