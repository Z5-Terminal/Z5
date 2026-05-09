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
import { C } from "./theme";

// Hash routes that bypass auth entirely. Keep this list narrow — only
// truly public anonymous flows (recruitment survey, future recruitment
// exam) belong here. Everything else goes through the normal auth
// flow inside Inner().
function detectPublicRoute() {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash || "";
  // #/recruitment/<32-hex>/survey
  const m = hash.match(/^#\/recruitment\/([a-f0-9]{32})\/survey/i);
  if (m) return { kind: "survey", token: m[1] };
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
                  Could not load your profile.
                </div>
                <ErrLine>{profileError}</ErrLine>
              </>
            ) : (
              <div style={{ color: C.dim, fontSize: 14, marginBottom: 12 }}>
                {t("common.loading")}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Btn onClick={refreshProfile}>Retry</Btn>
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
