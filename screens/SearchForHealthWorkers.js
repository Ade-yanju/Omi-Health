import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import RNPickerSelect from "react-native-picker-select";
import { useTranslation } from "react-i18next";
import * as Speech from "expo-speech";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useNavigation } from "@react-navigation/native";
import AnimatedModal from "../components/AnimatedModal";

const SearchForHealthWorkers = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [specialization, setSpecialization] = useState("");
  const [experience, setExperience] = useState("");
  const [healthWorkers, setHealthWorkers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState("success");

  const db = getFirestore();
  const auth = getAuth();
  const flatListRef = useRef();
  let ttsTimeout = useRef(null);

  // Speak utility with cancel previous TTS
  const speak = (msg) => {
    Speech.stop(); // Stop any previous speech
    if (ttsTimeout.current) clearTimeout(ttsTimeout.current);
    ttsTimeout.current = setTimeout(() => {
      Speech.speak(msg, {
        language: t("lang_code") === "yo" ? "yo" : "en-US",
        pitch: 1,
        rate: 0.98,
      });
    }, 150); // slight delay to prevent race on fast actions
  };

  // Modal + TTS
  const showModal = (message, type = "success") => {
    setModalMessage(message);
    setModalType(type);
    setModalVisible(true);
    speak(message);
  };

  // Handle specialization selection with TTS
  const handleSpecializationChange = (value) => {
    setSpecialization(value);
    if (value) {
      speak(`${t("specialization")}: ${value}`);
    } else {
      speak(t("select_specialization"));
    }
  };

  // Handle experience change with TTS
  const handleExperienceChange = (value) => {
    setExperience(value);
    if (value) {
      speak(`${t("experience")}: ${value} ${t("years")}`);
    }
  };

  // Search for healthworkers (Firestore query, filters for verified, role, etc.)
  const searchHealthWorkers = async () => {
    setLoading(true);
    Speech.stop();
    speak(t("searching"));

    try {
      const filters = [
        where("role", "==", "healthworker"),
        where("verified", "==", true), // boolean, not string
      ];
      if (specialization) {
        filters.push(where("specialization", "==", specialization)); // must be "Cardiology"
      }

      const q = query(collection(db, "users"), ...filters);
      const snapshot = await getDocs(q);

      // Filter by minimum experience (client-side, as Firestore has no gte for string field)
      const result = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((doc) =>
          experience
            ? parseInt(doc.yearsExperience || 0, 10) >= parseInt(experience, 10)
            : true
        );

      setHealthWorkers(result);

      if (result.length === 0) {
        showModal(t("no_results_found"), "error");
      } else {
        const foundMsg = `${result.length} ${t("results_found")}`;
        showModal(foundMsg, "success");
        // TTS list names and specialization, read only once
        Speech.stop();
        setTimeout(() => {
          speak(
            result
              .map(
                (hw, i) =>
                  `${i + 1}. ${hw.name}, ${t("specialization")}: ${
                    hw.specialization
                  }, ${t("experience")}: ${hw.yearsExperience} ${t("years")}`
              )
              .join("; ")
          );
        }, 1200);
      }
    } catch (error) {
      console.error("Search error:", error);
      showModal(t("error_occurred"), "error");
    }

    setLoading(false);
  };

  // Chat navigation
  const startChat = (worker) => {
    const user = auth.currentUser;
    if (!user) {
      showModal(t("unauthenticated"), "error");
      return;
    }
    speak(`${t("starting_chat_with")} ${worker.name}`);
    navigation.navigate("ChatWithHealthWorker", {
      patientId: user.uid,
      healthworkerId: worker.id,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t("search_doctor")}</Text>

        {/* Picker for specialization with TTS on change */}
        <View style={styles.pickerContainer}>
          <RNPickerSelect
            onValueChange={handleSpecializationChange}
            value={specialization}
            items={[
              { label: "Cardiology", value: "Cardiology" },
              { label: "Neurology", value: "Neurology" },
              { label: "Pediatrics", value: "Pediatrics" },
              { label: "Dermatology", value: "Dermatology" },
              { label: "General Medicine", value: "General Medicine" },
            ]}
            placeholder={{ label: t("select_specialization"), value: "" }}
            style={pickerSelectStyles}
          />
        </View>

        {/* Minimum experience */}
        <TextInput
          style={styles.input}
          placeholder={t("experience_years")}
          value={experience}
          keyboardType="numeric"
          onChangeText={handleExperienceChange}
        />

        <TouchableOpacity
          style={styles.searchButton}
          onPress={searchHealthWorkers}
          accessibilityLabel={t("search")}
        >
          <Text style={styles.buttonText}>{t("search")}</Text>
        </TouchableOpacity>

        {loading && <ActivityIndicator size="large" color="#00796b" />}

        <FlatList
          ref={flatListRef}
          data={healthWorkers}
          renderItem={({ item }) => (
            <View style={styles.doctorCard}>
              <Text style={styles.doctorName}>{item.name}</Text>
              <Text>
                {t("specialization")}: {item.specialization}
              </Text>
              <Text>
                {t("experience")}: {item.yearsExperience} {t("years")}
              </Text>
              <TouchableOpacity
                style={styles.chatButton}
                onPress={() => startChat(item)}
                accessibilityLabel={t("chat")}
              >
                <Text style={styles.chatButtonText}>{t("Message")}</Text>
              </TouchableOpacity>
            </View>
          )}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={
            !loading && (
              <Text
                style={{ textAlign: "center", marginTop: 16, color: "gray" }}
              >
                {t("no_results_found")}
              </Text>
            )
          }
        />

        <AnimatedModal
          visible={modalVisible}
          type={modalType}
          message={modalMessage}
          onClose={() => setModalVisible(false)}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f8ff", padding: 20 },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#00796b",
    marginBottom: 10,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#00796b",
    borderRadius: 10,
    backgroundColor: "white",
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#00796b",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "white",
  },
  searchButton: {
    backgroundColor: "#00796b",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  buttonText: { color: "white", fontSize: 16, fontWeight: "bold" },
  doctorCard: {
    backgroundColor: "white",
    padding: 10,
    borderRadius: 10,
    marginVertical: 5,
    elevation: 2,
  },
  doctorName: { fontSize: 18, fontWeight: "bold", color: "#00796b" },
  chatButton: {
    backgroundColor: "#0288D1",
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
    alignItems: "center",
  },
  chatButtonText: { color: "white", fontWeight: "bold" },
});

const pickerSelectStyles = {
  inputIOS: {
    fontSize: 16,
    padding: 12,
    borderRadius: 8,
    color: "#00796b",
  },
  inputAndroid: {
    fontSize: 16,
    padding: 12,
    borderRadius: 8,
    color: "#00796b",
  },
  placeholder: {
    color: "#00796b",
  },
};

export default SearchForHealthWorkers;
