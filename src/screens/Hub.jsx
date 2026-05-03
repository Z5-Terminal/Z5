// Z5 :: Hub — landing screen shown on every login.
// Three banners stacked vertically as a console list. Selecting one
// sets consoleMode and routes the user into Shell. Banners the user
// cannot access render in a disabled state with a 'No access' tag.
//
// Visual direction: monochrome instrument-panel with snappy hover/focus
// feedback and a clear pressed state on touch. No chromas, no glyphs,
// no card fills — interactivity is communicated through state
// transitions, not decoration.

import { useState } from "react";
import { useAuth, roleLabelT } from "../auth";
import { useI18n } from "../i18n";
import { useConsole } from "../console";
import { useIsMobile } from "../useIsMobile";
import { Page } from "../ui";
import { C, FONT, FONT_MONO } from "../theme";

function ConsoleRow({ prefix, name, tagline, enabled, noAccessLabel, onSelect }) {
  const isMobile = useIsMobile();
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pressed, setPressed] = useState(false);
  const lit = enabled && (hover || focus || pressed);
  const TRANS = "background 220ms ease-out, border-color 220ms ease-out, transform 160ms ease-out, box-shadow 220ms ease-out";

  // Hold the press state visible for ~120ms before navigating so the
  // tap feedback actually paints — otherwise the screen swaps before
  // the user sees anything change.
  const handleClick = () => {
    if (!enabled) return;
    setPressed(true);
    window.setTimeout(() => { onSelect(); }, 120);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPressed(false); }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      disabled={!enabled}
      aria-label={name}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "stretch",
        background: lit ? C.hoverBg : "transparent",
        color: C.text,
        border: `1px solid ${lit ? C.borderBright : C.border}`,
        borderLeftWidth: lit ? 4 : 3,
        borderLeftColor: enabled ? C.bright : C.borderBright,
        borderRadius: 0,
        padding: 0,
        fontFamily: FONT,
        cursor: enabled ? "pointer" : "not-allowed",
        textAlign: "left",
        opacity: enabled ? 1 : 0.5,
        minHeight: isMobile ? 78 : 88,
        transition: TRANS,
        transform: pressed ? "scale(0.99)" : "scale(1)",
        boxShadow: focus ? `0 0 0 1px ${C.bright}` : "none",
        outline: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: isMobile ? 50 : 70,
        fontFamily: FONT_MONO,
        fontSize: isMobile ? 16 : 20,
        color: enabled ? C.text : C.dim,
        letterSpacing: "1px",
        fontWeight: 600,
      }}>
        {prefix}
      </div>

      <div style={{
        flex: 1,
        padding: isMobile ? "12px 8px 12px 4px" : "16px 10px 16px 4px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 6,
        minWidth: 0,
      }}>
        <div style={{
          fontSize: isMobile ? 13 : 16,
          fontWeight: 700,
          color: enabled ? C.bright : C.dim,
          letterSpacing: "2.5px",
          textTransform: "uppercase",
        }}>
          {name}
        </div>
        <div style={{
          fontSize: isMobile ? 12 : 13,
          color: enabled ? C.text : C.dim,
          opacity: enabled ? 0.78 : 1,
          letterSpacing: "0.2px",
          lineHeight: 1.45,
        }}>
          {tagline}
        </div>
        {!enabled && (
          <div style={{
            fontSize: 10,
            color: C.warn,
            letterSpacing: "1.5px",
            marginTop: 2,
            textTransform: "uppercase",
            fontWeight: 600,
          }}>
            {noAccessLabel}
          </div>
        )}
      </div>

      <div style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: isMobile ? 44 : 60,
        fontSize: 24,
        color: lit ? C.bright : (enabled ? C.text : C.dim),
        opacity: enabled ? (lit ? 1 : 0.6) : 1,
        transform: lit ? "translateX(4px)" : "translateX(0)",
        transition: "color 220ms ease-out, transform 220ms ease-out, opacity 220ms ease-out",
      }}>
        {"›"}
      </div>
    </button>
  );
}

