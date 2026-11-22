import { useState } from "react";
import { supabase } from "../supabase";
import { useI18n } from "../i18n";
import { Page, CenteredColumn, Field, Btn, Input, Segmented, ErrLine, OkLine } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, R, T } from "../theme";
import { DURATION } from "../motion";
import { useTheme } from "../ThemeContext";

// Latin-only values (e-mail, password, callsign, invite code) are typed
// left-to-right even in the Hebrew UI, so punctuation doesn't jump to the
// wrong side while typing. The text still hugs the same edge as the
// field's label.
function useLatinField() {
  const { isRTL } = useI18n();
  return { dir: "ltr", style: { textAlign: isRTL ? "end" : "start" } };
}

// A quiet text link for secondary actions (e.g. "Forgot password?"). Styled
// to sit under a primary Btn without competing with it.
function LinkBtn({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        // 44px tall so it's a comfortable tap target on mobile.
        minHeight: 44,
        padding: "10px 12px",
        cursor: "pointer",
        font: "inherit",
        ...T.footnote,
        color: C.dim,
        textDecoration: "underline",
        textUnderlineOffset: 3,
      }}
    >
      {children}
    </button>
  );
}

export default function Auth() {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const { t } = useI18n();
  const { mode: themeMode } = useTheme();
  const isMobile = useIsMobile();
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
              {t("auth.title")}
            </h1>
            <div style={{ marginTop: 4, ...T.callout, color: C.dim }}>
              {t("auth.subtitle")}
            </div>
          </div>

          <div style={{ marginBottom: 22 }}>
            <Segmented
              fullWidth
              value={mode}
              onChange={setMode}
              options={[
                { value: "login", label: t("auth.signin") },
                { value: "signup", label: t("auth.newop") },
              ]}
            />
          </div>

          {/* The form body rises in whenever the mode switches. */}
          <div
            key={mode}
            style={{ animation: `z5-rise ${DURATION.move}ms var(--z5-spring) backwards` }}
          >
            {mode === "login" ? <LoginForm /> : <SignupForm />}
          </div>
        </div>
        <div style={{
          textAlign: "center",
          marginTop: 20,
          paddingInline: 12,
          ...T.caption,
          color: C.dimmer,
        }}>
          {t("auth.footer")}
        </div>
      </CenteredColumn>
    </Page>
  );
}

function LoginForm() {
  const { t } = useI18n();
  const latin = useLatinField();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [forgot, setForgot] = useState(false);

  // The "forgot password" request lives inside the login view (it's not a
  // peer of the login/signup segments), so we swap the body in place.
  if (forgot) {
    return <ForgotForm initialEmail={email} onBack={() => setForgot(false)} />;
  }

  async function go(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
      if (error) throw error;
    } catch (e) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={go}>
      <Field label={t("auth.email")}>
        <Input type="email" autoComplete="email" autoCapitalize="none" {...latin}
               value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label={t("auth.password")}>
        <Input type="password" autoComplete="current-password" {...latin}
               value={pw} onChange={(e) => setPw(e.target.value)} required />
      </Field>
      <div style={{ marginTop: 20 }}>
        <Btn primary fullWidth type="submit" disabled={busy} busy={busy}>
          {busy ? t("auth.authenticating") : t("auth.authenticate")}
        </Btn>
      </div>
      <ErrLine>{err}</ErrLine>
      <div style={{ marginTop: 14, textAlign: "center" }}>
        <LinkBtn onClick={() => setForgot(true)}>{t("auth.forgot")}</LinkBtn>
      </div>
    </form>
  );
}

