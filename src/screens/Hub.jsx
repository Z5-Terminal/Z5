// Z5 :: Hub — landing screen shown on every login.
// Three console posters. Selecting one sets consoleMode and routes the
// user into Shell. Posters the user cannot enter stay visible but are
// dimmed and carry a status capsule ("Coming soon" / "No access").
//
// Visual direction: the operator artwork is the hero. Chrome over it is
// minimal — a title, one line of copy and a single translucent capsule —
// and every poster answers a press immediately.

import { useState } from "react";
import { useAuth, roleLabelT } from "../auth";
import { useI18n } from "../i18n";
import { useConsole } from "../console";
import { useTheme } from "../ThemeContext";
import { useIsMobile } from "../useIsMobile";
import { Page, Btn, Mono, Icon } from "../ui";
import { C, FONT, MATERIAL, R, T } from "../theme";
import { MOTION, DURATION } from "../motion";

// Full-bleed hero poster card. The operator artwork (public/hero-*.jpg)
// fills the card; title + tagline sit over a bottom gradient. If the
// hero image is missing, falls back to the console icon centered on
// black, so the Hub works before the artwork is dropped in.
// Posters are image contexts: their pixels do not follow the theme the
// way surfaces do, so everything drawn over them uses the poster / image
// tokens (paper + ink for the light artwork, black + white otherwise).
function PosterCard({
  heroSrc, iconSrc, name, tagline, enabled, comingSoon, noAccessLabel,
  comingSoonLabel, enterLabel, onSelect, isLight, delay = 0,
}) {
  const isMobile = useIsMobile();
  const [hover, setHover] = useState(false);
  // Source fallback chain: light-mode variant (when in light theme), then
  // the dark artwork, then the console icon. onError advances the chain.
  const sources = isLight ? [heroSrc.replace(".jpg", "-light.jpg"), heroSrc] : [heroSrc];
  const [srcIdx, setSrcIdx] = useState(0);
  const activeSrc = srcIdx < sources.length ? sources[srcIdx] : null;

  const locked = comingSoon || !enabled;
  const lit = !locked && hover;

  // Paper poster (light artwork) or dark poster (dark artwork / icon).
  const paper = isLight && srcIdx === 0;
  const ink = paper ? C.posterInk : C.imageOverlayText;
  const backdrop = paper ? C.posterPaper : C.imageSurface;
  const tint = paper ? C.overlay : C.imageTint;          // ink direction
  const shade = paper ? C.overlayInverse : C.imageShade; // backdrop direction

  // Hover is a pointer-only nicety (artwork zoom + lift); touch gets its
  // feedback from the press state alone.
  const onPointerEnter = (e) => { if (e.pointerType !== "touch") setHover(true); };
  const onPointerLeave = () => { setHover(false); };

  const handleClick = () => {
    if (locked) return;
    onSelect();
  };

  const capsule = {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    minHeight: 30,
    boxSizing: "border-box",
    borderRadius: R.pill,
    ...T.footnote,
    fontWeight: 600,
    whiteSpace: "nowrap",
    color: ink,
    ...MATERIAL.bar,
  };

  return (
    <div
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{
        minWidth: 0,
        animation: `z5-rise ${DURATION.move}ms var(--z5-spring) ${delay}ms backwards`,
        transform: lit ? "translateY(-4px)" : "none",
        transition: `transform ${MOTION.move}`,
      }}
    >
      <button
        type="button"
        data-press="scale"
        data-press-depth="soft"
        onClick={handleClick}
        disabled={locked}
        aria-label={name}
        style={{
          all: "unset",
          boxSizing: "border-box",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          width: "100%",
          // Desktop: height budgeted from the viewport so the whole Hub
          // (brand + posters + footer) fits one screen; mobile keeps a
          // portrait ratio and scrolls naturally.
          aspectRatio: isMobile ? "4 / 5" : "auto",
          height: isMobile ? "auto" : "min(52vh, 520px)",
          minHeight: isMobile ? 0 : 300,
          maxHeight: isMobile ? 420 : 520,
          borderRadius: R.sheet,
          overflow: "hidden",
          isolation: "isolate",
          border: `1px solid ${C.border}`,
          background: backdrop,
          fontFamily: FONT,
          textAlign: "start",
          cursor: locked ? "default" : "pointer",
          boxShadow: lit ? C.shadowLg : C.shadow,
          // The locked state is drawn on the artwork itself; don't let the
          // global disabled dimming fade the whole poster as well.
          opacity: 1,
        }}
      >
        {/* Artwork */}
        {activeSrc ? (
          <img
            key={activeSrc}
            src={activeSrc}
            alt=""
            aria-hidden
            onError={() => setSrcIdx((i) => i + 1)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              // Locked artwork recedes into its own backdrop: toward
              // paper on the light poster, toward black on the dark one.
              filter: locked
                ? (paper ? "grayscale(1) opacity(0.34)" : "grayscale(1) brightness(0.42)")
                : "none",
              transform: lit ? "scale(1.04)" : "none",
              transition: `transform ${MOTION.move}, filter ${MOTION.fade}`,
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

        {/* Bottom gradient for text legibility — follows the artwork:
            dark posters get a black fade, light posters a paper fade. */}
        <div aria-hidden style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to top, ${shade}0.96) 0%, ${shade}0.72) 24%, ${shade}0) 54%)`,
        }} />

        {/* Copy */}
        <div style={{
          position: "relative",
          padding: isMobile ? "16px 18px 18px" : "20px 22px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              flex: 1,
              minWidth: 0,
              ...T.title2,
              color: locked ? `${tint}0.62)` : ink,
              overflowWrap: "break-word",
            }}>
              {name}
            </div>
            {locked ? (
              <span data-material="" style={{
                ...capsule,
                paddingInline: "10px 12px",
                gap: 5,
                background: `${tint}0.08)`,
              }}>
                <Icon name={comingSoon ? "clock" : "lock"} size={13} strokeWidth={2.2} />
                {comingSoon ? comingSoonLabel : noAccessLabel}
              </span>
            ) : (
              <span data-material="" style={{
                ...capsule,
                paddingInline: "13px 9px",
                background: `${tint}${lit ? "0.18)" : "0.10)"}`,
                transition: `background-color ${MOTION.fade}`,
              }}>
                {enterLabel}
                <Icon name="chevronForward" size={13} strokeWidth={2.4} flip />
              </span>
            )}
          </div>
          <div style={{
            ...T.footnote,
            color: locked ? `${tint}0.55)` : `${tint}0.72)`,
            // Side by side, every poster reserves two lines so the titles
            // and capsules line up across the row.
            minHeight: isMobile ? 0 : "2.8em",
          }}>
            {tagline}
          </div>
        </div>
      </button>
    </div>
  );
}

export default function Hub() {
  const { profile, signOut } = useAuth();
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
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        padding: isMobile
          ? "calc(24px + var(--safe-top)) 16px calc(16px + var(--safe-bottom))"
          : "24px 24px 16px",
      }}>
        {/* The way out — quiet, in the top trailing corner. */}
        <div style={{
          position: "absolute",
          top: isMobile ? "calc(6px + var(--safe-top))" : 16,
          insetInlineEnd: isMobile ? 8 : 20,
        }}>
          <Btn
            plain
            small
            type="button"
            icon="logout"
            iconFlip
            onClick={() => signOut()}
            style={{ color: C.dim, ...(isMobile ? { minHeight: 44 } : null) }}
          >
            {t("nav.logout")}
          </Btn>
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
            maxWidth: isMobile ? 520 : 1100,
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? 22 : 28,
          }}>
            {/* Brand block */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}>
              <img
                src={`${import.meta.env.BASE_URL}z5-logo.png`}
                alt="Z5"
                style={{
                  width: "100%",
                  maxWidth: isMobile ? 170 : 200,
                  maxHeight: isMobile ? 95 : 105,
                  objectFit: "contain",
                  display: "block",
                  marginBottom: 12,
                  filter: isLight ? "none" : "invert(0.9)",
                }}
              />
              <h1 style={{
                margin: 0,
                ...(isMobile ? T.title1 : T.largeTitle),
                color: C.bright,
              }}>
                {t("nav.terminal")}
              </h1>
              <div style={{
                marginTop: 6,
                maxWidth: "100%",
                ...T.footnote,
                color: C.dim,
              }}>
                <span>{t("hub.status.operator")}: </span>
                <Mono style={{ color: C.text, fontWeight: 600 }}>{profile?.callsign || "—"}</Mono>
                <span aria-hidden style={{ color: C.dimmer, margin: "0 8px" }}>·</span>
                <span>{t("hub.status.clearance")}: </span>
                <span style={{ color: C.text, fontWeight: 600 }}>{roleLabelT(profile?.role, t)}</span>
              </div>
            </div>

            {/* Poster wall — three hero cards */}
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
              gap: isMobile ? 14 : 20,
            }}>
              {banners.map((b, i) => (
                <PosterCard
                  key={b.mode}
                  heroSrc={`${import.meta.env.BASE_URL}hero-${b.mode}.jpg`}
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
                  delay={i * 70}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          paddingTop: isMobile ? 18 : 16,
          textAlign: "center",
          ...T.caption,
          color: C.dimmer,
        }}>
          {t("auth.footer")}
        </div>
      </div>
    </Page>
  );
}
