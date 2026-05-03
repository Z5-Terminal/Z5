// Z5 :: Console mode context
//
// Three consoles reachable from the Hub landing screen:
//   - 'terminal'     — main operations app (default)
//   - 'bootcamp'     — bootcamp-scoped variant for new squads
//   - 'recruitment'  — recruiting/candidate pipeline workspace
//
// Decision (2026-05-02): Hub is shown on EVERY login. We do not persist
// the last-selected console to localStorage. consoleMode resets to null
// whenever the session is cleared (logout / new login).

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import {
  useAuth,
  canEnterTerminal,
  canEnterBootcamp,
  canEnterRecruitment,
} from "./auth";

const ConsoleCtx = createContext(null);

export function ConsoleProvider({ children }) {
  const { profile, session } = useAuth();
  const [consoleMode, setConsoleMode] = useState(null);
  const [mySquad, setMySquad] = useState(null);

  // Reset mode whenever the session goes null (logout / new login).
  useEffect(() => {
    if (!session) setConsoleMode(null);
  }, [session]);

  // Fetch the user's squad once so bootcamp access can be evaluated.
  // Shell.jsx used to fetch this directly; it can now read it from here.
  useEffect(() => {
    let cancelled = false;
    if (!profile?.squad_id) { setMySquad(null); return; }
    supabase
      .from("squads")
      .select("*")
      .eq("id", profile.squad_id)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setMySquad(data); });
    return () => { cancelled = true; };
  }, [profile?.squad_id]);

  const availableConsoles = {
    terminal: canEnterTerminal(profile),
    bootcamp: canEnterBootcamp(profile, mySquad),
    recruitment: canEnterRecruitment(profile),
  };

  const clearConsole = () => setConsoleMode(null);

  return (
    <ConsoleCtx.Provider
      value={{
        consoleMode,
        setConsoleMode,
        clearConsole,
        availableConsoles,
        mySquad,
      }}
    >
      {children}
    </ConsoleCtx.Provider>
  );
}

export function useConsole() {
  const ctx = useContext(ConsoleCtx);
  if (!ctx) throw new Error("useConsole must be inside ConsoleProvider");
  return ctx;
}
