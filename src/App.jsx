import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./auth";
import { I18nProvider, useI18n } from "./i18n";
import { ThemeProvider } from "./ThemeContext";
import { ConsoleProvider, useConsole } from "./console";
import { Page, CenteredColumn, Panel, Btn, ErrLine } from "./ui";
import Auth from "./screens/Auth";
import Shell from "./screens/Shell";
import Hub from "./screens/Hub";
import PublicSurvey from "./screens/PublicSurvey";
import PublicExam from "./screens/PublicExam";
import { C } from "./theme";

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
  const publicRoute = usePublicRoute();

  // Public routes bypass auth, console, and shell entirely.
  if (publicRoute?.kind === "survey") {
    return <PublicSurvey token={publicRoute.token} />;
  }
  if (publicRoute?.kind === "exam") {
    return <PublicExam token={publicRoute.token} personalId={publicRoute.personalId} />;
  }

  if (loading) {
    return (
      <Page>
        <div style={{ padding: 48, color: C.dim, fontSize: 14 }}>{t("common.loading")}</div>
      </Page>
    );
  }

  if (!session) return <Auth />;

  if (!profile) {
    return (
      <Page>
        <CenteredColumn maxWidth={480}>
          <Panel title={t("prof.title")}>
            {profileError ? (
              <>
                <div style={{ color: C.text, fontSize: 14, marginBottom: 12 }}>
                  {t("auth.profile_error")}
                </div>
                <ErrLine>{profileError}</ErrLine>
              </>
            ) : (
              <div style={{ color: C.dim, fontSize: 14, marginBottom: 12 }}>
                {t("common.loading")}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Btn onClick={refreshProfile}>{t("common.retry")}</Btn>
              <Btn onClick={signOut}>{t("nav.logout")}</Btn>
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
