// Z5 :: shared UI primitives
import { useState } from "react";
import { C, S, FONT, FONT_MONO } from "./theme";
import { useIsMobile } from "./useIsMobile";
import { useTheme } from "./ThemeContext";

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
        borderRight: `1px solid ${C.border}`,
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
        borderLeft: `2px solid ${active ? C.bright : "transparent"}`,
        padding: "10px 14px",
        textAlign: "left",
        fontFamily: FONT,
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        letterSpacing: "0.3px",
        transition: "background 140ms ease-out, color 140ms ease-out",
        borderRadius: 0,
        opacity: active ? 1 : 0.92,
      }}
    >
      {children}
    </button>
  );
}

// Bottom tab bar item (mobile).
export function TabItem({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: "transparent",
        border: "none",
        borderTop: `2px solid ${active ? C.bright : "transparent"}`,
        color: active ? C.bright : C.dim,
        fontFamily: FONT,
        fontSize: 11,
        fontWeight: active ? 700 : 500,
        letterSpacing: "0.4px",
        textTransform: "uppercase",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        padding: "8px 4px",
        minWidth: 0,
      }}
    >
      <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
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

// Section heading used at the top of each screen.
// By default the header has an open bottom (no border, top-only rounded
// corners) so a Panel with connectTop can join it. Pass `standalone`
// when nothing connects from below so the header closes itself with a
// full border + full rounded corners.
export function PageHeader({ title, subtitle, action, standalone }) {
  const isMobile = useIsMobile();
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: isMobile ? 8 : 12,
      marginBottom: 0,
      padding: isMobile ? "12px 14px" : "18px 24px",
      border: `1px solid ${C.border}`,
      borderBottom: standalone ? `1px solid ${C.border}` : "none",
      borderRadius: standalone ? 4 : "4px 4px 0 0",
      background: C.headerBg,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{
          margin: 0,
          fontSize: isMobile ? 14 : 22,
          fontWeight: 700,
          color: C.bright,
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          lineHeight: 1.2,
        }}>{title}</h1>
        {subtitle && !isMobile && (
          <div style={{
            color: C.dim,
            fontSize: 13,
            marginTop: 5,
            letterSpacing: "0.3px",
          }}>
            {subtitle}
          </div>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

export function Panel({ title, children, action, connectTop }) {
  const isMobile = useIsMobile();
  const base = isMobile
    ? { ...S.panel, padding: "14px 14px", marginBottom: 14, borderRadius: 6 }
    : { ...S.panel };
  if (connectTop) {
    base.borderRadius = isMobile ? "0 0 6px 6px" : "0 0 4px 4px";
  } else {
    base.marginTop = isMobile ? 14 : 20;
  }
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
      marginRight: inline && !isMobile ? 16 : 0,
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
      borderRadius: 2,
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
      borderRadius: 2,
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
      borderRadius: 2,
    }}>{children}</div>
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
      borderRadius: 4,
      padding: "12px 12px 8px",
      marginBottom: 10,
      background: C.cardBg,
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
            textAlign: "right",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
          }}>{r.value}</div>
        </div>
      ))}
    </div>
  );
}
