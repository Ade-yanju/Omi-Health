import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Platform,
  ActivityIndicator,
} from "react-native";
import Checkbox from "expo-checkbox";
import { useTranslation } from "react-i18next";
import * as Crypto from "expo-crypto";
import * as Speech from "expo-speech";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import AnimatedModal from "../components/AnimatedModal";

const HealthWorkerSignup = ({ navigation }) => {
  const { t } = useTranslation();
  // User data states
  const [name, setName] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [medicalNo, setMedicalNo] = useState("");
  const [placeOfWork, setPlaceOfWork] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [policyChecked, setPolicyChecked] = useState(false);

  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalSuccess, setModalSuccess] = useState(false);

  const auth = getAuth();
  const db = getFirestore();

  // Text-to-speech helper
  const speak = (text) => {
    Speech.speak(text, {
      language: t("lang_code") === "yo" ? "yo" : "en-US",
    });
  };

  // Modal handler
  const showModal = (message, success = false) => {
    setModalMessage(message);
    setModalSuccess(success);
    setModalVisible(true);
    speak(message);
  };

  // Generate a strong password for user if needed
  useEffect(() => {
    generateSecurePassword(12).then(setPassword);
  }, []);

  const generateSecurePassword = async (length = 12) => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";
    const array = new Uint8Array(length);
    await Crypto.getRandomValuesAsync(array);
    return Array.from(array)
      .map((num) => chars[num % chars.length])
      .join("");
  };

  // Signup handler
  const handleSignup = async () => {
    if (
      !name ||
      !specialization ||
      !medicalNo ||
      !placeOfWork ||
      !yearsExperience ||
      !email ||
      !password
    ) {
      return showModal(t("all_fields_required") || "Please fill all fields.");
    }
    if (!policyChecked) {
      return showModal(
        t("agree_policy_message") || "You must agree to the policy."
      );
    }

    setLoading(true);

    try {
      // 1. Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const { uid } = userCredential.user;

      // 2. Save user profile in Firestore
      await setDoc(doc(db, "users", uid), {
        uid,
        name,
        email,
        specialization,
        medicalNo,
        placeOfWork,
        yearsExperience,
        role: "healthworker",
        verified: false,
        createdAt: serverTimestamp(),
      });

      showModal(
        t("account_created_verification") ||
          "Account created! Awaiting verification.",
        true
      );
      setTimeout(() => {
        navigation.navigate("LoginScreen");
      }, 2000);
    } catch (error) {
      console.error("Signup Error:", error.message);
      showModal(error.message || t("error_occurred") || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0f8ff" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t("signup_as_healthworker")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("full_name")}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder={t("specialization")}
          value={specialization}
          onChangeText={setSpecialization}
        />
        <TextInput
          style={styles.input}
          placeholder={t("medical_registration_number")}
          value={medicalNo}
          onChangeText={setMedicalNo}
        />
        <TextInput
          style={styles.input}
          placeholder={t("place_of_work")}
          value={placeOfWork}
          onChangeText={setPlaceOfWork}
        />
        <TextInput
          style={styles.input}
          placeholder={t("experience_years")}
          value={yearsExperience}
          keyboardType="numeric"
          onChangeText={setYearsExperience}
        />
        <TextInput
          style={styles.input}
          placeholder={t("email")}
          value={email}
          keyboardType="email-address"
          autoCapitalize="none"
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder={t("password")}
          value={password}
          secureTextEntry
          onChangeText={setPassword}
        />

        <View style={styles.policyContainer}>
          <Checkbox value={policyChecked} onValueChange={setPolicyChecked} />
          <Text style={styles.policyText}>{t("agree_policy")}</Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleSignup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{t("create_account")}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

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
  safeArea: {
    flex: 1,
    backgroundColor: "#f0f8ff",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f8ff",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00796b",
    marginBottom: 20,
    textAlign: "center",
    marginTop: 36,
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
  policyContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  policyText: {
    marginLeft: 10,
    fontSize: 14,
    color: "#00796b",
  },
  button: {
    backgroundColor: "#00796b",
    padding: 15,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
    marginVertical: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default HealthWorkerSignup;
