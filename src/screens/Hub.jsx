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
import { useTheme } from "../ThemeContext";
import { useIsMobile } from "../useIsMobile";
import { Page } from "../ui";
import { C, FONT, FONT_MONO } from "../theme";

function ConsoleRow({ iconSrc, name, tagline, enabled, comingSoon, noAccessLabel, comingSoonLabel, onSelect, isLight }) {
  const isMobile = useIsMobile();
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pressed, setPressed] = useState(false);

  // "Locked" subsumes both feature-not-ready ("Coming soon") and
  // user-has-no-access. Either state blocks the click and dims the row.
  const locked = comingSoon || !enabled;

  // Background fill is driven by hover + pressed only. Focus is
  // intentionally NOT in the lit predicate: on desktop browsers
  // (Chrome/Firefox) clicking a button gives it focus, which used to
  // leave the row stuck grey after the user moved their mouse away.
  // The keyboard focus-ring still draws via boxShadow below, so a11y
  // is preserved.
  const lit = !locked && (hover || pressed);
  const TRANS = "background 220ms ease-out, border-color 220ms ease-out, transform 160ms ease-out, box-shadow 220ms ease-out";

  // Skip hover state on touch — iOS Safari leaves the row in a sticky
  // :hover-equivalent after a tap because there's no corresponding
  // pointerleave for touch, so we filter touch pointer types out.
  const onPointerEnter = (e) => { if (e.pointerType !== "touch") setHover(true); };
  const onPointerLeave = () => { setHover(false); setPressed(false); };

  // Hold the press state visible for ~120ms before navigating so the
  // tap feedback actually paints. Also blur the button after the
  // click so the focus ring doesn't persist on desktop click.
  const handleClick = (e) => {
    if (locked) return;
    setPressed(true);
    if (e && e.currentTarget && typeof e.currentTarget.blur === "function") {
      e.currentTarget.blur();
    }
    window.setTimeout(() => { onSelect(); }, 120);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      disabled={locked}
      aria-label={name}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "stretch",
        background: lit ? C.hoverBg : "transparent",
        color: C.text,
        border: `1px solid ${lit ? C.borderBright : C.border}`,
        borderLeftWidth: lit ? 4 : 3,
        borderLeftColor: locked ? C.borderBright : C.bright,
        borderRadius: 0,
        padding: 0,
        fontFamily: FONT,
        cursor: locked ? "not-allowed" : "pointer",
        textAlign: "left",
        opacity: locked ? 0.5 : 1,
        minHeight: isMobile ? 92 : 108,
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
        width: isMobile ? 88 : 130,
      }}>
        <img
          src={`${import.meta.env.BASE_URL}${iconSrc}`}
          alt=""
          style={{
            width: isMobile ? 48 : 72,
            height: isMobile ? 48 : 72,
            objectFit: "contain",
            opacity: locked ? 0.4 : 0.92,
            // Icons are pre-baked as white silhouettes with a real
            // alpha channel. Dark mode shows them as-is. Light mode
            // uses brightness(0) to recolor the white silhouette to
            // black while preserving the alpha — no blend-mode
            // tricks, no white rectangle leak.
            filter: isLight ? "brightness(0)" : "none",
          }}
        />
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
          color: locked ? C.dim : C.bright,
          letterSpacing: "2.5px",
          textTransform: "uppercase",
        }}>
          {name}
        </div>
        <div style={{
          fontSize: isMobile ? 12 : 13,
          color: locked ? C.dim : C.text,
          opacity: locked ? 1 : 0.78,
          letterSpacing: "0.2px",
          lineHeight: 1.45,
        }}>
          {tagline}
        </div>
        {comingSoon && (
          <div style={{
            fontSize: 10,
            color: C.dim,
            letterSpacing: "1.5px",
            marginTop: 2,
            textTransform: "uppercase",
            fontWeight: 600,
          }}>
            {comingSoonLabel}
          </div>
        )}
        {!comingSoon && !enabled && (
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
        color: lit ? C.bright : (locked ? C.dim : C.text),
        opacity: locked ? 1 : (lit ? 1 : 0.6),
        transform: lit ? "translateX(4px)" : "translateX(0)",
        transition: "color 220ms ease-out, transform 220ms ease-out, opacity 220ms ease-out",
      }}>
        {"›"}
      </div>
    </button>
  );
}

export default function Hub() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const { setConsoleMode, availableConsoles } = useConsole();
  const { mode } = useTheme();
  const isMobile = useIsMobile();
  const isLight = mode === "light";

  // Consoles locked for everyone regardless of role. The banner still
  // renders so users can see what's planned, but it's unclickable and
  // shows a "Coming soon" label in place of the no-access tag.
  const LOCKED_CONSOLES = ["bootcamp"];
  const isLocked = (mode) => LOCKED_CONSOLES.includes(mode);

  const banners = [
    {
      mode: "terminal",
      iconSrc: "icon-terminal.png",
      name: t("console.terminal"),
      tagline: t("hub.tagline.terminal"),
      enabled: availableConsoles.terminal,
      comingSoon: isLocked("terminal"),
    },
    {
      mode: "bootcamp",
      iconSrc: "icon-bootcamp.png",
      name: t("console.bootcamp"),
      tagline: t("hub.tagline.bootcamp"),
      enabled: availableConsoles.bootcamp,
      comingSoon: isLocked("bootcamp"),
    },
    {
      mode: "recruitment",
      iconSrc: "icon-recruitment.png",
      name: t("console.recruitment"),
      tagline: t("hub.tagline.recruitment"),
      enabled: availableConsoles.recruitment,
      comingSoon: isLocked("recruitment"),
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
          ? "calc(28px + var(--safe-top)) 16px calc(16px + var(--safe-bottom))"
          : "48px 24px",
      }}>
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
                  maxWidth: isMobile ? 240 : 360,
                  maxHeight: isMobile ? 160 : 240,
                  objectFit: "contain",
                  display: "block",
                }}
              />
              <div style={{
                color: C.bright,
                fontSize: isMobile ? 22 : 38,
                fontWeight: 800,
                letterSpacing: isMobile ? "5px" : "7px",
              }}>
                {t("nav.terminal")}
              </div>
              <div style={{
                fontFamily: FONT_MONO,
                fontSize: isMobile ? 13 : 15,
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
                  iconSrc={b.iconSrc}
                  name={b.name}
                  tagline={b.tagline}
                  enabled={b.enabled}
                  noAccessLabel={t("console.noaccess")}
                  comingSoonLabel={t("console.coming_soon")}
                  onSelect={() => setConsoleMode(b.mode)}
                  isLight={isLight}
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
