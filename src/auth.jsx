import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./supabase";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);
  // Guards: prevent overlapping calls and auth-listener hammering
  const lastFailTime = useRef(0);
  const inflightRef  = useRef(false); // true while a loadProfile query is running

  const loadProfile = useCallback(async (userId, { fromListener = false } = {}) => {
    if (!userId) { setProfile(null); setProfileError(null); return; }

    // If another loadProfile is already in-flight, skip.
    if (inflightRef.current) return;

    // If called from auth listener and we failed recently, skip.
    if (fromListener && lastFailTime.current > 0 && Date.now() - lastFailTime.current < 30000) {
      return;
    }

    inflightRef.current = true;
    setProfileError(null);

    try {
      // Race the Supabase query against a 10s timeout so we never hang forever.
      let timer;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Server not responding — tap Retry")), 10000);
      });
      const query = supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle()
        .then((res) => { clearTimeout(timer); return res; });

      const { data, error } = await Promise.race([query, timeout]);

      if (error) {
        console.error("loadProfile error", error);
        setProfile(null);
        setProfileError(error.message || "Failed to load profile");
        lastFailTime.current = Date.now();
        return;
      }
      if (!data) {
        setProfile(null);
        setProfileError("No profile row found for this account");
        lastFailTime.current = Date.now();
        return;
      }
      setProfile(data);
      lastFailTime.current = 0;
    } catch (e) {
      console.error("loadProfile threw", e);
      setProfile(null);
      setProfileError(e?.message || String(e));
      lastFailTime.current = Date.now();
    } finally {
      inflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Hard safety: if anything below stalls, never leave the user
    // staring at "Booting terminal…" forever.
    const safety = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 5000);

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;
        if (error) throw error;
        setSession(data.session);
        if (data.session?.user) {
          try { await loadProfile(data.session.user.id); }
          catch (e) { console.warn("loadProfile failed", e); }
        }
      } catch (e) {
        console.warn("getSession failed", e);
        try { await supabase.auth.signOut(); } catch {}
        setSession(null);
        setProfile(null);
      } finally {
        if (!cancelled) {
          clearTimeout(safety);
          setLoading(false);
        }
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, sess) => {
      if (cancelled) return;
      setSession(sess);
      if (sess?.user) {
        try { await loadProfile(sess.user.id, { fromListener: true }); }
        catch (e) { console.warn("loadProfile (auth change) failed", e); }
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(safety);
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      lastFailTime.current = 0;   // clear cooldown so retry always fires
      inflightRef.current = false; // clear inflight guard
      await loadProfile(session.user.id);
    }
  }, [session, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ session, profile, profileError, loading, refreshProfile, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

// Base role labels (English). Screens should use t(`role.${role}`) for translated labels.
// This function is kept for backward compatibility in places that don't have i18n context.
export function roleLabel(role) {
  switch (role) {
    case "admin":        return "ADMIN";
    case "officer":      return "TEAM OFFICER";
    case "squad_leader": return "SQUAD LEADER";
    case "sniper":       return "SNIPER";
    default:             return (role || "").toUpperCase();
  }
}

// Translated role label — use in components that have i18n context
export function roleLabelT(role, t) {
  if (t && role) {
    const translated = t(`role.${role}`);
    if (translated !== `role.${role}`) return translated;
  }
  return roleLabel(role);
}

// Check the is_instructor flag on the profile object (not the role column).
export function isInstructor(profile) {
  return !!profile?.is_instructor;
}

export function canManageSquads(role) {
  return role === "admin" || role === "officer";
}

export function canCreateInvites(role) {
  return role === "admin" || role === "officer" || role === "squad_leader";
}

// Who can author an admin task with no specific squad ("whole team").
export function canCreateWholeTeamTask(role) {
  return role === "admin" || role === "officer";
}
