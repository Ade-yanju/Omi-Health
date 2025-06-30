import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Speech from "expo-speech";
import { useTranslation } from "react-i18next";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import AnimatedModal from "../components/AnimatedModal";

// Add a simple gender picker for cross-platform
const genderOptions = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "other" },
];

const PatientSignupScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [age, setAge] = useState(""); // NEW
  const [gender, setGender] = useState(""); // NEW
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
    if (!name || !email || !password || !age || !gender) {
      speakAndShowModal(t("all_fields_required"), "error");
      return;
    }

    if (isNaN(Number(age)) || Number(age) <= 0) {
      speakAndShowModal(t("enter_valid_age"), "error");
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
        displayName: name,
        email,
        age: Number(age), // NEW
        gender, // NEW
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
        placeholder={t("age")}
        value={age}
        onChangeText={setAge}
        keyboardType="numeric"
        style={styles.input}
      />

      <View style={styles.genderContainer}>
        <Text style={styles.genderLabel}>{t("gender")}</Text>
        <View style={styles.genderOptions}>
          {genderOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.genderOption,
                gender === opt.value && styles.genderOptionSelected,
              ]}
              onPress={() => setGender(opt.value)}
            >
              <Text
                style={[
                  styles.genderText,
                  gender === opt.value && styles.genderTextSelected,
                ]}
              >
                {t(opt.label.toLowerCase())}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

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
  genderContainer: {
    width: "90%",
    marginBottom: 12,
  },
  genderLabel: {
    color: "#00796b",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 5,
  },
  genderOptions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 7,
    marginRight: 7,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#00796b33",
  },
  genderOptionSelected: {
    backgroundColor: "#00796b",
    borderColor: "#00796b",
  },
  genderText: {
    color: "#00796b",
    fontWeight: "600",
  },
  genderTextSelected: {
    color: "#fff",
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
