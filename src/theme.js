// Z5 :: shared theme constants and base style atoms
//
// Design language: Apple-style craft on the e-ink palette.
//   • Palette  — warm paper (light, default) / deep-black night (dark).
//                Ink is the accent: no chroma except muted status tones.
//   • Surfaces — one bordered card level (Panel); inner tiles are fills;
//                floating chrome (bars, sheets, menus) is translucent
//                material with content scrolling underneath.
//   • Type     — platform system font, size-specific tracking (tight on
//                large titles, ~0 on body), no spaced-out uppercase.
//   • Motion   — springs (see motion.js); press feedback on pointer-down.
//
// All colors in screens must come from C. Never hardcode hex/rgba there —
// add a token here instead.

// ── Color palettes ──────────────────────────────────────────────────
// Deep black night mode — pure neutral blacks, muted e-ink status tones.
const DARK = {
  bg:           "#000000",
  bgElevated:   "#141414",
  panel:        "#0d0d0d",
  panelHover:   "#161616",
  text:         "#f0f0f0",
  dim:          "#9a9a9a",
  dimmer:       "#666666",
  bright:       "#ffffff",
  border:       "#232323",
  borderBright: "#474747",
  accent:       "#ffffff",
  error:        "#e0958b",
  warn:         "#d6b56a",
  ok:           "#95c7a6",
  schedule:     "#90b0c8",
  // Semantic overlay / surface tokens
  overlay:        "rgba(255,255,255,",   // append "0.xx)" in usage
  overlayInverse: "rgba(0,0,0,",
  scrim:          "rgba(0,0,0,0.62)",    // dimmed backdrop behind sheets / dialogs
  scrimStrong:    "rgba(0,0,0,0.88)",    // lightbox backdrop
  // Image-context tokens — identical in BOTH palettes. Used over
  // photos/artwork whose pixels don't change with the theme, so the
  // overlay must not change either.
  imageSurface:     "#000000",
  imageOverlayText: "#ffffff",
  imageTint:        "rgba(255,255,255,", // append "0.xx)" in usage
  imageShade:       "rgba(0,0,0,",       // append "0.xx)" in usage
  posterPaper:      "#f8f6f0",           // light-artwork poster backdrop (Hub)
  posterInk:        "#141310",
  pageFade:         "rgba(0,0,0,",       // page colour (#000) as rgba prefix — fades into the page
  headerBg:       "#0d0d0d",
  sidebarBg:      "#070707",
  // Translucent materials (pair with MATERIAL.* blur). Content scrolls
  // underneath; the solid fallback is used for reduced transparency.
  material:        "rgba(8,8,8,0.72)",    // bars over content
  materialThick:   "rgba(22,22,22,0.86)", // sheets, menus, popovers
  materialSolid:   "#101010",
  materialBorder:  "rgba(255,255,255,0.10)",
  mobileHeaderBg:  "rgba(8,8,8,0.72)",
  mobileTabBg:     "rgba(26,26,26,0.78)",
  separator:       "rgba(255,255,255,0.10)", // hairlines inside cards
  fill:            "rgba(255,255,255,0.09)", // control fill (gray buttons, tracks)
  fillStrong:      "rgba(255,255,255,0.15)", // hover / pressed fill
  thumb:           "rgba(255,255,255,0.17)", // segmented-control thumb
  tint:            "#ffffff",               // primary action fill (ink)
  onTint:          "#000000",
  focusRing:       "rgba(255,255,255,0.42)",
  navActiveBg:    "rgba(255,255,255,0.10)",
  cardBg:         "rgba(255,255,255,0.055)",
  badgeDefault:   "rgba(255,255,255,0.08)",
  badgeBright:    "rgba(255,255,255,0.16)",
  badgeOk:        "rgba(149,199,166,0.15)",
  badgeOkBorder:  "#3c5a47",
  badgeWarn:      "rgba(214,181,106,0.15)",
  badgeWarnBorder:"#5c5030",
  badgeError:     "rgba(224,149,139,0.15)",
  badgeErrorBorder:"#5c3934",
  errBg:          "rgba(224,149,139,0.10)",
  errBorder:      "rgba(224,149,139,0.3)",
  warnBg:         "rgba(214,181,106,0.10)",
  okBg:           "rgba(149,199,166,0.10)",
  okBorder:       "rgba(149,199,166,0.3)",
  scheduleBg:     "rgba(144,176,200,0.14)",
  progressTrack:  "rgba(255,255,255,0.10)",
  selectedBg:     "rgba(149,199,166,0.16)",
  hoverBg:        "rgba(255,255,255,0.055)",
  pressedBg:      "rgba(255,255,255,0.10)",
  inputBg:        "rgba(255,255,255,0.06)",
  warnBorderFaint:"rgba(214,181,106,0.3)",
  errBorderFaint: "rgba(224,149,139,0.3)",
  btnActiveColor: "#000000",
  // Elevation. Night mode separates with fills and borders, not shadows;
  // only floating layers get one.
  shadow:         "none",
  shadowSm:       "none",
  shadowMd:       "0 10px 30px rgba(0,0,0,0.55)",
  shadowLg:       "0 24px 64px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.12)",
  knob:           "#f2f2f2",               // switch knob
};

