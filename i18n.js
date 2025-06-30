import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";

import en from "./locales/en.json";
import yo from "./locales/yo.json";

const resources = {
  en: { translation: en },
  yo: { translation: yo },
};

i18n.use(initReactI18next).init({
  resources,
  lng: Localization.locale.startsWith("yo") ? "yo" : "en", // Auto-detect
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

// Save & Load Language Preference
export const setLanguage = async (lang) => {
  await AsyncStorage.setItem("appLanguage", lang);
  i18n.changeLanguage(lang);
};

export default i18n;
