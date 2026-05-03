// Z5 :: shared theme constants and base style atoms
// Dual-mode: dark (default) and light. Sans-serif body, mono for codes/serials.

// ── Color palettes ──────────────────────────────────────────────────
const DARK = {
  bg:           "#000",
  bgElevated:   "#0a0a0a",
  panel:        "rgba(255,255,255,0.03)",
  panelHover:   "rgba(255,255,255,0.05)",
  text:         "#f5f5f5",
  dim:          "#8a8a8a",
  dimmer:       "#5a5a5a",
  bright:       "#ffffff",
  border:       "#2a2a2a",
  borderBright: "#444444",
  accent:       "#ffffff",
  error:        "#ff5555",
  warn:         "#ffcc55",
  ok:           "#55ff99",
  // Semantic overlay / surface tokens
  overlay:        "rgba(255,255,255,",   // append "0.xx)" in usage
  overlayInverse: "rgba(0,0,0,",
  headerBg:       "rgba(255,255,255,0.025)",
  sidebarBg:      "rgba(255,255,255,0.015)",
  mobileHeaderBg: "rgba(0,0,0,0.92)",
  mobileTabBg:    "rgba(0,0,0,0.96)",
  navActiveBg:    "rgba(255,255,255,0.08)",
  cardBg:         "rgba(255,255,255,0.02)",
  badgeDefault:   "rgba(255,255,255,0.08)",
  badgeBright:    "rgba(255,255,255,0.14)",
  badgeOk:        "rgba(85,255,153,0.1)",
  badgeOkBorder:  "#2a5a3a",
  badgeWarn:      "rgba(255,204,85,0.1)",
  badgeWarnBorder:"#5a4a2a",
  badgeError:     "rgba(255,85,85,0.1)",
  badgeErrorBorder:"#5a2a2a",
  errBg:          "rgba(255,85,85,0.08)",
  errBorder:      "rgba(255,85,85,0.25)",
  okBg:           "rgba(85,255,153,0.08)",
  okBorder:       "rgba(85,255,153,0.25)",
  progressTrack:  "rgba(255,255,255,0.06)",
  selectedBg:     "rgba(85,255,153,0.15)",
  hoverBg:        "rgba(255,255,255,0.03)",
  inputBg:        "#0a0a0a",
  warnBorderFaint:"rgba(255,170,0,0.3)",
  errBorderFaint: "rgba(255,85,85,0.3)",
  btnActiveColor: "#000",
};

const LIGHT = {
  bg:           "#f5f5f0",
  bgElevated:   "#ffffff",
  panel:        "rgba(0,0,0,0.02)",
  panelHover:   "rgba(0,0,0,0.04)",
  text:         "#1a1a1a",
  dim:          "#6a6a6a",
  dimmer:       "#999999",
  bright:       "#000000",
  border:       "#d5d5d0",
  borderBright: "#aaaaaa",
  accent:       "#000000",
  error:        "#cc3333",
  warn:         "#b38600",
  ok:           "#1a8c4a",
  // Semantic overlay / surface tokens
  overlay:        "rgba(0,0,0,",
  overlayInverse: "rgba(255,255,255,",
  headerBg:       "rgba(0,0,0,0.025)",
  sidebarBg:      "rgba(0,0,0,0.02)",
  mobileHeaderBg: "rgba(245,245,240,0.94)",
  mobileTabBg:    "rgba(245,245,240,0.96)",
  navActiveBg:    "rgba(0,0,0,0.06)",
  cardBg:         "rgba(0,0,0,0.015)",
  badgeDefault:   "rgba(0,0,0,0.06)",
  badgeBright:    "rgba(0,0,0,0.1)",
  badgeOk:        "rgba(26,140,74,0.08)",
  badgeOkBorder:  "#a0d4b0",
  badgeWarn:      "rgba(179,134,0,0.08)",
  badgeWarnBorder:"#d4c890",
  badgeError:     "rgba(204,51,51,0.08)",
  badgeErrorBorder:"#e0a0a0",
  errBg:          "rgba(204,51,51,0.06)",
  errBorder:      "rgba(204,51,51,0.2)",
  okBg:           "rgba(26,140,74,0.06)",
  okBorder:       "rgba(26,140,74,0.2)",
  progressTrack:  "rgba(0,0,0,0.06)",
  selectedBg:     "rgba(26,140,74,0.12)",
  hoverBg:        "rgba(0,0,0,0.03)",
  inputBg:        "#ffffff",
  warnBorderFaint:"rgba(179,134,0,0.3)",
  errBorderFaint: "rgba(204,51,51,0.25)",
  btnActiveColor: "#ffffff",
};

// ── Mutable C and S (swapped in place by applyTheme) ────────────────
export const C = { ...DARK };

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
      padding: "10px 12px",
      fontFamily: FONT,
      fontSize: 15,
      width: "100%",
      outline: "none",
      boxSizing: "border-box",
      borderRadius: 2,
    },
    inputMono: {
      fontFamily: FONT_MONO,
      letterSpacing: "0.5px",
    },
    btn: {
      background: "transparent",
      color: C.text,
      border: `1px solid ${C.borderBright}`,
      padding: "10px 18px",
      fontFamily: FONT,
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 500,
      letterSpacing: "0.3px",
      transition: "all 120ms",
      borderRadius: 2,
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
      borderRadius: 4,
    },
    panelTitle: {
      color: C.bright,
      marginBottom: 20,
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: "1.2px",
      textTransform: "uppercase",
      borderBottom: `1px solid ${C.border}`,
      paddingBottom: 12,
    },
    table: { width: "100%", borderCollapse: "collapse", marginBottom: 12 },
    th: {
      textAlign: "left",
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
