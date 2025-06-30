// services/supabase.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ovewbokrhugykbworznf.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92ZXdib2tyaHVneWtid29yem5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxNTUxNTgsImV4cCI6MjA1NDczMTE1OH0.k4InOzwO3ubgYExBmXQ_WKkAkChPXq7KE6jB40sdvX8";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
