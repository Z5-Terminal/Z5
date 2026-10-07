// Z5 :: Theme context — provides dark/light mode toggle
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { applyTheme, C, DEFAULT_MODE } from "./theme";
import { installMotionVars } from "./motion";

const STORAGE_KEY = "z5-theme";

const ThemeCtx = createContext({ mode: DEFAULT_MODE, toggle: () => {} });

// Sync the document's outer surfaces (html/body/#root), the iOS PWA meta
// tags, and the --z5-* CSS variables used by the global interaction layer
// in index.html (pseudo-states can't be styled inline) with the active
// theme tokens.
function syncDocumentChrome(mode) {
  if (typeof document === "undefined") return;
  const bg = C.bg;
  const el = document.documentElement;

  el.style.background = bg;
  el.style.colorScheme = mode === "light" ? "light" : "dark";
  document.body.style.background = bg;
  const root = document.getElementById("root");
  if (root) root.style.background = bg;

  const vars = {
    "--z5-bg": C.bg,
    "--z5-text": C.text,
    "--z5-bright": C.bright,
    "--z5-on-tint": C.onTint,
    "--z5-hover": C.hoverBg,
    "--z5-pressed": C.pressedBg,
    "--z5-fill-strong": C.fillStrong,
    "--z5-focus": C.focusRing,
    "--z5-border-bright": C.borderBright,
    "--z5-scroll-thumb": C.borderBright,
    "--z5-material-solid": C.materialSolid,
  };
  for (const k of Object.keys(vars)) el.style.setProperty(k, vars[k]);

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", bg);

  // iOS PWA status bar: 'default' = dark text on light bg,
  // 'black-translucent' = light text overlaying our dark bg.
  const statusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (statusBar) statusBar.setAttribute("content", mode === "light" ? "default" : "black-translucent");
}

// Ease the palette swap (see html[data-theme-switching] in index.html)
// rather than jumping brightness in one frame.
let switchTimer = 0;
function easeThemeSwitch() {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.setAttribute("data-theme-switching", "");
  clearTimeout(switchTimer);
  switchTimer = setTimeout(() => el.removeAttribute("data-theme-switching"), 380);
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    installMotionVars();
    try {
      // One-time migration to the e-ink design language: older builds
      // defaulted (and persisted) dark. Reset everyone to paper once so
      // the redesign is actually seen; toggles persist normally after.
      if (!localStorage.getItem("z5-theme-eink")) {
        localStorage.setItem("z5-theme-eink", "1");
        localStorage.setItem(STORAGE_KEY, DEFAULT_MODE);
        applyTheme(DEFAULT_MODE);
        return DEFAULT_MODE;
      }
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") {
        applyTheme(saved);
        return saved;
      }
    } catch { /* ignore */ }
    applyTheme(DEFAULT_MODE);
    return DEFAULT_MODE;
  });
  // Bumped when an OS preference that changes tokens flips (contrast).
  const [, setRev] = useState(0);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      easeThemeSwitch();
      applyTheme(next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Sync on mount (in case applyTheme wasn't called yet)
  useEffect(() => { applyTheme(mode); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After every applyTheme run, push the active tokens onto the document
  // chrome, the CSS variables and the iOS theme-color / status-bar metas.
  useEffect(() => { syncDocumentChrome(mode); }, [mode]);

  // Re-derive tokens when the OS "Increase contrast" setting changes.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-contrast: more)");
    const onChange = () => {
      applyTheme(mode);
      syncDocumentChrome(mode);
      setRev((n) => n + 1);
    };
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else if (mql.addListener) mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else if (mql.removeListener) mql.removeListener(onChange);
    };
  }, [mode]);

  return (
    <ThemeCtx.Provider value={{ mode, toggle }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