// E-ink paper — the default mode.
const LIGHT = {
  bg:           "#eeece5",
  bgElevated:   "#fbfaf6",
  panel:        "#f8f7f2",
  panelHover:   "#f2f0e9",
  text:         "#22211d",
  dim:          "#6b6860",
  dimmer:       "#99958b",
  bright:       "#141310",
  border:       "#dedbd0",
  borderBright: "#aca798",
  accent:       "#141310",
  error:        "#9c4038",
  warn:         "#836518",
  ok:           "#3a6a4e",
  schedule:     "#3d627d",
  // Semantic overlay / surface tokens
  overlay:        "rgba(20,19,16,",
  overlayInverse: "rgba(248,246,240,",
  scrim:          "rgba(35,32,26,0.36)", // dimmed backdrop behind sheets / dialogs
  scrimStrong:    "rgba(20,19,16,0.86)", // lightbox backdrop
  // Image-context tokens — identical in BOTH palettes (see DARK).
  imageSurface:     "#000000",
  imageOverlayText: "#ffffff",
  imageTint:        "rgba(255,255,255,", // append "0.xx)" in usage
  imageShade:       "rgba(0,0,0,",       // append "0.xx)" in usage
  posterPaper:      "#f8f6f0",
  posterInk:        "#141310",
  pageFade:         "rgba(238,236,229,", // page colour (#eeece5) as rgba prefix — fades into the page
  headerBg:       "#f8f7f2",
  sidebarBg:      "#e8e5dc",
  material:        "rgba(238,236,229,0.74)",
  materialThick:   "rgba(250,249,244,0.88)",
  materialSolid:   "#f8f7f2",
  materialBorder:  "rgba(20,19,16,0.09)",
  mobileHeaderBg:  "rgba(238,236,229,0.74)",
  mobileTabBg:     "rgba(250,249,244,0.80)",
  separator:       "rgba(20,19,16,0.10)",
  fill:            "rgba(20,19,16,0.06)",
  fillStrong:      "rgba(20,19,16,0.11)",
  thumb:           "#fdfcf9",
  tint:            "#141310",
  onTint:          "#fbfaf6",
  focusRing:       "rgba(20,19,16,0.32)",
  navActiveBg:    "rgba(20,19,16,0.075)",
  cardBg:         "rgba(20,19,16,0.04)",
  badgeDefault:   "rgba(20,19,16,0.06)",
  badgeBright:    "rgba(20,19,16,0.10)",
  badgeOk:        "rgba(58,106,78,0.12)",
  badgeOkBorder:  "#b4c8bc",
  badgeWarn:      "rgba(131,101,24,0.12)",
  badgeWarnBorder:"#d3c599",
  badgeError:     "rgba(156,64,56,0.10)",
  badgeErrorBorder:"#d6aaa5",
  errBg:          "rgba(156,64,56,0.08)",
  errBorder:      "rgba(156,64,56,0.28)",
  warnBg:         "rgba(131,101,24,0.08)",
  okBg:           "rgba(58,106,78,0.09)",
  okBorder:       "rgba(58,106,78,0.28)",
  scheduleBg:     "rgba(61,98,125,0.10)",
  progressTrack:  "rgba(20,19,16,0.08)",
  selectedBg:     "rgba(58,106,78,0.13)",
  hoverBg:        "rgba(20,19,16,0.04)",
  pressedBg:      "rgba(20,19,16,0.08)",
  inputBg:        "#fdfcf9",
  warnBorderFaint:"rgba(131,101,24,0.3)",
  errBorderFaint: "rgba(156,64,56,0.3)",
  btnActiveColor: "#fbfaf6",
  shadow:         "0 0.5px 1px rgba(35,32,26,0.05), 0 4px 16px rgba(35,32,26,0.045)",
  shadowSm:       "0 0.5px 1px rgba(35,32,26,0.08), 0 1px 3px rgba(35,32,26,0.07)",
  shadowMd:       "0 1px 2px rgba(35,32,26,0.06), 0 10px 28px rgba(35,32,26,0.12)",
  shadowLg:       "0 2px 6px rgba(35,32,26,0.06), 0 24px 60px rgba(35,32,26,0.20)",
  knob:           "#fdfcf9",
};

