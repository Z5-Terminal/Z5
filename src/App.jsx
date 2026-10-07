import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./auth";
import { I18nProvider, useI18n } from "./i18n";
import { ThemeProvider, useTheme } from "./ThemeContext";
import { ConsoleProvider, useConsole } from "./console";
import { Page, CenteredColumn, Panel, Btn, Notice, Spinner } from "./ui";
import Auth from "./screens/Auth";
import Shell from "./screens/Shell";
import Hub from "./screens/Hub";
import PublicSurvey from "./screens/PublicSurvey";
import PublicExam from "./screens/PublicExam";
import { C, T } from "./theme";

// Hash routes that bypass auth entirely. Keep this list narrow — only
// truly public anonymous flows (recruitment survey + exam) belong here.
// Everything else goes through the normal auth flow inside Inner().
function detectPublicRoute() {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash || "";
  // #/recruitment/<32-hex>/survey
  const survey = hash.match(/^#\/recruitment\/([a-f0-9]{32})\/survey/i);
  if (survey) return { kind: "survey", token: survey[1] };
  // #/recruitment/<32-hex>/exam/<personal-id>
  // Personal ID is whatever the candidate typed at intake — accept any
  // non-slash characters, URL-decoded by the browser already.
  const exam = hash.match(/^#\/recruitment\/([a-f0-9]{32})\/exam\/([^/?#]+)/i);
  if (exam) return { kind: "exam", token: exam[1], personalId: decodeURIComponent(exam[2]) };
  return null;
}

function usePublicRoute() {
  const [route, setRoute] = useState(detectPublicRoute);
  useEffect(() => {
    const onHash = () => setRoute(detectPublicRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

function Inner() {
  const { session, profile, profileError, loading, refreshProfile, signOut } = useAuth();
  const { consoleMode } = useConsole();
  const { t } = useI18n();
  const { mode: themeMode } = useTheme();
  const publicRoute = usePublicRoute();

  // Public routes bypass auth, console, and shell entirely.
  if (publicRoute?.kind === "survey") {
    return <PublicSurvey token={publicRoute.token} />;
  }
  if (publicRoute?.kind === "exam") {
    return <PublicExam token={publicRoute.token} personalId={publicRoute.personalId} />;
  }

  if (loading) {
    // Boot: the mark and a spinner, centered. No text to read.
    return (
      <Page>
        <div
          aria-busy="true"
          aria-label={t("common.loading")}
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 22,
            boxSizing: "border-box",
            padding: 24,
            color: C.dim,
            // A fast boot shows nothing at all; only a slow one fades this in.
            animation: "z5-fade-in 240ms ease-out 140ms backwards",
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}z5-logo.png`}
            alt="Z5"
            style={{
              width: 168,
              maxWidth: "60%",
              objectFit: "contain",
              display: "block",
              filter: themeMode === "dark" ? "invert(0.9)" : "none",
            }}
          />
          <Spinner size={20} />
        </div>
      </Page>
    );
  }

  if (!session) return <Auth />;

  if (!profile) {
    return (
      <Page>
        <CenteredColumn maxWidth={440}>
          <Panel title={t("prof.title")}>
            {profileError ? (
              <Notice tone="error" title={t("auth.profile_error")}>
                <bdi>{profileError}</bdi>
              </Notice>
            ) : (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minHeight: 40,
                ...T.callout,
                color: C.dim,
              }}>
                <Spinner size={16} />
                <span>{t("common.loading")}</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <Btn primary type="button" icon="refresh" onClick={refreshProfile} style={{ flex: 1 }}>
                {t("common.retry")}
              </Btn>
              <Btn type="button" onClick={signOut} style={{ flex: 1 }}>
                {t("nav.logout")}
              </Btn>
            </div>
          </Panel>
        </CenteredColumn>
      </Page>
    );
  }

  // Profile loaded. Show the Hub until the user picks a console.
  if (!consoleMode) return <Hub />;

  return <Shell />;
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <ConsoleProvider>
            <Inner />
          </ConsoleProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
