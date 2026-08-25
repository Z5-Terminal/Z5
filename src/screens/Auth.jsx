import { useState } from "react";
import { supabase } from "../supabase";
import { useI18n } from "../i18n";
import { Page, CenteredColumn, Field, Btn, Input, ErrLine, OkLine } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C } from "../theme";
import { useTheme } from "../ThemeContext";

export default function Auth() {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const { t } = useI18n();
  const { mode: themeMode } = useTheme();
  const isMobile = useIsMobile();
  return (
    <Page>
      <CenteredColumn maxWidth={480}>
        <div style={{
          border: `1px solid ${C.border}`,
          padding: isMobile ? "28px 20px" : "40px 44px",
          background: C.cardBg,
          borderRadius: 14,
          boxShadow: C.shadow,
        }}>
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 24,
          }}>
            <img
              src={`${import.meta.env.BASE_URL}z5-logo.png`}
              alt="Z5"
              style={{
                width: "100%",
                maxWidth: isMobile ? 180 : 240,
                maxHeight: isMobile ? 100 : 140,
                objectFit: "contain",
                marginBottom: isMobile ? 12 : 16,
                filter: themeMode === "dark" ? "invert(0.9)" : "none",
              }}
            />
            <h1 style={{
              color: C.bright,
              margin: 0,
              fontSize: isMobile ? 24 : 28,
              fontWeight: 700,
              letterSpacing: "-0.3px",
              textAlign: "center",
            }}>
              {t("auth.title")}
            </h1>
            <div style={{
              color: C.dim,
              marginTop: 6,
              fontSize: 14,
              textAlign: "center",
            }}>
              {t("auth.subtitle")}
            </div>
          </div>

          <div style={{ marginBottom: 24, display: "flex", gap: 10 }}>
            <Btn active={mode === "login"}  onClick={() => setMode("login")}>{t("auth.signin")}</Btn>
            <Btn active={mode === "signup"} onClick={() => setMode("signup")}>{t("auth.newop")}</Btn>
          </div>

          {mode === "login" ? <LoginForm /> : <SignupForm />}
        </div>
        <div style={{
          textAlign: "center",
          marginTop: 24,
          color: C.dimmer,
          fontSize: 12,
          letterSpacing: "0.3px",
        }}>
          {t("auth.footer")}
        </div>
      </CenteredColumn>
    </Page>
  );
}

function LoginForm() {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

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
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label={t("auth.password")}>
        <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
      </Field>
      <Btn primary type="submit" disabled={busy}>
        {busy ? t("auth.authenticating") : t("auth.authenticate")}
      </Btn>
      <ErrLine>{err}</ErrLine>
    </form>
  );
}

function SignupForm() {
  const { t } = useI18n();
  const isMobile = useIsMobile();
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
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label={t("auth.password_min")}>
        <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} required />
      </Field>
      <Field label={t("auth.callsign")}>
        <Input mono value={callsign} onChange={(e) => setCallsign(e.target.value)}
               placeholder={t("auth.callsign_ph")} required />
      </Field>
      <Field label={t("auth.fullname")}>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={t("auth.invitecode")}>
        <Input mono value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
               placeholder={t("auth.invitecode_ph")} required />
      </Field>
      <Btn primary type="submit" disabled={busy}>
        {busy ? t("auth.registering") : t("auth.register")}
      </Btn>
      <ErrLine>{err}</ErrLine>
      <OkLine>{ok}</OkLine>
    </form>
  );
}