// Step 1 of recovery: ask for the account email and send a reset link.
// resetPasswordForEmail resolves successfully even for unknown addresses
// (to avoid revealing who has an account), so the confirmation is worded
// neutrally. The link lands back on the app, where App.jsx detects the
// recovery hash and renders the ResetPassword screen.
function ForgotForm({ initialEmail, onBack }) {
  const { t } = useI18n();
  const latin = useLatinField();
  const [email, setEmail] = useState(initialEmail || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  async function go(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      // Works in local dev and on the GitHub Pages subpath alike. This exact
      // origin+path must be in Supabase → Authentication → URL Configuration
      // (Redirect URLs) or the link in the email will be rejected.
      const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      setSent(true);
    } catch (e) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  }

  if (sent) {
    return (
      <div>
        <OkLine>{t("auth.reset_sent")}</OkLine>
        <div style={{ ...T.caption, color: C.dim, marginTop: 10, textAlign: "center" }}>
          {t("auth.reset_hint")}
        </div>
        <div style={{ marginTop: 20 }}>
          <Btn fullWidth type="button" onClick={onBack}>{t("auth.reset_back")}</Btn>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={go}>
      <div style={{ ...T.callout, color: C.dim, marginBottom: 16, textAlign: "center" }}>
        {t("auth.reset_lead")}
      </div>
      <Field label={t("auth.email")}>
        <Input type="email" autoComplete="email" autoCapitalize="none" {...latin}
               value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </Field>
      <div style={{ marginTop: 20 }}>
        <Btn primary fullWidth type="submit" disabled={busy} busy={busy}>
          {busy ? t("auth.reset_sending") : t("auth.reset_send")}
        </Btn>
      </div>
      <ErrLine>{err}</ErrLine>
      <div style={{ marginTop: 14, textAlign: "center" }}>
        <LinkBtn onClick={onBack}>{t("auth.reset_back")}</LinkBtn>
      </div>
    </form>
  );
}

function SignupForm() {
  const { t } = useI18n();
  const latin = useLatinField();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [callsign, setCallsign] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function go(e) {
    e.preventDefault();
    setBusy(true); setErr(""); setOk("");
    try {
      const csUp = callsign.trim().toUpperCase();
      if (!csUp) throw new Error(t("auth.err_callsign"));
      if (!code.trim()) throw new Error(t("auth.err_invite"));

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pw,
      });
      // handle_new_user() refuses emails that aren't on the signup
      // allowlist; GoTrue reports that only as a generic database error.
      if (error && /database error saving new user/i.test(error.message || "")) {
        throw new Error(t("auth.err_not_allowlisted"));
      }
      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error(t("auth.err_signup"));

      const { error: e2 } = await supabase.rpc("update_my_profile", {
        p_callsign: csUp, p_full_name: name,
      });
      if (e2) throw e2;

      const { error: e3 } = await supabase.rpc("redeem_invite", {
        invite_code: code.trim().toUpperCase(),
      });
      if (e3) throw e3;

      setOk(t("auth.registered"));
    } catch (e) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={go}>
      <Field label={t("auth.email")}>
        <Input type="email" autoComplete="email" autoCapitalize="none" {...latin}
               value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label={t("auth.password_min")}>
        <Input type="password" autoComplete="new-password" {...latin}
               value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} required />
      </Field>
      <Field label={t("auth.callsign")}>
        {/* Callsigns and invite codes are codes: mono, shown in capitals. */}
        <Input mono autoCapitalize="characters" autoComplete="off" dir={latin.dir}
               value={callsign} onChange={(e) => setCallsign(e.target.value)}
               placeholder={t("auth.callsign_ph")} required
               style={{ ...latin.style, textTransform: "uppercase" }} />
      </Field>
      <Field label={t("auth.fullname")}>
        <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={t("auth.invitecode")}>
        <Input mono autoCapitalize="characters" autoComplete="off" dir={latin.dir}
               value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
               placeholder={t("auth.invitecode_ph")} required
               style={{ ...latin.style, textTransform: "uppercase" }} />
      </Field>
      <div style={{ marginTop: 20 }}>
        <Btn primary fullWidth type="submit" disabled={busy} busy={busy}>
          {busy ? t("auth.registering") : t("auth.register")}
        </Btn>
      </div>
      <ErrLine>{err}</ErrLine>
      <OkLine>{ok}</OkLine>
    </form>
  );
}
