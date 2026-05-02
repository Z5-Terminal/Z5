// Z5 :: Theme context — provides dark/light mode toggle
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { applyTheme, getMode } from "./theme";

const STORAGE_KEY = "z5-theme";

const ThemeCtx = createContext({ mode: "dark", toggle: () => {} });

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") {
        applyTheme(saved);
        return saved;
      }
    } catch { /* ignore */ }
    return "dark";
  });

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Sync on mount (in case applyTheme wasn't called yet)
  useEffect(() => { applyTheme(mode); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ThemeCtx.Provider value={{ mode, toggle }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