export default function Hub() {
  const { profile, signOut } = useAuth();
  const { t } = useI18n();
  const { setConsoleMode, availableConsoles } = useConsole();
  const isMobile = useIsMobile();

  const banners = [
    {
      mode: "terminal",
      name: t("console.terminal"),
      tagline: t("hub.tagline.terminal"),
      enabled: availableConsoles.terminal,
    },
    {
      mode: "bootcamp",
      name: t("console.bootcamp"),
      tagline: t("hub.tagline.bootcamp"),
      enabled: availableConsoles.bootcamp,
    },
    {
      mode: "recruitment",
      name: t("console.recruitment"),
      tagline: t("hub.tagline.recruitment"),
      enabled: availableConsoles.recruitment,
    },
  ];

  return (
    <Page>
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        padding: isMobile
          ? "calc(16px + var(--safe-top)) 16px calc(16px + var(--safe-bottom))"
          : "32px 24px",
      }}>
        {/* Top strip: just the LOG OUT button on the right */}
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          width: "100%",
          maxWidth: isMobile ? "100%" : 760,
          margin: "0 auto",
          paddingBottom: isMobile ? 18 : 24,
        }}>
          <button
            onClick={signOut}
            aria-label={t("nav.logout")}
            style={{
              background: "transparent",
              border: `1px solid ${C.border}`,
              color: C.text,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              borderRadius: 2,
              padding: "6px 14px",
              minHeight: 30,
              cursor: "pointer",
              transition: "background 180ms ease-out, border-color 180ms ease-out",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; e.currentTarget.style.borderColor = C.borderBright; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = C.border; }}
          >
            {t("nav.logout")}
          </button>
        </div>

        {/* Main content centered */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: isMobile ? "flex-start" : "center",
          width: "100%",
        }}>
          <div style={{
            width: "100%",
            maxWidth: isMobile ? 520 : 760,
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? 22 : 32,
          }}>
            {/* Brand block */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: isMobile ? 14 : 18,
              paddingBottom: isMobile ? 18 : 30,
              borderBottom: `1px solid ${C.border}`,
            }}>
              <img
                src={`${import.meta.env.BASE_URL}z5-logo.png`}
                alt="Z5"
                style={{
                  width: "100%",
                  maxWidth: isMobile ? 130 : 220,
                  maxHeight: isMobile ? 80 : 140,
                  objectFit: "contain",
                  display: "block",
                }}
              />
              <div style={{
                color: C.bright,
                fontSize: isMobile ? 18 : 32,
                fontWeight: 800,
                letterSpacing: isMobile ? "4px" : "6px",
              }}>
                {t("nav.terminal")}
              </div>
              <div style={{
                fontFamily: FONT_MONO,
                fontSize: isMobile ? 11 : 13,
                letterSpacing: "0.4px",
                textAlign: "center",
                lineHeight: 1.6,
                maxWidth: "100%",
                color: C.dim,
              }}>
                <span>{t("hub.status.operator")}: </span>
                <span style={{ color: C.text, fontWeight: 700 }}>{profile?.callsign || "—"}</span>
                <span style={{ color: C.dimmer, margin: "0 10px" }}>·</span>
                <span>{t("hub.status.clearance")}: </span>
                <span style={{ color: C.text, fontWeight: 700 }}>{roleLabelT(profile?.role, t)}</span>
              </div>
            </div>

            {/* Banner list */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: isMobile ? 10 : 14,
            }}>
              {banners.map((b) => (
                <ConsoleRow
                  key={b.mode}
                  prefix="//"
                  name={b.name}
                  tagline={b.tagline}
                  enabled={b.enabled}
                  noAccessLabel={t("console.noaccess")}
                  onSelect={() => setConsoleMode(b.mode)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          paddingTop: isMobile ? 18 : 24,
          textAlign: "center",
          fontFamily: FONT_MONO,
          fontSize: isMobile ? 10 : 11,
          color: C.dim,
          letterSpacing: "1.4px",
          textTransform: "uppercase",
        }}>
          {t("auth.footer")}
        </div>
      </div>
    </Page>
  );
}
