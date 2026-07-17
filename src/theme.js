// Z5 :: shared theme constants and base style atoms
// Dual-mode: dark (default) and light. Sans-serif body, mono for codes/serials.

// ── Color palettes ──────────────────────────────────────────────────
// E-ink design language: warm paper surfaces, ink-black type, muted
// desaturated semantics — like reading on an e-reader. DARK is the
// e-reader "night mode": warm near-black, soft off-white ink.
// Deep black night mode — pure neutral blacks (no warm tint), with the
// muted e-ink semantic colors kept for status tones.
const DARK = {
  bg:           "#000000",
  bgElevated:   "#0d0d0d",
  panel:        "#0c0c0c",
  panelHover:   "#151515",
  text:         "#f0f0f0",
  dim:          "#8f8f8f",
  dimmer:       "#5e5e5e",
  bright:       "#ffffff",
  border:       "#262626",
  borderBright: "#474747",
  accent:       "#ffffff",
  error:        "#d98a80",
  warn:         "#cfae62",
  ok:           "#8fbf9f",
  schedule:     "#8aa8bf",
  // Semantic overlay / surface tokens
  overlay:        "rgba(255,255,255,",   // append "0.xx)" in usage
  overlayInverse: "rgba(0,0,0,",
  scrim:          "rgba(0,0,0,0.85)",    // full-screen dimmed backdrop (lightbox / dialogs)
  // Image-context tokens — identical in BOTH palettes. Used over
  // photos/artwork whose pixels don't change with the theme, so the
  // overlay must not change either.
  imageSurface:     "#000000",
  imageOverlayText: "#ffffff",
  imageTint:        "rgba(255,255,255,", // append "0.xx)" in usage
  imageShade:       "rgba(0,0,0,",       // append "0.xx)" in usage
  headerBg:       "#0c0c0c",
  sidebarBg:      "#050505",
  mobileHeaderBg: "rgba(0,0,0,0.92)",
  mobileTabBg:    "rgba(10,10,10,0.96)",
  navActiveBg:    "rgba(255,255,255,0.08)",
  cardBg:         "rgba(255,255,255,0.05)",
  badgeDefault:   "rgba(255,255,255,0.06)",
  badgeBright:    "rgba(255,255,255,0.12)",
  badgeOk:        "rgba(143,191,159,0.12)",
  badgeOkBorder:  "#3c5a47",
  badgeWarn:      "rgba(207,174,98,0.12)",
  badgeWarnBorder:"#5c5030",
  badgeError:     "rgba(217,138,128,0.12)",
  badgeErrorBorder:"#5c3934",
  errBg:          "rgba(217,138,128,0.09)",
  errBorder:      "rgba(217,138,128,0.3)",
  warnBg:         "rgba(207,174,98,0.09)",
  okBg:           "rgba(143,191,159,0.09)",
  okBorder:       "rgba(143,191,159,0.3)",
  progressTrack:  "rgba(255,255,255,0.08)",
  selectedBg:     "rgba(143,191,159,0.16)",
  hoverBg:        "rgba(255,255,255,0.05)",
  inputBg:        "#0a0a0a",
  warnBorderFaint:"rgba(207,174,98,0.3)",
  errBorderFaint: "rgba(217,138,128,0.3)",
  btnActiveColor: "#000000",
  shadow:         "none",
};

// E-ink paper — the default mode.
const LIGHT = {
  bg:           "#eeece5",
  bgElevated:   "#f8f6f0",
  panel:        "#f7f6f1",
  panelHover:   "#f1efe8",
  text:         "#22211d",
  dim:          "#6d6a62",
  dimmer:       "#98948a",
  bright:       "#141310",
  border:       "#d8d4c8",
  borderBright: "#a9a496",
  accent:       "#141310",
  error:        "#9c4038",
  warn:         "#8a6c22",
  ok:           "#3d6b50",
  schedule:     "#41647e",
  // Semantic overlay / surface tokens
  overlay:        "rgba(20,19,16,",
  overlayInverse: "rgba(248,246,240,",
  scrim:          "rgba(35,32,26,0.55)", // full-screen dimmed backdrop (lightbox / dialogs)
  // Image-context tokens — identical in BOTH palettes (see DARK).
  imageSurface:     "#000000",
  imageOverlayText: "#ffffff",
  imageTint:        "rgba(255,255,255,", // append "0.xx)" in usage
  imageShade:       "rgba(0,0,0,",       // append "0.xx)" in usage
  headerBg:       "#f7f6f1",
  sidebarBg:      "#e9e6de",
  mobileHeaderBg: "rgba(238,236,229,0.92)",
  mobileTabBg:    "rgba(247,246,241,0.96)",
  navActiveBg:    "rgba(20,19,16,0.07)",
  cardBg:         "rgba(20,19,16,0.04)",
  badgeDefault:   "rgba(20,19,16,0.05)",
  badgeBright:    "rgba(20,19,16,0.09)",
  badgeOk:        "rgba(61,107,80,0.10)",
  badgeOkBorder:  "#b4c8bc",
  badgeWarn:      "rgba(138,108,34,0.10)",
  badgeWarnBorder:"#d3c599",
  badgeError:     "rgba(156,64,56,0.08)",
  badgeErrorBorder:"#d6aaa5",
  errBg:          "rgba(156,64,56,0.07)",
  errBorder:      "rgba(156,64,56,0.28)",
  warnBg:         "rgba(138,108,34,0.07)",
  okBg:           "rgba(61,107,80,0.08)",
  okBorder:       "rgba(61,107,80,0.28)",
  progressTrack:  "rgba(20,19,16,0.08)",
  selectedBg:     "rgba(61,107,80,0.14)",
  hoverBg:        "rgba(20,19,16,0.04)",
  inputBg:        "#fdfcf8",
  warnBorderFaint:"rgba(138,108,34,0.3)",
  errBorderFaint: "rgba(156,64,56,0.3)",
  btnActiveColor: "#f8f6f0",
  shadow:         "0 1px 2px rgba(35,32,26,0.05), 0 6px 18px rgba(35,32,26,0.05)",
};

