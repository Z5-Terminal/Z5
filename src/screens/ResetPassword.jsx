import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { useI18n } from "../i18n";
import { Page, CenteredColumn, Field, Btn, Input, ErrLine, OkLine, Spinner } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, R, T } from "../theme";
import { useTheme } from "../ThemeContext";

// Step 2 of recovery: the user arrived from the password-reset email link.
//
// The Supabase client is configured with detectSessionInUrl:false (so it
// never tries to parse the app's own #/recruitment/... hash routes), which
// means the recovery tokens in the URL are NOT consumed automatically. We
// establish the session ourselves with setSession(), then let the user set
// a new password via updateUser(). App.jsx parses the recovery hash and
// renders this screen with the tokens.
export default function ResetPassword({ tokens, onDone, onCancel }) {
  const { t, isRTL } = useI18n();
  const { mode: themeMode } = useTheme();
  const isMobile = useIsMobile();

  // tokens.error = Supabase redirected back with an expired/used link.
  const [phase, setPhase] = useState(tokens.error ? "invalid" : "verifying"); // 'verifying' | 'ready' | 'invalid'
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const latin = { dir: "ltr", style: { textAlign: isRTL ? "end" : "start" } };

  // Consume the recovery tokens once, and scrub them from the URL so a
  // refresh or a shared link can't replay them.
  useEffect(() => {
    if (tokens.error) return; // nothing to consume — onCancel scrubs the URL
    let alive = true;
    (async () => {
      const { error } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      try {
        window.history.replaceState({}, "", window.location.pathname + window.location.search);
      } catch { /* history API unavailable — harmless */ }
      if (!alive) return;
      setPhase(error ? "invalid" : "ready");
    })();
    return () => { alive = false; };
  }, [tokens.access_token, tokens.refresh_token, tokens.error]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(""); setOk("");
    try {
      if (pw.length < 6) throw new Error(t("reset.err_short"));
      if (pw !== pw2) throw new Error(t("reset.err_mismatch"));
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      // Lock the form: a second submit during the hand-off delay would hit
      // Supabase's "new password must be different" error after success.
      setDone(true);
      setOk(t("reset.done"));
      // The session is already live for this account, so hand straight off
      // into the app rather than bouncing back to the login screen.
      setTimeout(() => { onDone?.(); }, 900);
    } catch (e) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  }

  return (
    <Page>
      <CenteredColumn maxWidth={440}>
        <div style={{
          border: `1px solid ${C.border}`,
          padding: isMobile ? "28px 20px 24px" : "36px 40px 32px",
          background: C.panel,
          borderRadius: R.xl,
          boxShadow: C.shadow,
        }}>
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            marginBottom: 24,
          }}>
            <img
              src={`${import.meta.env.BASE_URL}z5-logo.png`}
              alt="Z5"
              style={{
                width: "100%",
                maxWidth: isMobile ? 170 : 200,
                maxHeight: isMobile ? 95 : 110,
                objectFit: "contain",
                marginBottom: isMobile ? 14 : 18,
                filter: themeMode === "dark" ? "invert(0.9)" : "none",
              }}
            />
            <h1 style={{ margin: 0, ...T.title1, color: C.bright }}>
              {t("reset.title")}
            </h1>
            <div style={{ marginTop: 4, ...T.callout, color: C.dim }}>
              {t("reset.subtitle")}
            </div>
          </div>

          {phase === "verifying" && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              minHeight: 40,
              ...T.callout,
              color: C.dim,
            }}>
              <Spinner size={16} />
              <span>{t("reset.verifying")}</span>
            </div>
          )}

          {phase === "invalid" && (
            <>
              <ErrLine>{t("reset.invalid")}</ErrLine>
              <div style={{ marginTop: 18 }}>
                <Btn fullWidth type="button" onClick={onCancel}>{t("reset.back")}</Btn>
              </div>
            </>
          )}

          {phase === "ready" && (
            <form onSubmit={submit}>
              <Field label={t("reset.new")}>
                <Input type="password" autoComplete="new-password" {...latin}
                       value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} required autoFocus />
              </Field>
              <Field label={t("reset.confirm")}>
                <Input type="password" autoComplete="new-password" {...latin}
                       value={pw2} onChange={(e) => setPw2(e.target.value)} minLength={6} required />
              </Field>
              <div style={{ marginTop: 20 }}>
                <Btn primary fullWidth type="submit" disabled={busy || done} busy={busy}>
                  {busy ? t("reset.saving") : t("reset.save")}
                </Btn>
              </div>
              <ErrLine>{err}</ErrLine>
              <OkLine>{ok}</OkLine>
            </form>
          )}
        </div>
      </CenteredColumn>
    </Page>
  );
}
