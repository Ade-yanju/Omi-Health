import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

const LanguageSelectionScreen = ({ navigation }) => {
  const { i18n } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState(
    i18n.language || "en"
  );

  const changeLanguage = (lang) => {
    setSelectedLanguage(lang);
    i18n.changeLanguage(lang);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Language</Text>

      <TouchableOpacity
        style={[
          styles.option,
          selectedLanguage === "en" && styles.selectedOption,
        ]}
        onPress={() => changeLanguage("en")}
      >
        <Text style={styles.optionText}>English</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.option,
          selectedLanguage === "yo" && styles.selectedOption,
        ]}
        onPress={() => changeLanguage("yo")}
      >
        <Text style={styles.optionText}>Yoruba</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.nextButton}
        onPress={() => navigation.navigate("Signup")}
      >
        <Text style={styles.nextText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f8ff",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 30,
    color: "#00796b",
  },
  option: {
    width: "80%",
    padding: 15,
    borderWidth: 2,
    borderColor: "#00796b",
    borderRadius: 10,
    marginVertical: 10,
    alignItems: "center",
  },
  selectedOption: {
    backgroundColor: "#00796b",
  },
  optionText: {
    fontSize: 18,
    color: "#00796b",
  },
  nextButton: {
    marginTop: 30,
    padding: 15,
    backgroundColor: "#00796b",
    borderRadius: 10,
  },
  nextText: {
    color: "white",
    fontSize: 16,
  },
});

export default LanguageSelectionScreen;
