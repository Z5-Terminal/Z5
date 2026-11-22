// Z5 :: Hub — landing screen shown on every login.
// Three console posters. Selecting one sets consoleMode and routes the
// user into Shell. Posters the user cannot enter stay visible but are
// dimmed (their status is announced to screen readers).
//
// Visual direction: the operator artwork is the hero. Chrome over it is
// minimal — just the console name over the artwork —
// and every poster answers a press immediately.

import { useEffect, useState } from "react";
import { useAuth, roleLabelT } from "../auth";
import { useI18n } from "../i18n";
import { useConsole } from "../console";
import { useTheme } from "../ThemeContext";
import { useIsMobile } from "../useIsMobile";
import { Page, Btn, Mono } from "../ui";
import { C, FONT, R, T } from "../theme";
import { MOTION, DURATION } from "../motion";
import DotHero from "../DotHero";

// Full-bleed hero poster card. The operator artwork (public/hero-*.jpg)
// fills the card; the console name sits over a bottom fade. If the
// hero image is missing, falls back to the console icon centered on
// black, so the Hub works before the artwork is dropped in.
// Posters are image contexts: their pixels do not follow the theme the
// way surfaces do, so everything drawn over them uses the poster / image
// tokens (paper + ink for the light artwork, black + white otherwise).
function PosterCard({
  heroSrc, dotsSrc, iconSrc, name, enabled, comingSoon, noAccessLabel,
  comingSoonLabel, onSelect, isLight, delay = 0,
}) {
  const isMobile = useIsMobile();
  const [hover, setHover] = useState(false);
  // Source fallback chain: the light (ink-on-paper) art in the light theme,
  // then the dark art, then the console icon. onError advances the chain.
  const sources = isLight ? [heroSrc.replace(".jpg", "-light.jpg"), heroSrc] : [heroSrc];
  const [srcIdx, setSrcIdx] = useState(0);
  useEffect(() => { setSrcIdx(0); }, [isLight]);
  const activeSrc = srcIdx < sources.length ? sources[srcIdx] : null;

  const locked = comingSoon || !enabled;
  const lit = !locked && hover;

  // Paper poster (light art) or dark poster (dark art / icon). The poster
  // has no frame: its backdrop and the text fade are the page colour, so
  // the soldier stands directly on the page in either theme.
  const paper = isLight && srcIdx === 0;
  const ink = paper ? C.posterInk : C.imageOverlayText;
  const backdrop = paper ? C.bg : C.imageSurface;
  const tint = paper ? C.overlay : C.imageTint;          // ink direction
  const shade = paper ? C.pageFade : C.imageShade;       // backdrop direction

  // Hover is a pointer-only nicety (artwork zoom + lift); touch gets its
  // feedback from the press state alone.
  const onPointerEnter = (e) => { if (e.pointerType !== "touch") setHover(true); };
  const onPointerLeave = () => { setHover(false); };

  const handleClick = () => {
    if (locked) return;
    onSelect();
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
        aria-label={locked ? `${name} — ${comingSoon ? comingSoonLabel : noAccessLabel}` : name}
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
          height: isMobile ? "auto" : "min(60vh, 600px)",
          minHeight: isMobile ? 0 : 320,
          maxHeight: isMobile ? 520 : 600,
          borderRadius: R.sheet,
          overflow: "hidden",
          isolation: "isolate",
          border: "none",
          background: backdrop,
          fontFamily: FONT,
          textAlign: "start",
          cursor: locked ? "default" : "pointer",
          boxShadow: "none",
          // The locked state is drawn on the artwork itself; don't let the
          // global disabled dimming fade the whole poster as well.
          opacity: 1,
        }}
      >
        {/* Artwork */}
        {activeSrc ? (
          // Dot-art soldier: a still image first, then an interactive dot
          // field that scatters from the pointer (enterable posters only).
          <DotHero
            key={activeSrc}
            fallbackSrc={activeSrc}
            dotsSrc={paper ? dotsSrc.replace(".bin", "-light.bin") : dotsSrc}
            variant={paper ? "light" : "dark"}
            interactive={!locked}
            onError={() => setSrcIdx((i) => i + 1)}
            style={{
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
          background: `linear-gradient(to top, ${shade}0.94) 0%, ${shade}0.6) 14%, ${shade}0) 34%)`,
        }} />

        {/* Name — the only text on the poster, centred under the figure */}
        <div style={{
          position: "relative",
          padding: isMobile ? "16px 18px 18px" : "20px 22px 22px",
          textAlign: "center",
          ...T.title1,
          color: locked ? `${tint}0.62)` : ink,
          overflowWrap: "break-word",
        }}>
          {name}
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
      enabled: availableConsoles.terminal,
      comingSoon: isLocked("terminal"),
    },
    {
      mode: "bootcamp",
      iconSrc: "icon-bootcamp.png",
      name: t("console.bootcamp"),
      enabled: availableConsoles.bootcamp,
      comingSoon: isLocked("bootcamp"),
    },
    {
      mode: "recruitment",
      iconSrc: "icon-recruitment.png",
      name: t("console.recruitment"),
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
                  dotsSrc={`${import.meta.env.BASE_URL}hero-dots-${b.mode}.bin`}
                  iconSrc={b.iconSrc}
                  name={b.name}
                  enabled={b.enabled}
                  comingSoon={b.comingSoon}
                  noAccessLabel={t("console.noaccess")}
                  comingSoonLabel={t("console.coming_soon")}
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
