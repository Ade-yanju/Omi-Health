import React, { useEffect, useState } from "react";
import { SafeAreaView, Text, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { I18nextProvider } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "./i18n";

// Firebase
import { auth, firestore } from "./services/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

// Screens
import WelcomeScreen from "./screens/WelcomeScreen";
import LoginScreen from "./screens/LoginScreen";
import ForgotPassword from "./screens/ForgotPassword";
import PasswordReset from "./screens/PasswordReset";
import PatientSignUp from "./screens/PatientSignUp";
import PatientDashboard from "./screens/PatientDashboard";
import HealthWorkerDashboard from "./screens/HealthWorkerDashboard";
import HealthWorkerSignUp from "./screens/HealthWorkerSignUp";
import ChatWithHealthWorker from "./screens/ChatWithHealthWorker";
import ChatWithPatient from "./screens/ChatWithPatient";
import SearchForHealthWorkers from "./screens/SearchForHealthWorkers";
import SymptomsChecker from "./screens/SymptomsChecker";
import LanguageSelection from "./screens/LanguageSelection";
import HealthWorkerAppointments from "./screens/HealthWorkerAppointments";
import PatientAppointment from "./screens/PatientAppointment";
import ChatInbox from "./screens/ChatInbox";

const Stack = createStackNavigator();

function AppNavigation({ userRole }) {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="WelcomeScreen"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="WelcomeScreen" component={WelcomeScreen} />
        <Stack.Screen name="LoginScreen" component={LoginScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
        <Stack.Screen name="PasswordReset" component={PasswordReset} />
        <Stack.Screen name="PatientSignUp" component={PatientSignUp} />
        <Stack.Screen
          name="HealthWorkerSignUp"
          component={HealthWorkerSignUp}
        />

        {/* Always register both dashboards, but restrict access inside the screen itself if needed */}
        <Stack.Screen name="PatientDashboard" component={PatientDashboard} />
        <Stack.Screen
          name="HealthWorkerDashboard"
          component={HealthWorkerDashboard}
        />

        {/* Utility & Functional Screens */}
        <Stack.Screen
          name="ChatWithHealthWorker"
          component={ChatWithHealthWorker}
        />
        <Stack.Screen name="ChatWithPatient" component={ChatWithPatient} />
        <Stack.Screen
          name="SearchForHealthWorkers"
          component={SearchForHealthWorkers}
        />
        <Stack.Screen name="SymptomsChecker" component={SymptomsChecker} />
        <Stack.Screen name="LanguageSelection" component={LanguageSelection} />
        <Stack.Screen
          name="HealthWorkerAppointments"
          component={HealthWorkerAppointments}
        />
        <Stack.Screen
          name="PatientAppointment"
          component={PatientAppointment}
        />
        <Stack.Screen name="ChatInbox" component={ChatInbox} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const savedLang = await AsyncStorage.getItem("appLanguage");
        if (savedLang) {
          i18n.changeLanguage(savedLang);
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            const docSnap = await getDoc(doc(firestore, "users", user.uid));
            if (docSnap.exists()) {
              setUserRole(docSnap.data().role); // should be 'patient' or 'healthworker'
            }
          }
          setLoading(false);
        });

        return unsubscribe;
      } catch (err) {
        console.error("Init error:", err);
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <ActivityIndicator size="large" color="#00796b" />
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaProvider>
      <I18nextProvider i18n={i18n}>
        <AppNavigation userRole={userRole} />
      </I18nextProvider>
    </SafeAreaProvider>
  );
}
