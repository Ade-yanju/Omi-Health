// services/supabase.js

import AsyncStorage from "@react-native-async-storage/async-storage";
import fetch from "cross-fetch"; // ← install this: yarn add cross-fetch
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wtvhypxtkijbpcjyvzm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0eWh2cHh0a2pibHFwamN2anptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMyOTE4MTcsImV4cCI6MjA1ODg2NzgxN30.QVF5x7VXYRWFKDDHQMCdgcMMCrVtLq7spFa3fmlUiUk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch }, // ← ensure Supabase uses cross-fetch in RN
  localStorage: AsyncStorage, // optional: for auth/session persistence
  detectSessionInUrl: false, // disable URL-based session recovery
});
