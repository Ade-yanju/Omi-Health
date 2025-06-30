// import React, { useState } from "react";
// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   StyleSheet,
//   FlatList,
//   ActivityIndicator,
//   ScrollView,
// } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";
// import RNPickerSelect from "react-native-picker-select";
// import { useTranslation } from "react-i18next";
// import * as Speech from "expo-speech";
// import {
//   getFirestore,
//   collection,
//   query,
//   where,
//   getDocs,
// } from "firebase/firestore";
// import AnimatedModal from "../components/AnimatedModal"; // ✅ Imported modal

// const SearchForHealthWorkers = () => {
//   const { t } = useTranslation();
//   const [specialization, setSpecialization] = useState("");
//   const [experience, setExperience] = useState("");
//   const [healthWorkers, setHealthWorkers] = useState([]);
//   const [loading, setLoading] = useState(false);

//   const [modalVisible, setModalVisible] = useState(false);
//   const [modalMessage, setModalMessage] = useState("");
//   const [modalType, setModalType] = useState("success");

//   const db = getFirestore();

//   const speak = (msg) => {
//     Speech.speak(msg, {
//       language: t("lang_code") === "yo" ? "yo" : "en-US",
//     });
//   };

//   const showModal = (message, type = "success") => {
//     setModalMessage(message);
//     setModalType(type);
//     setModalVisible(true);
//     speak(message);
//   };

//   const searchHealthWorkers = async () => {
//     setLoading(true);
//     speak(t("searching"));

//     try {
//       const filters = [where("role", "==", "healthworker")];
//       if (specialization) {
//         filters.push(where("specialization", "==", specialization));
//       }

//       const q = query(collection(db, "users"), ...filters);
//       const snapshot = await getDocs(q);

//       const result = snapshot.docs
//         .map((doc) => ({ id: doc.id, ...doc.data() }))
//         .filter((doc) =>
//           experience
//             ? parseInt(doc.experience || 0) >= parseInt(experience)
//             : true
//         );

//       setHealthWorkers(result);

//       if (result.length === 0) {
//         showModal(t("no_results_found"), "error");
//       } else {
//         showModal(`${result.length} ${t("results_found")}`, "success");
//       }
//     } catch (error) {
//       console.error("Search error:", error);
//       showModal(t("error_occurred"), "error");
//     }

//     setLoading(false);
//   };

//   return (
//     <SafeAreaView style={styles.container}>
//       <ScrollView keyboardShouldPersistTaps="handled">
//         <Text style={styles.title}>{t("search_doctor")}</Text>

//         <View style={styles.pickerContainer}>
//           <RNPickerSelect
//             onValueChange={(value) => setSpecialization(value)}
//             items={[
//               { label: "Cardiology", value: "Cardiology" },
//               { label: "Neurology", value: "Neurology" },
//               { label: "Pediatrics", value: "Pediatrics" },
//               { label: "Dermatology", value: "Dermatology" },
//               { label: "General Medicine", value: "General Medicine" },
//             ]}
//             placeholder={{ label: t("select_specialization"), value: null }}
//             style={pickerSelectStyles}
//           />
//         </View>

//         <TextInput
//           style={styles.input}
//           placeholder={t("experience_years")}
//           value={experience}
//           keyboardType="numeric"
//           onChangeText={setExperience}
//         />

//         <TouchableOpacity
//           style={styles.searchButton}
//           onPress={searchHealthWorkers}
//         >
//           <Text style={styles.buttonText}>{t("search")}</Text>
//         </TouchableOpacity>

//         {loading && <ActivityIndicator size="large" color="#00796b" />}

//         <FlatList
//           data={healthWorkers}
//           renderItem={({ item }) => (
//             <View style={styles.doctorCard}>
//               <Text style={styles.doctorName}>{item.name}</Text>
//               <Text>
//                 {t("specialization")}: {item.specialization}
//               </Text>
//               <Text>
//                 {t("experience")}: {item.experience} {t("years")}
//               </Text>
//             </View>
//           )}
//           keyExtractor={(item) => item.id}
//           scrollEnabled={false}
//         />

