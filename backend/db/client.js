import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  console.warn("SUPABASE_URL or SUPABASE_SECRET_KEY is not set, recipes won't be stored. Add them to backend/.env");
}

// Null when not configured, so the backend still runs and every search scrapes live.
// The backend has no logged-in users, so there is no session to persist.
export const supabase =
  url && secretKey ? createClient(url, secretKey, { auth: { persistSession: false } }) : null;
