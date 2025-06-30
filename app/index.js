// import React, { useState, useEffect } from "react";
// import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";
// import { useTranslation } from "react-i18next";
// import * as Speech from "expo-speech";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { setLanguage } from "../i18n";

// const WelcomeScreen = ({ navigation }) => {
//   const { t, i18n } = useTranslation();
//   const [language, setLangState] = useState(i18n.language || "en");

//   useEffect(() => {
//     const loadLanguage = async () => {
//       const savedLanguage = await AsyncStorage.getItem("appLanguage");
//       if (savedLanguage) {
//         await i18n.changeLanguage(savedLanguage);
//         setLangState(savedLanguage);
//       }
//       readScreenContent(savedLanguage || "en");
//     };

//     loadLanguage();
//   }, []);

//   // Function to read the screen content aloud
//   const readScreenContent = (lang) => {
//     const content = `${t("welcome")}. ${t("select_language")}, ${t(
//       "english"
//     )}, ${t("yoruba")}, ${t("continue")}`;
//     Speech.speak(content, { language: lang, voice: getVoice(lang) });
//   };

//   // Function to get the appropriate voice
//   const getVoice = (lang) => {
//     if (lang === "yo") return "com.apple.ttsbundle.OluPremium"; // Yoruba voice for iOS
//     return "com.apple.ttsbundle.Daniel-compact"; // English voice for iOS
//   };

//   const handleLanguageChange = async (lang) => {
//     await setLanguage(lang);
//     setLangState(lang);
//     Speech.speak(
//       `${t("welcome")}. ${t("select_language")}, ${t("english")}, ${t(
//         "yoruba"
//       )}, ${t("continue")}`,
//       {
//         language: lang,
//         voice: getVoice(lang),
//       }
//     );
//   };

//   return (
//     <SafeAreaView style={styles.container}>
//       <Text style={styles.title}>{t("welcome")}</Text>
//       <Text style={styles.subtitle}>{t("select_language")}</Text>

//       <View style={styles.buttonContainer}>
//         <TouchableOpacity
//           style={[styles.button, language === "en" && styles.selectedButton]}
//           onPress={() => handleLanguageChange("en")}
//         >
//           <Text style={styles.buttonText}>English</Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={[styles.button, language === "yo" && styles.selectedButton]}
//           onPress={() => handleLanguageChange("yo")}
//         >
//           <Text style={styles.buttonText}>Yorùbá</Text>
//         </TouchableOpacity>
//       </View>

//       <TouchableOpacity
//         style={styles.continueButton}
//         onPress={() => navigation.navigate("LoginScreen")}
//       >
//         <Text style={styles.continueButtonText}>{t("continue")}</Text>
//       </TouchableOpacity>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     alignItems: "center",
//     justifyContent: "center",
//     backgroundColor: "#E8F5E9",
//   },
//   title: {
//     fontSize: 24,
//     fontWeight: "bold",
//     color: "#00796b",
//     marginBottom: 10,
//   },
//   subtitle: { fontSize: 18, color: "#00796b", marginBottom: 20 },
//   buttonContainer: { flexDirection: "row", gap: 10, marginBottom: 30 },
//   button: {
//     padding: 12,
//     borderRadius: 8,
//     borderWidth: 2,
//     borderColor: "#00796b",
//     backgroundColor: "#A5D6A7",
//   },
//   selectedButton: { backgroundColor: "#00796b" },
//   buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
//   continueButton: {
//     backgroundColor: "#00796b",
//     padding: 15,
//     borderRadius: 10,
//     width: "80%",
//     alignItems: "center",
//   },
//   continueButtonText: { color: "white", fontSize: 16, fontWeight: "bold" },
// });
// export default WelcomeScreen;
import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);