// ── Mutable C and S (swapped in place by applyTheme) ────────────────
// E-ink paper (light) is the default mode.
export const C = { ...LIGHT };

// Sans-serif body (system stack).
export const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
// Monospace reserved for callsigns, serials, invite codes, numeric data.
export const FONT_MONO = `"SF Mono", "Consolas", "Monaco", "Courier New", monospace`;

function buildStyles() {
  return {
    input: {
      background: C.inputBg,
      color: C.text,
      border: `1px solid ${C.border}`,
      padding: "10px 14px",
      fontFamily: FONT,
      fontSize: 15,
      width: "100%",
      outline: "none",
      boxSizing: "border-box",
      borderRadius: 10,
    },
    inputMono: {
      fontFamily: FONT_MONO,
      letterSpacing: "0.5px",
    },
    btn: {
      background: C.bgElevated,
      color: C.text,
      border: `1px solid ${C.borderBright}`,
      padding: "10px 18px",
      fontFamily: FONT,
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 600,
      letterSpacing: "0.3px",
      transition: "all 120ms",
      borderRadius: 10,
    },
    btnActive: {
      background: C.bright,
      borderColor: C.bright,
      color: C.btnActiveColor,
    },
    btnPrimary: {
      borderColor: C.bright,
      color: C.bright,
      padding: "12px 22px",
      fontSize: 15,
      fontWeight: 600,
    },
    btnSmall: {
      padding: "6px 12px",
      fontSize: 13,
    },
    panel: {
      border: `1px solid ${C.border}`,
      padding: "24px 28px",
      background: C.panel,
      marginBottom: 24,
      borderRadius: 14,
      boxShadow: C.shadow,
    },
    panelTitle: {
      color: C.bright,
      marginBottom: 20,
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: "1.2px",
      textTransform: "uppercase",
      borderBottom: `1px solid ${C.border}`,
      paddingBottom: 12,
    },
    table: { width: "100%", borderCollapse: "collapse", marginBottom: 12 },
    th: {
      textAlign: "start",
      color: C.dim,
      borderBottom: `1px solid ${C.border}`,
      padding: "10px 8px",
      fontWeight: 600,
      fontSize: 12,
      letterSpacing: "0.8px",
      textTransform: "uppercase",
    },
    td: {
      padding: "10px 8px",
      borderBottom: `1px solid ${C.border}`,
      fontSize: 14,
      color: C.text,
    },
    tdMono: {
      fontFamily: FONT_MONO,
      fontSize: 13,
      color: C.text,
      letterSpacing: "0.3px",
    },
    label: {
      color: C.dim,
      fontSize: 12,
      marginBottom: 6,
      fontWeight: 600,
      letterSpacing: "0.8px",
      textTransform: "uppercase",
    },
    mono: {
      fontFamily: FONT_MONO,
      letterSpacing: "0.3px",
    },
  };
}

export let S = buildStyles();

// ── Theme switcher ──────────────────────────────────────────────────
let _listeners = [];

export function getMode() {
  return C.bg === DARK.bg ? "dark" : "light";
}

// Default mode when nothing is stored: e-ink paper.
export const DEFAULT_MODE = "light";

export function applyTheme(mode) {
  const palette = mode === "light" ? LIGHT : DARK;
  Object.assign(C, palette);
  const rebuilt = buildStyles();
  Object.keys(rebuilt).forEach((k) => { S[k] = rebuilt[k]; });
  _listeners.forEach((fn) => fn(mode));
}

export function onThemeChange(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter((f) => f !== fn); };
}
