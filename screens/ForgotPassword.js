import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import * as Speech from "expo-speech";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../services/firebase";
import AnimatedModal from "../components/AnimatedModal";

const ForgotPasswordScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalSuccess, setModalSuccess] = useState(false);

  const speak = (message) => {
    Speech.speak(message, {
      language: t("lang_code") === "yo" ? "yo" : "en-US",
      pitch: 1,
      rate: 1,
    });
  };

  const showModal = (message, success = false) => {
    setModalMessage(message);
    setModalSuccess(success);
    setModalVisible(true);
    speak(message);
  };

  const handleResetRequest = async () => {
    if (!email.trim()) {
      showModal(t("enter_valid_email"));
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      showModal(t("otp_sent"), true);
      setTimeout(() => {
        setModalVisible(false);
        navigation.goBack();
      }, 2500);
    } catch (error) {
      const message = error.message || t("error_occurred");
      showModal(message);
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>{t("forgot_password")}</Text>
        <Text style={styles.subtitle}>{t("enter_email_to_reset")}</Text>

        <TextInput
          style={styles.input}
          placeholder={t("email")}
          placeholderTextColor="#888"
          value={email}
          keyboardType="email-address"
          autoCapitalize="none"
          onChangeText={setEmail}
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleResetRequest}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{t("send_reset_link")}</Text>
          )}
        </TouchableOpacity>
      </View>

      <AnimatedModal
        visible={modalVisible}
        message={modalMessage}
        success={modalSuccess}
        onClose={() => setModalVisible(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00796b",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    width: "100%",
    height: 50,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    color: "#333",
    borderWidth: 1,
    borderColor: "#A5D6A7",
    marginBottom: 15,
  },
  button: {
    backgroundColor: "#00796b",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default ForgotPasswordScreen;
