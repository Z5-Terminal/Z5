// Z5 :: Hub — landing screen shown on every login.
// Three banners stacked vertically as a numbered console list. Selecting
// one sets consoleMode and routes the user into Shell. Banners the user
// cannot access render in a disabled state with a 'No access' tag.
//
// Visual direction: fully monochrome, instrument-panel style.
//   - 3px white left bar on every banner (no chromas)
//   - Mono [ 0N ] numbering
//   - White title, dim tagline, dim chevron on the right
//   - Mono status strip in the brand block

import { useAuth, roleLabelT } from "../auth";
import { useI18n } from "../i18n";
import { useConsole } from "../console";
import { useIsMobile } from "../useIsMobile";
import { Page } from "../ui";
import { C, FONT, FONT_MONO } from "../theme";

function ConsoleRow({ num, name, tagline, enabled, noAccessLabel, onClick }) {
  const isMobile = useIsMobile();

  return (
    <button
      type="button"
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      aria-label={name}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "stretch",
        background: "transparent",
        color: C.text,
        border: `1px solid ${C.border}`,
        borderLeftWidth: 3,
        borderLeftColor: enabled ? C.bright : C.borderBright,
        borderRadius: 0,
        padding: 0,
        fontFamily: FONT,
        cursor: enabled ? "pointer" : "not-allowed",
        textAlign: "left",
        transition: "all 140ms",
        opacity: enabled ? 1 : 0.5,
        minHeight: isMobile ? 78 : 84,
      }}
    >
      <div style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: isMobile ? 70 : 96,
        fontFamily: FONT_MONO,
        fontSize: isMobile ? 12 : 13,
        color: C.dim,
        letterSpacing: "2px",
      }}>
        {num}
      </div>

      <div style={{
        flex: 1,
        padding: isMobile ? "12px 6px" : "16px 6px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 6,
        minWidth: 0,
      }}>
        <div style={{
          fontSize: isMobile ? 13 : 15,
          fontWeight: 700,
          color: enabled ? C.bright : C.dim,
          letterSpacing: "2.5px",
          textTransform: "uppercase",
        }}>
          {name}
        </div>
        <div style={{
          fontSize: 12,
          color: C.dim,
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
        width: isMobile ? 44 : 56,
        fontSize: 22,
        color: enabled ? C.dim : C.dimmer,
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
      num: "[ 01 ]",
      name: t("console.terminal"),
      tagline: t("hub.tagline.terminal"),
      enabled: availableConsoles.terminal,
    },
    {
      mode: "bootcamp",
      num: "[ 02 ]",
      name: t("console.bootcamp"),
      tagline: t("hub.tagline.bootcamp"),
      enabled: availableConsoles.bootcamp,
    },
    {
      mode: "recruitment",
      num: "[ 03 ]",
      name: t("console.recruitment"),
      tagline: t("hub.tagline.recruitment"),
      enabled: availableConsoles.recruitment,
    },
  ];

  const availableCount = banners.filter((b) => b.enabled).length;

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
        {/* Top strip: Z5 // HUB on left, LOG OUT on right */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          maxWidth: isMobile ? "100%" : 720,
          margin: "0 auto",
          paddingBottom: isMobile ? 18 : 24,
        }}>
          <div style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: C.dim,
            letterSpacing: "2px",
          }}>
            Z5 // HUB
          </div>
          <button
            onClick={signOut}
            aria-label={t("nav.logout")}
            style={{
              background: "transparent",
              border: `1px solid ${C.border}`,
              color: C.dim,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              borderRadius: 2,
              padding: "6px 12px",
              minHeight: 30,
              cursor: "pointer",
            }}
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
            maxWidth: isMobile ? 520 : 720,
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? 22 : 30,
          }}>
            {/* Brand block */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              paddingBottom: isMobile ? 18 : 26,
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
                letterSpacing: "4px",
              }}>
                {t("nav.terminal")}
              </div>
              <div style={{
                fontFamily: FONT_MONO,
                fontSize: isMobile ? 10 : 11,
                color: C.dimmer,
                letterSpacing: "1.4px",
                textAlign: "center",
                lineHeight: 1.6,
                textTransform: "uppercase",
                maxWidth: "100%",
              }}>
                <span>{t("hub.status.operator")}</span>
                {" · "}
                <span style={{ color: C.dim, fontWeight: 600 }}>{profile?.callsign || "—"}</span>
                {" · "}
                <span>{t("hub.status.clearance")}: <span style={{ color: C.dim, fontWeight: 600 }}>{roleLabelT(profile?.role, t)}</span></span>
                {" · "}
                <span>{t("hub.status.consoles_available")}: <span style={{ color: C.dim, fontWeight: 600 }}>{availableCount}</span></span>
              </div>
            </div>

            {/* SELECT CONSOLE marker */}
            <div style={{
              display: "flex",
              justifyContent: "center",
            }}>
              <div style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                color: C.dimmer,
                letterSpacing: "2.5px",
                textTransform: "uppercase",
              }}>
                {"› "}{t("hub.select_console")}
              </div>
            </div>

            {/* Banner list */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: isMobile ? 10 : 12,
            }}>
              {banners.map((b) => (
                <ConsoleRow
                  key={b.mode}
                  num={b.num}
                  name={b.name}
                  tagline={b.tagline}
                  enabled={b.enabled}
                  noAccessLabel={t("console.noaccess")}
                  onClick={() => setConsoleMode(b.mode)}
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
          fontSize: isMobile ? 9 : 10,
          color: C.dimmer,
          letterSpacing: "1.4px",
          textTransform: "uppercase",
        }}>
          {t("auth.footer")}
        </div>
      </div>
    </Page>
  );
}
