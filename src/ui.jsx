// Z5 :: shared UI primitives
import { useState } from "react";
import { C, S, FONT, FONT_MONO } from "./theme";
import { useIsMobile } from "./useIsMobile";
import { useTheme } from "./ThemeContext";
import { useConsoleMaybe } from "./console";

// Full-viewport page wrapper.
export function Page({ children }) {
  const { mode } = useTheme(); // subscribe to theme changes
  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      color: C.text,
      fontFamily: FONT,
      fontSize: 15,
      lineHeight: 1.5,
      WebkitFontSmoothing: "antialiased",
      MozOsxFontSmoothing: "grayscale",
    }}>
      {children}
    </div>
  );
}

// Centered narrow column (used for the auth screen).
export function CenteredColumn({ children, maxWidth = 460 }) {
  const isMobile = useIsMobile();
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: isMobile ? "flex-start" : "center",
      justifyContent: "center",
      padding: isMobile
        ? "calc(24px + var(--safe-top)) 16px calc(24px + var(--safe-bottom))"
        : "40px 24px",
    }}>
      <div style={{ width: "100%", maxWidth }}>{children}</div>
    </div>
  );
}

// Height of the mobile bottom tab bar.
const BOTTOM_TAB_HEIGHT = 62;

/**
 * App shell with:
 *  - Desktop: left sidebar 220px + scrollable main
 *  - Mobile:  compact top bar + main + fixed bottom tab bar
 */
export function AppShell({ sidebar, mobileTopBar, mobileTabBar, children }) {
  const isMobile = useIsMobile();
  const { mode } = useTheme();

  if (isMobile) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: C.bg,
      }}>
        {mobileTopBar && (
          <header style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: C.mobileHeaderBg,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderBottom: `1px solid ${C.border}`,
            padding: "calc(10px + var(--safe-top)) 16px 10px",
          }}>
            {mobileTopBar}
          </header>
        )}
        <main style={{
          flex: 1,
          padding: `18px 16px calc(${BOTTOM_TAB_HEIGHT + 24}px + var(--safe-bottom))`,
          width: "100%",
          boxSizing: "border-box",
          minWidth: 0,
        }}>
          {children}
        </main>
        {mobileTabBar && (
          <nav style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            height: `calc(${BOTTOM_TAB_HEIGHT}px + var(--safe-bottom))`,
            paddingBottom: "var(--safe-bottom)",
            background: C.mobileTabBg,
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            zIndex: 30,
          }}>
            {mobileTabBar}
          </nav>
        )}
      </div>
    );
  }

  // Desktop
  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: C.bg,
    }}>
      <aside style={{
        width: 220,
        flexShrink: 0,
        borderInlineEnd: `1px solid ${C.border}`,
        padding: "28px 18px",
        background: C.sidebarBg,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}>
        {sidebar}
      </aside>
      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      }}>
        <div style={{
          flex: 1,
          padding: "32px 40px",
          maxWidth: 1400,
          width: "100%",
          boxSizing: "border-box",
        }}>
          {children}
        </div>
      </main>
    </div>
  );
}

// Sidebar nav link (desktop).
// Inactive items render in C.text (full text color) so they read as
// primary navigation, distinct from the dim section labels (NavLabel).
// Hover fills with C.hoverBg to make interactivity unmistakable.
export function NavItem({ active, onClick, children }) {
  const [hover, setHover] = useState(false);
  const bg = active ? C.navActiveBg : (hover ? C.hoverBg : "transparent");
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: bg,
        color: active ? C.bright : C.text,
        border: "none",
        padding: "10px 14px",
        textAlign: "start",
        fontFamily: FONT,
        fontSize: 14,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        letterSpacing: "0.3px",
        transition: "background 140ms ease-out, color 140ms ease-out",
        borderRadius: 10,
        opacity: active ? 1 : 0.92,
      }}
    >
      {children}
    </button>
  );
}

// Bottom tab bar item (mobile). The active tab's icon sits in a soft
// rounded pill — modern bottom-nav pattern (no hard border accents).
export function TabItem({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: "transparent",
        border: "none",
        color: active ? C.bright : C.dim,
        fontFamily: FONT,
        fontSize: 10.5,
        fontWeight: active ? 700 : 500,
        letterSpacing: "0.4px",
        textTransform: "uppercase",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        padding: "7px 4px",
        minWidth: 0,
      }}
    >
      <span aria-hidden style={{
        fontSize: 20,
        lineHeight: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "3px 14px",
        borderRadius: 999,
        background: active ? C.navActiveBg : "transparent",
        transition: "background 140ms ease-out",
      }}>{icon}</span>
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
        {label}
      </span>
    </button>
  );
}

