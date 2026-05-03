// Z5 :: Hub — landing screen shown on every login.
// Three banners (Terminal / BootCamp / Recruitment). Selecting one
// sets consoleMode and routes the user into Shell. Banners the user
// cannot access render in a disabled state with a "no access" note.

import { useAuth, roleLabelT } from "../auth";
import { useI18n } from "../i18n";
import { useConsole } from "../console";
import { useIsMobile } from "../useIsMobile";
import { Page, Btn, Badge } from "../ui";
import { C, FONT, FONT_MONO } from "../theme";

function ConsoleBanner({ mode, glyph, name, tagline, accent, accentFaint, enabled, noAccessLabel, onClick }) {
  const isMobile = useIsMobile();

  const base = {
    display: "flex",
    alignItems: "stretch",
    background: enabled ? accentFaint : C.cardBg,
    border: `1px solid ${enabled ? accent : C.border}`,
    borderLeftWidth: 4,
    borderLeftColor: enabled ? accent : C.borderBright,
    borderRadius: 4,
    padding: 0,
    cursor: enabled ? "pointer" : "not-allowed",
    fontFamily: FONT,
    color: C.text,
    width: "100%",
    textAlign: "left",
    transition: "all 140ms",
    opacity: enabled ? 1 : 0.55,
    minHeight: isMobile ? 96 : 132,
  };

  return (
    <button
      type="button"
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      aria-label={name}
      style={base}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: isMobile ? 56 : 72,
        flexShrink: 0,
        borderRight: `1px solid ${enabled ? accent : C.border}`,
        background: enabled ? accentFaint : "transparent",
      }}>
        <span aria-hidden style={{
          fontFamily: FONT_MONO,
          fontSize: isMobile ? 26 : 34,
          color: enabled ? accent : C.dimmer,
          lineHeight: 1,
        }}>{glyph}</span>
      </div>
      <div style={{
        flex: 1,
        padding: isMobile ? "12px 14px" : "16px 22px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 6,
        minWidth: 0,
      }}>
        <div style={{
          fontSize: isMobile ? 14 : 17,
          fontWeight: 700,
          letterSpacing: "1.6px",
          textTransform: "uppercase",
          color: enabled ? accent : C.dim,
        }}>{name}</div>
        <div style={{
          fontSize: isMobile ? 12 : 13,
          color: C.dim,
          letterSpacing: "0.3px",
          lineHeight: 1.4,
        }}>{tagline}</div>
        {!enabled && (
          <div style={{ marginTop: 4 }}>
            <Badge tone="warn">{noAccessLabel}</Badge>
          </div>
        )}
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
      glyph: "▣",
      name: t("console.terminal"),
      tagline: t("hub.tagline.terminal"),
      accent: C.consoleTerminal,
      accentFaint: C.consoleTerminalFaint,
      enabled: availableConsoles.terminal,
    },
    {
      mode: "bootcamp",
      glyph: "⊞",
      name: t("console.bootcamp"),
      tagline: t("hub.tagline.bootcamp"),
      accent: C.consoleBootcamp,
      accentFaint: C.consoleBootcampFaint,
      enabled: availableConsoles.bootcamp,
    },
    {
      mode: "recruitment",
      glyph: "⊕",
      name: t("console.recruitment"),
      tagline: t("hub.tagline.recruitment"),
      accent: C.consoleRecruitment,
      accentFaint: C.consoleRecruitmentFaint,
      enabled: availableConsoles.recruitment,
    },
  ];

  return (
    <Page>
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: isMobile ? "flex-start" : "center",
        padding: isMobile
          ? "calc(28px + var(--safe-top)) 18px calc(28px + var(--safe-bottom))"
          : "48px 24px",
        boxSizing: "border-box",
      }}>
        <div style={{
          width: "100%",
          maxWidth: isMobile ? 520 : 980,
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? 22 : 32,
        }}>
          {/* Brand block — Z5 logo + wordmark + welcome */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            paddingBottom: isMobile ? 16 : 24,
            borderBottom: `1px solid ${C.border}`,
          }}>
            <img
              src={`${import.meta.env.BASE_URL}z5-logo.png`}
              alt="Z5"
              style={{
                width: "100%",
                maxWidth: isMobile ? 130 : 170,
                maxHeight: isMobile ? 80 : 110,
                objectFit: "contain",
                display: "block",
              }}
            />
            <div style={{
              color: C.bright,
              fontSize: isMobile ? 18 : 24,
              fontWeight: 800,
              letterSpacing: "3px",
            }}>
              {t("nav.terminal")}
            </div>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: isMobile ? 12 : 13,
              color: C.dim,
              letterSpacing: "0.3px",
              flexWrap: "wrap",
              justifyContent: "center",
            }}>
              <span>{t("hub.welcome")}</span>
              <span style={{
                fontFamily: FONT_MONO,
                color: C.bright,
                fontWeight: 600,
                letterSpacing: "0.5px",
              }}>{profile?.callsign || "—"}</span>
              <span style={{ color: C.dimmer }}>·</span>
              <span>{roleLabelT(profile?.role, t)}</span>
            </div>
          </div>

          {/* Banners */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
            gap: isMobile ? 12 : 16,
          }}>
            {banners.map((b) => (
              <ConsoleBanner
                key={b.mode}
                mode={b.mode}
                glyph={b.glyph}
                name={b.name}
                tagline={b.tagline}
                accent={b.accent}
                accentFaint={b.accentFaint}
                enabled={b.enabled}
                noAccessLabel={t("console.noaccess")}
                onClick={() => setConsoleMode(b.mode)}
              />
            ))}
          </div>

          {/* Sign out */}
          <div style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: isMobile ? 8 : 16,
          }}>
            <Btn small onClick={signOut}>{t("nav.logout")}</Btn>
          </div>
        </div>
      </div>
    </Page>
  );
}
