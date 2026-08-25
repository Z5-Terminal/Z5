import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fail loudly (and visibly) when the env vars are missing — otherwise
// createClient throws during module load and the app is a blank page
// with no clue why. Copy .env.example to .env for local dev.
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  const msg = "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.example to .env and restart the dev server.";
  if (typeof document !== "undefined") {
    document.body.innerHTML =
      `<pre style="padding:24px;font-family:monospace;white-space:pre-wrap;color:#9c4038">${msg}</pre>`;
  }
  throw new Error(msg);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: { params: { eventsPerSecond: 10 } },
});