// Sidebar section label.
// Renders as a divider with a tiny mono caption on the left and a
// hairline filling the rest of the row, so it reads unmistakably as
// a section break — not as a clickable nav item.
export function NavLabel({ children }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "20px 14px 8px",
    }}>
      <span style={{
        color: C.dimmer,
        fontFamily: FONT_MONO,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "1.6px",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );
}

// Page header — plain typography, no card chrome. The title sits
// directly on the page background; only content below lives in cards.
// (The old bordered-card look created a "double card" stack that read
// as broken borders.) `standalone` is still accepted as a no-op for
// backward-compat with older call sites.
export function PageHeader({ title, subtitle, action, hero = true }) {
  const isMobile = useIsMobile();
  // Console hero thumbnail — the operator artwork of the active console,
  // small scale, beside the title. Renders only inside a console and
  // can be disabled per-header with hero={false}.
  const consoleMode = useConsoleMaybe()?.consoleMode || null;
  const [heroOk, setHeroOk] = useState(true);
  const heroSrc = hero && consoleMode
    ? `${import.meta.env.BASE_URL}hero-${consoleMode}.jpg`
    : null;
  const heroSize = isMobile ? 42 : 52;
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end",
      gap: isMobile ? 10 : 16,
      padding: isMobile ? "2px 2px 4px" : "4px 2px 8px",
      marginBottom: 0,
    }}>
      {heroSrc && heroOk && (
        <img
          src={heroSrc}
          alt=""
          aria-hidden
          onError={() => setHeroOk(false)}
          style={{
            width: heroSize,
            height: heroSize,
            borderRadius: 12,
            objectFit: "cover",
            objectPosition: "center 14%",
            border: `1px solid ${C.border}`,
            background: "#000",
            flexShrink: 0,
            alignSelf: "center",
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{
          margin: 0,
          fontSize: isMobile ? 20 : 26,
          fontWeight: 800,
          color: C.bright,
          letterSpacing: "0.2px",
          lineHeight: 1.15,
        }}>{title}</h1>
        {subtitle && (
          <div style={{
            color: C.dim,
            fontSize: isMobile ? 12.5 : 13.5,
            marginTop: 4,
            letterSpacing: "0.2px",
          }}>
            {subtitle}
          </div>
        )}
      </div>
      {action && <div style={{ flexShrink: 0, paddingBottom: 2 }}>{action}</div>}
    </div>
  );
}

// Panel — always rendered as its own bordered card with marginTop above.
// `connectTop` is accepted as a no-op for backward-compat with existing
// call sites; the prop no longer changes rendering.
export function Panel({ title, children, action }) {
  const isMobile = useIsMobile();
  const base = isMobile
    ? { ...S.panel, padding: "14px 14px", marginBottom: 14, borderRadius: 12 }
    : { ...S.panel };
  base.marginTop = isMobile ? 14 : 20;
  return (
    <div style={base}>
      {title && (
        <div style={{
          ...S.panelTitle,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: isMobile ? 14 : 20,
          paddingBottom: isMobile ? 10 : 12,
          fontSize: isMobile ? 12 : 13,
        }}>
          <span>{title}</span>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Field({ label, children, inline }) {
  const isMobile = useIsMobile();
  return (
    <div style={{
      display: inline && !isMobile ? "inline-block" : "block",
      marginInlineEnd: inline && !isMobile ? 16 : 0,
      marginBottom: 16,
      minWidth: inline && !isMobile ? 240 : "auto",
      width: isMobile ? "100%" : "auto",
      verticalAlign: "top",
    }}>
      <div style={S.label}>{label}</div>
      {children}
    </div>
  );
}

export function Btn({ active, primary, small, compact, fullWidth, style, ...rest }) {
  const isMobile = useIsMobile();
  let s = { ...S.btn };
  if (active) s = { ...s, ...S.btnActive };
  if (primary) s = { ...s, ...S.btnPrimary };
  if (small) s = { ...s, ...S.btnSmall };
  if (isMobile && !small && !compact) {
    s = {
      ...s,
      minHeight: 44,
      padding: primary ? "12px 20px" : "11px 16px",
      fontSize: 15,
    };
  }
  if (isMobile && small) {
    s = {
      ...s,
      minHeight: 36,
      padding: "7px 12px",
      fontSize: 13,
    };
  }
  if (fullWidth) s = { ...s, width: "100%" };
  if (style) s = { ...s, ...style };
  return <button {...rest} style={s} />;
}

export function Input({ mono, ...props }) {
  const isMobile = useIsMobile();
  const base = { ...S.input, ...(mono ? S.inputMono : {}) };
  if (isMobile) {
    base.fontSize = 16;
    base.padding = "12px 14px";
    base.minHeight = 46;
  }
  // datetime-local inputs on iOS render with a native widget that has
  // an intrinsic min-width and ignores the input's CSS width, so they
  // overflow narrow containers. Pin width and reset the native
  // appearance so the widget conforms to its parent. The picker UI
  // still opens on focus — only the layout is constrained.
  if (props.type === "datetime-local" || props.type === "date" || props.type === "time") {
    base.maxWidth = "100%";
    base.minWidth = 0;
    base.WebkitAppearance = "none";
    base.MozAppearance = "none";
    base.appearance = "none";
  }
  return <input {...props} style={{ ...base, ...(props.style || {}) }} />;
}

export function Textarea(props) {
  const isMobile = useIsMobile();
  const base = { ...S.input, height: 120, resize: "vertical" };
  if (isMobile) {
    base.fontSize = 16;
    base.padding = "12px 14px";
  }
  return <textarea {...props} style={{ ...base, ...(props.style || {}) }} />;
}

export function Mono({ children, style }) {
  return <span style={{ ...S.mono, ...(style || {}) }}>{children}</span>;
}

export function Badge({ children, tone = "default" }) {
  const tones = {
    default: { bg: C.badgeDefault, fg: C.text, border: C.border },
    bright:  { bg: C.badgeBright,  fg: C.bright, border: C.borderBright },
    ok:      { bg: C.badgeOk,      fg: C.ok,     border: C.badgeOkBorder },
    warn:    { bg: C.badgeWarn,     fg: C.warn,   border: C.badgeWarnBorder },
    error:   { bg: C.badgeError,    fg: C.error,  border: C.badgeErrorBorder },
  };
  const t = tones[tone] || tones.default;
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 10px",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.5px",
      textTransform: "uppercase",
      background: t.bg,
      color: t.fg,
      border: `1px solid ${t.border}`,
      borderRadius: 999,
    }}>{children}</span>
  );
}

export function ErrLine({ children }) {
  if (!children) return null;
  return (
    <div style={{
      color: C.error,
      marginTop: 14,
      fontSize: 13,
      padding: "8px 12px",
      background: C.errBg,
      border: `1px solid ${C.errBorder}`,
      borderRadius: 10,
    }}>{children}</div>
  );
}

export function OkLine({ children }) {
  if (!children) return null;
  return (
    <div style={{
      color: C.ok,
      marginTop: 14,
      fontSize: 13,
      padding: "8px 12px",
      background: C.okBg,
      border: `1px solid ${C.okBorder}`,
      borderRadius: 10,
    }}>{children}</div>
  );
}

// Skeleton shimmer — animated placeholder while content loads.
// Keyframes (z5-shimmer) live in index.html; colors come from tokens.
export function Skeleton({ width = "100%", height = 14, style }) {
  return (
    <div aria-hidden style={{
      width,
      height,
      borderRadius: 6,
      background: `linear-gradient(90deg, ${C.progressTrack} 25%, ${C.hoverBg} 50%, ${C.progressTrack} 75%)`,
      backgroundSize: "600px 100%",
      animation: "z5-shimmer 1.2s linear infinite",
      ...style,
    }} />
  );
}

// A stack of skeleton "rows" approximating a list while it loads.
export function SkeletonRows({ rows = 3 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          padding: "14px 2px",
          borderBottom: i < rows - 1 ? `1px solid ${C.border}` : "none",
        }}>
          <Skeleton width={`${52 - i * 7}%`} height={15} style={{ marginBottom: 8 }} />
          <Skeleton width={`${28 + i * 5}%`} height={11} />
        </div>
      ))}
    </div>
  );
}

export function Footer({ text }) {
  return (
    <div style={{
      borderTop: `1px solid ${C.border}`,
      color: C.dimmer,
      padding: "14px 40px",
      fontSize: 12,
      marginTop: "auto",
      letterSpacing: "0.3px",
    }}>
      {text || "Z5 · Internal Use Only · No Transmission Outside Operational Net"}
    </div>
  );
}

export function DataCard({ title, rows, action }) {
  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: "12px 12px 8px",
      marginBottom: 10,
      background: C.cardBg,
      boxShadow: C.shadow,
    }}>
      {(title || action) && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
          paddingBottom: 8,
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ color: C.bright, fontWeight: 600, fontSize: 14 }}>{title}</div>
          {action}
        </div>
      )}
      {rows.map((r, i) => (
        <div key={i} style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          padding: "6px 0",
          fontSize: 14,
        }}>
          <div style={{
            color: C.dim,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.8px",
            textTransform: "uppercase",
            flexShrink: 0,
          }}>{r.label}</div>
          <div style={{
            color: C.text,
            textAlign: "end",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
          }}>{r.value}</div>
        </div>
      ))}
    </div>
  );
}