//         <AnimatedModal
//           visible={modalVisible}
//           type={modalType}
//           message={modalMessage}
//           onClose={() => setModalVisible(false)}
//         />
//       </ScrollView>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#f0f8ff", padding: 20 },
//   title: {
//     fontSize: 22,
//     fontWeight: "bold",
//     color: "#00796b",
//     marginBottom: 10,
//   },
//   pickerContainer: {
//     borderWidth: 1,
//     borderColor: "#00796b",
//     borderRadius: 10,
//     backgroundColor: "white",
//     marginBottom: 10,
//     paddingHorizontal: 10,
//   },
//   input: {
//     borderWidth: 1,
//     borderColor: "#00796b",
//     borderRadius: 10,
//     padding: 10,
//     marginBottom: 10,
//     backgroundColor: "white",
//   },
//   searchButton: {
//     backgroundColor: "#00796b",
//     padding: 12,
//     borderRadius: 10,
//     alignItems: "center",
//     marginBottom: 10,
//   },
//   buttonText: { color: "white", fontSize: 16, fontWeight: "bold" },
//   doctorCard: {
//     backgroundColor: "white",
//     padding: 10,
//     borderRadius: 10,
//     marginVertical: 5,
//     elevation: 2,
//   },
//   doctorName: { fontSize: 18, fontWeight: "bold", color: "#00796b" },
// });

// const pickerSelectStyles = {
//   inputIOS: {
//     fontSize: 16,
//     padding: 12,
//     borderRadius: 8,
//     color: "#00796b",
//   },
//   inputAndroid: {
//     fontSize: 16,
//     padding: 12,
//     borderRadius: 8,
//     color: "#00796b",
//   },
//   placeholder: {
//     color: "#00796b",
//   },
// };

// export default SearchForHealthWorkers;

import React, { useState } from "react";
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

  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState("success");

  const db = getFirestore();
  const auth = getAuth();

  const speak = (msg) => {
    Speech.speak(msg, {
      language: t("lang_code") === "yo" ? "yo" : "en-US",
    });
  };

  const showModal = (message, type = "success") => {
    setModalMessage(message);
    setModalType(type);
    setModalVisible(true);
    speak(message);
  };

  const searchHealthWorkers = async () => {
    setLoading(true);
    speak(t("searching"));

    try {
      const filters = [
        where("role", "==", "healthworker"),
        where("verified", "==", true),
      ];
      if (specialization) {
        filters.push(where("specialization", "==", specialization));
      }

      const q = query(collection(db, "users"), ...filters);
      const snapshot = await getDocs(q);

      const result = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((doc) =>
          experience
            ? parseInt(doc.experience || 0) >= parseInt(experience)
            : true
        );

      setHealthWorkers(result);

      if (result.length === 0) {
        showModal(t("no_results_found"), "error");
      } else {
        showModal(`${result.length} ${t("results_found")}`, "success");
      }
    } catch (error) {
      console.error("Search error:", error);
      showModal(t("error_occurred"), "error");
    }

    setLoading(false);
  };

  const startChat = (worker) => {
    const user = auth.currentUser;
    if (!user) {
      showModal(t("unauthenticated"), "error");
      return;
    }
    const chatId = `${user.uid}_${worker.id}`;
    navigation.navigate("ChatWithHealthWorker", {
      chatId,
      userId: user.uid,
      patientName: user.displayName || "Patient",
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t("search_doctor")}</Text>

        <View style={styles.pickerContainer}>
          <RNPickerSelect
            onValueChange={(value) => setSpecialization(value)}
            items={[
              { label: "Cardiology", value: "Cardiology" },
              { label: "Neurology", value: "Neurology" },
              { label: "Pediatrics", value: "Pediatrics" },
              { label: "Dermatology", value: "Dermatology" },
              { label: "General Medicine", value: "General Medicine" },
            ]}
            placeholder={{ label: t("select_specialization"), value: null }}
            style={pickerSelectStyles}
          />
        </View>

        <TextInput
          style={styles.input}
          placeholder={t("experience_years")}
          value={experience}
          keyboardType="numeric"
          onChangeText={setExperience}
        />

        <TouchableOpacity
          style={styles.searchButton}
          onPress={searchHealthWorkers}
        >
          <Text style={styles.buttonText}>{t("search")}</Text>
        </TouchableOpacity>

        {loading && <ActivityIndicator size="large" color="#00796b" />}

        <FlatList
          data={healthWorkers}
          renderItem={({ item }) => (
            <View style={styles.doctorCard}>
              <Text style={styles.doctorName}>{item.name}</Text>
              <Text>
                {t("specialization")}: {item.specialization}
              </Text>
              <Text>
                {t("experience")}: {item.experience} {t("years")}
              </Text>
              <TouchableOpacity
                style={styles.chatButton}
                onPress={() => startChat(item)}
              >
                <Text style={styles.chatButtonText}>{t("chat")}</Text>
              </TouchableOpacity>
            </View>
          )}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
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
