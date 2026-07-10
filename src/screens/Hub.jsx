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

// Full-bleed hero poster card. The operator artwork (public/hero-*.png)
// fills the card; title + tagline sit over a bottom gradient. If the
// hero image is missing, falls back to the console icon centered on
// black, so the Hub works before the artwork is dropped in.
// Poster cards are photographic and intrinsically dark in BOTH themes,
// so the black backdrop / white overlay text here are deliberate
// image-context literals, not theme-token violations.
function PosterCard({ heroSrc, iconSrc, name, tagline, enabled, comingSoon, noAccessLabel, comingSoonLabel, enterLabel, onSelect, isLight }) {
  const isMobile = useIsMobile();
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [imgOk, setImgOk] = useState(true);

  const locked = comingSoon || !enabled;
  const lit = !locked && (hover || pressed);

  const onPointerEnter = (e) => { if (e.pointerType !== "touch") setHover(true); };
  const onPointerLeave = () => { setHover(false); setPressed(false); };

  const handleClick = (e) => {
    if (locked) return;
    setPressed(true);
    if (e?.currentTarget?.blur) e.currentTarget.blur();
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
      disabled={locked}
      aria-label={name}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        width: "100%",
        aspectRatio: isMobile ? "4 / 5" : "9 / 14",
        maxHeight: isMobile ? 440 : 640,
        borderRadius: 18,
        overflow: "hidden",
        border: `1px solid ${lit ? C.borderBright : C.border}`,
        background: "#000",
        padding: 0,
        fontFamily: FONT,
        textAlign: "start",
        cursor: locked ? "not-allowed" : "pointer",
        transform: pressed ? "scale(0.985)" : "scale(1)",
        transition: "transform 160ms ease-out, border-color 220ms ease-out, box-shadow 220ms ease-out",
        boxShadow: lit ? "0 16px 44px rgba(0,0,0,0.5)" : "none",
        outline: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Artwork */}
      {imgOk && heroSrc ? (
        <img
          src={heroSrc}
          alt=""
          aria-hidden
          onError={() => setImgOk(false)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            filter: locked ? "grayscale(1) brightness(0.42)" : "none",
            transform: lit ? "scale(1.05)" : "scale(1)",
            transition: "transform 700ms cubic-bezier(0.22, 1, 0.36, 1), filter 220ms ease-out",
          }}
        />
      ) : (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <img
            src={`${import.meta.env.BASE_URL}${iconSrc}`}
            alt=""
            style={{
              width: isMobile ? 72 : 96,
              height: isMobile ? 72 : 96,
              objectFit: "contain",
              opacity: locked ? 0.3 : 0.75,
            }}
          />
        </div>
      )}

      {/* Bottom gradient for text legibility */}
      <div aria-hidden style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.62) 24%, rgba(0,0,0,0) 52%)",
      }} />

      {/* Copy */}
      <div style={{
        position: "relative",
        padding: isMobile ? "16px 16px 18px" : "20px 20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}>
        <div style={{
          fontSize: isMobile ? 16 : 18,
          fontWeight: 800,
          letterSpacing: "3px",
          textTransform: "uppercase",
          color: "#fff",
        }}>
          {name}
        </div>
        <div style={{
          fontSize: isMobile ? 12 : 13,
          lineHeight: 1.5,
          color: "rgba(255,255,255,0.72)",
        }}>
          {tagline}
        </div>
        {comingSoon && (
          <div style={{
            marginTop: 4,
            fontFamily: FONT_MONO,
            fontSize: 10,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            fontWeight: 600,
            color: "rgba(255,255,255,0.55)",
          }}>
            {comingSoonLabel}
          </div>
        )}
        {!comingSoon && !enabled && (
          <div style={{
            marginTop: 4,
            fontFamily: FONT_MONO,
            fontSize: 10,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            fontWeight: 600,
            color: C.warn,
          }}>
            {noAccessLabel}
          </div>
        )}
        {!locked && (
          <div style={{
            marginTop: 6,
            fontFamily: FONT_MONO,
            fontSize: 11,
            letterSpacing: "2px",
            textTransform: "uppercase",
            fontWeight: 700,
            color: "#fff",
            opacity: lit ? 1 : 0.55,
            transition: "opacity 200ms ease-out",
          }}>
            {enterLabel} ›
          </div>
        )}
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
            maxWidth: isMobile ? 520 : 1100,
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
                  filter: isLight ? "none" : "invert(0.9)",
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

            {/* Poster wall — three vertical hero cards */}
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
              gap: isMobile ? 14 : 20,
            }}>
              {banners.map((b) => (
                <PosterCard
                  key={b.mode}
                  heroSrc={`${import.meta.env.BASE_URL}hero-${b.mode}.png`}
                  iconSrc={b.iconSrc}
                  name={b.name}
                  tagline={b.tagline}
                  enabled={b.enabled}
                  comingSoon={b.comingSoon}
                  noAccessLabel={t("console.noaccess")}
                  comingSoonLabel={t("console.coming_soon")}
                  enterLabel={t("hub.enter")}
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