// "Increase contrast" (prefers-contrast: more): firm borders, near-solid
// materials, stronger secondary text. Applied on top of the palette.
const CONTRAST = {
  dark: {
    dim: "#c4c4c4", dimmer: "#9a9a9a", border: "#5a5a5a", borderBright: "#8a8a8a",
    separator: "rgba(255,255,255,0.32)", material: "#0a0a0a", materialThick: "#161616",
    mobileHeaderBg: "#0a0a0a", mobileTabBg: "#161616", materialBorder: "rgba(255,255,255,0.4)",
  },
  light: {
    dim: "#48463f", dimmer: "#6b6860", border: "#8f8a7c", borderBright: "#5e5a50",
    separator: "rgba(20,19,16,0.38)", material: "#eeece5", materialThick: "#f8f7f2",
    mobileHeaderBg: "#eeece5", mobileTabBg: "#f8f7f2", materialBorder: "rgba(20,19,16,0.45)",
  },
};

// ── Mutable C and S (swapped in place by applyTheme) ────────────────
// E-ink paper (light) is the default mode.
export const C = { ...LIGHT };

// Platform system font: optical sizing and tracking tables come free.
export const FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
// Monospace is reserved for true codes: callsigns, serials, invite codes,
// tokens/URLs. Dates, scores and counters use NUM (tabular figures) instead.
export const FONT_MONO = `ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Courier New", monospace`;

