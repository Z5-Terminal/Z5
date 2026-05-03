// Z5 :: Theme context — provides dark/light mode toggle
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { applyTheme, getMode, C } from "./theme";

const STORAGE_KEY = "z5-theme";

const ThemeCtx = createContext({ mode: "dark", toggle: () => {} });

// Sync the document's outer surfaces (html/body/#root) and the iOS PWA
// meta tags with the active theme. Without this, the system status bar
// stays black-translucent in light mode and the page edges briefly
// flash the hardcoded #000 background from index.html.
function syncDocumentChrome(mode) {
  if (typeof document === "undefined") return;
  const bg = C.bg;

  document.documentElement.style.background = bg;
  document.body.style.background = bg;
  const root = document.getElementById("root");
  if (root) root.style.background = bg;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", bg);

  // iOS PWA status bar: 'default' = dark text on light bg,
  // 'black-translucent' = light text overlaying our dark bg.
  const statusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (statusBar) statusBar.setAttribute("content", mode === "light" ? "default" : "black-translucent");
}

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

  // After every applyTheme run, push the active background onto the
  // document chrome and the iOS theme-color / status-bar meta tags so
  // the page edges follow the theme.
  useEffect(() => { syncDocumentChrome(mode); }, [mode]);

  return (
    <ThemeCtx.Provider value={{ mode, toggle }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
