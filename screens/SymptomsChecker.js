import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Speech from "expo-speech";
import symptomsData from "../data/symptomsData.json";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import AnimatedModal from "../components/AnimatedModal"; // ✅ Import modal

const SymptomCheckerScreen = () => {
  const { t } = useTranslation();
  const [symptoms, setSymptoms] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState("success");

  const firestore = getFirestore();
  const auth = getAuth();

  const speak = (message) => {
    Speech.speak(message, {
      language: t("lang_code") === "yo" ? "yo" : "en-US",
      pitch: 1,
      rate: 1,
    });
  };

  const showModal = (message, type = "success") => {
    setModalMessage(message);
    setModalType(type);
    setModalVisible(true);
    speak(message);
  };

  const analyzeSymptoms = async () => {
    if (symptoms.trim() === "") {
      const msg = t("enter_valid_symptoms");
      showModal(msg, "error");
      return;
    }

    setLoading(true);
    setAnalysisResult(null);

    setTimeout(async () => {
      const lowerSymptoms = symptoms.toLowerCase();
      let diagnosis = t("no_exact_match");

      for (const [condition, details] of Object.entries(symptomsData)) {
        if (
          details.symptoms.some((s) => lowerSymptoms.includes(s.toLowerCase()))
        ) {
          diagnosis = details.diagnosis;
          break;
        }
      }

      try {
        const user = auth.currentUser;
        await addDoc(collection(firestore, "symptom_queries"), {
          userId: user?.uid || "guest",
          symptoms,
          result: diagnosis,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Firestore write error:", err);
        showModal(t("error_occurred"), "error");
      }

      setAnalysisResult(diagnosis);
      showModal(diagnosis, "success");
      setLoading(false);
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>{t("symptom_checker")}</Text>

      <TextInput
        style={styles.input}
        placeholder={t("enter_symptoms")}
        value={symptoms}
        onChangeText={setSymptoms}
        multiline
      />

      <TouchableOpacity style={styles.button} onPress={analyzeSymptoms}>
        <Text style={styles.buttonText}>{t("analyze")}</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator size="large" color="#4CAF50" />}

      {analysisResult && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>{analysisResult}</Text>
        </View>
      )}

      <AnimatedModal
        visible={modalVisible}
        type={modalType}
        message={modalMessage}
        onClose={() => setModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E8F5E9", padding: 20 },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#00796b",
    textAlign: "center",
  },
  input: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 10,
    textAlignVertical: "top",
    height: 100,
  },
  button: {
    backgroundColor: "#00796b",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "white", fontSize: 16, fontWeight: "bold" },
  resultContainer: {
    marginTop: 20,
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
  },
  resultText: { fontSize: 16, textAlign: "center", color: "#333" },
});

export default SymptomCheckerScreen;