// Tabular figures in the system font — spread into styles that show
// dates, times, counts, scores or percentages so digits don't jitter.
export const NUM = { fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' };

// ── Type scale ──────────────────────────────────────────────────────
// Tracking is size-specific: tight on display sizes, ~0 on body, slightly
// open on captions. Leading runs the other way. Spread into a style.
export const T = {
  largeTitle: { fontSize: 34, lineHeight: 1.15, fontWeight: 700, letterSpacing: "-0.022em" },
  title1:     { fontSize: 28, lineHeight: 1.18, fontWeight: 700, letterSpacing: "-0.02em" },
  title2:     { fontSize: 22, lineHeight: 1.22, fontWeight: 700, letterSpacing: "-0.017em" },
  title3:     { fontSize: 19, lineHeight: 1.28, fontWeight: 600, letterSpacing: "-0.014em" },
  headline:   { fontSize: 16, lineHeight: 1.35, fontWeight: 600, letterSpacing: "-0.01em" },
  body:       { fontSize: 15, lineHeight: 1.5,  fontWeight: 400, letterSpacing: "-0.005em" },
  callout:    { fontSize: 14, lineHeight: 1.45, fontWeight: 400, letterSpacing: "-0.003em" },
  footnote:   { fontSize: 13, lineHeight: 1.4,  fontWeight: 400, letterSpacing: "0" },
  caption:    { fontSize: 12, lineHeight: 1.35, fontWeight: 400, letterSpacing: "0.005em" },
  caption2:   { fontSize: 11, lineHeight: 1.3,  fontWeight: 500, letterSpacing: "0.01em" },
};

// ── Shape ───────────────────────────────────────────────────────────
// Bigger surfaces get bigger radii (concentric with their content).
// Artwork colours: pixels of the Hub dot-art heroes. The dark art sits on
// black, the light art is drawn straight onto the light page.
export const ART = {
  dot: [236, 234, 228],        // dark theme: sphere base colour (warm white)
  dotShadow: [10, 10, 9],      // dark theme: sphere terminator / rim
  paper: [238, 236, 229],      // light theme: = LIGHT.bg (the art is drawn on the page)
  ink: [20, 19, 16],           // light theme: dot ink
};

export const R = {
  xs: 6,       // tiny marks: checkboxes, thumbnails
  sm: 10,      // inner tiles, menu items, nav rows
  md: 12,      // controls: buttons, inputs
  lg: 16,      // cards (mobile)
  xl: 20,      // cards (desktop), dialogs
  sheet: 28,   // bottom sheets, poster cards
  pill: 999,
};

// ── Materials ───────────────────────────────────────────────────────
// Spread next to a translucent background token (C.material*).
// Elements using these should also carry the `data-material` attribute so
// reduced-transparency / increased-contrast fallbacks in index.html apply.
export const MATERIAL = {
  bar:   { backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)" },
  thick: { backdropFilter: "saturate(180%) blur(32px)", WebkitBackdropFilter: "saturate(180%) blur(32px)" },
};

// ── Layering ────────────────────────────────────────────────────────
export const Z = {
  sticky: 10,     // in-page sticky headers
  header: 20,     // mobile top bar
  tabbar: 30,     // mobile tab bar
  floating: 40,   // bulk-action bars, popover catchers
  menu: 60,       // menus / popovers
  lightbox: 200,
  modal: 300,
  toast: 400,
};

function buildStyles() {
  return {
    input: {
      background: C.inputBg,
      color: C.text,
      border: `1px solid ${C.border}`,
      padding: "9px 12px",
      fontFamily: FONT,
      fontSize: 15,
      lineHeight: 1.35,
      letterSpacing: "-0.005em",
      width: "100%",
      minHeight: 40,
      outline: "none",
      boxSizing: "border-box",
      borderRadius: R.md,
    },
    inputMono: {
      fontFamily: FONT_MONO,
      letterSpacing: "0.02em",
    },
    // Gray (secondary) button — a fill, no border.
    btn: {
      background: C.fill,
      color: C.bright,
      // Longhands on purpose: variants override borderColor, and with the
      // `border` shorthand React would drop the color when a button flips
      // back from a variant, leaving a stray outline.
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: "transparent",
      padding: "8px 16px",
      minHeight: 38,
      fontFamily: FONT,
      cursor: "pointer",
      fontSize: 14,
      lineHeight: 1.25,
      fontWeight: 600,
      letterSpacing: "-0.005em",
      borderRadius: R.md,
      boxSizing: "border-box",
    },
    // Selected chip / toggle-on.
    btnActive: {
      background: C.tint,
      borderColor: C.tint,
      color: C.onTint,
    },
    // Filled primary action.
    btnPrimary: {
      background: C.tint,
      borderColor: C.tint,
      color: C.onTint,
      padding: "10px 20px",
      minHeight: 42,
      fontSize: 15,
      fontWeight: 600,
    },
    btnSmall: {
      padding: "5px 13px",
      minHeight: 30,
      fontSize: 13,
      borderRadius: R.pill,
    },
    btnDanger: {
      background: C.errBg,
      borderColor: "transparent",
      color: C.error,
    },
    btnPlain: {
      background: "transparent",
      borderColor: "transparent",
      color: C.bright,
      paddingInline: 8,
    },
    panel: {
      border: `1px solid ${C.border}`,
      padding: "20px 22px",
      background: C.panel,
      marginBottom: 20,
      borderRadius: R.xl,
      boxShadow: C.shadow,
    },
    panelTitle: {
      color: C.bright,
      marginBottom: 14,
      fontSize: 17,
      lineHeight: 1.3,
      fontWeight: 600,
      letterSpacing: "-0.012em",
    },
    table: { width: "100%", borderCollapse: "collapse", marginBottom: 8 },
    th: {
      textAlign: "start",
      color: C.dim,
      borderBottom: `1px solid ${C.separator}`,
      padding: "8px 8px",
      fontWeight: 500,
      fontSize: 12,
      letterSpacing: "0.005em",
    },
    td: {
      padding: "11px 8px",
      borderBottom: `1px solid ${C.separator}`,
      fontSize: 14,
      color: C.text,
    },
    tdMono: {
      fontFamily: FONT_MONO,
      fontSize: 13,
      color: C.text,
      letterSpacing: "0.02em",
    },
    // Field / section micro-label: sentence case, secondary color.
    label: {
      color: C.dim,
      fontSize: 13,
      lineHeight: 1.3,
      marginBottom: 6,
      fontWeight: 500,
      letterSpacing: "0",
    },
    mono: {
      fontFamily: FONT_MONO,
      letterSpacing: "0.02em",
    },
    num: NUM,
  };
}

export let S = buildStyles();

// ── Theme switcher ──────────────────────────────────────────────────
let _listeners = [];
let _mode = "light";

export function getMode() {
  return _mode;
}

// Default mode when nothing is stored: e-ink paper.
export const DEFAULT_MODE = "light";

function prefersMoreContrast() {
  try {
    return typeof window !== "undefined"
      && !!window.matchMedia
      && window.matchMedia("(prefers-contrast: more)").matches;
  } catch { return false; }
}

export function applyTheme(mode) {
  _mode = mode === "light" ? "light" : "dark";
  const palette = _mode === "light" ? LIGHT : DARK;
  // Reset to the full palette first so contrast overrides never leak
  // across a mode switch.
  Object.assign(C, palette);
  if (prefersMoreContrast()) Object.assign(C, CONTRAST[_mode]);
  const rebuilt = buildStyles();
  Object.keys(rebuilt).forEach((k) => { S[k] = rebuilt[k]; });
  _listeners.forEach((fn) => fn(_mode));
}

export function onThemeChange(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter((f) => f !== fn); };
}
