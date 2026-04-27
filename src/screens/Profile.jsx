import { useState } from "react";
import { useAuth, roleLabelT, canManageSquads } from "../auth";
import { useI18n } from "../i18n";
import { supabase } from "../supabase";
import { Panel, PageHeader, Field, Btn, Input, ErrLine, OkLine, Badge } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, S, FONT_MONO } from "../theme";
import Gear from "./Gear";

// ── Collapsible section used on Profile page ──────────────────────────
function Section({ title, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const isMobile = useIsMobile();
  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      marginBottom: isMobile ? 10 : 14,
      background: "rgba(255,255,255,0.02)",
      overflow: "hidden",
    }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          all: "unset",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: isMobile ? "14px 14px" : "16px 20px",
          cursor: "pointer",
        }}
      >
        <span style={{
          color: C.dimmer,
          fontSize: 12,
          width: 12,
          flexShrink: 0,
          display: "inline-block",
          transform: open ? "rotate(90deg)" : "none",
          transition: "transform 120ms",
        }}>▶</span>
        {icon}
        <span style={{
          ...S.panelTitle,
          margin: 0,
          padding: 0,
          border: "none",
          flex: 1,
          minWidth: 0,
        }}>{title}</span>
      </button>
      {open && (
        <div style={{
          padding: isMobile ? "14px 14px 14px" : "18px 20px 20px",
          borderTop: `1px solid ${C.border}`,
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function Profile() {
  const { profile, refreshProfile, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  const isMobile = useIsMobile();
  const [callsign, setCallsign] = useState(profile?.callsign || "");
  const [name, setName] = useState(profile?.full_name || "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function saveProfile(e) {
    e.preventDefault();
    setBusy(true); setErr(""); setOk("");
    try {
      const { error } = await supabase.rpc("update_my_profile", {
        p_callsign: callsign.trim().toUpperCase(),
        p_full_name: name,
      });
      if (error) throw error;
      await refreshProfile();
      setOk(t("prof.updated"));
    } catch (e) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  }

  async function changePassword(e) {
    e.preventDefault();
    setBusy(true); setErr(""); setOk("");
    try {
      if (pw.length < 6) throw new Error(t("prof.err_pw_short"));
      if (pw !== pw2) throw new Error(t("prof.err_pw_mismatch"));
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setPw(""); setPw2("");
      setOk(t("prof.pw_updated"));
    } catch (e) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader
        title={t("prof.title")}
        subtitle={t("prof.subtitle")}
      />

      {/* Personal gear inventory */}
      <Section title={t("gear.title")} icon={<GearIcon />}>
        <Gear embedded />
      </Section>

      {/* Identity */}
      <Section title={t("prof.title")} icon={<SoldierIcon />}>
        <form onSubmit={saveProfile}>
          <Field label={t("prof.email")}>
            <Input value={profile?.email || ""} readOnly />
          </Field>
          <Field label={t("prof.role")}>
            <Input value={roleLabelT(profile?.role, t)} readOnly />
          </Field>
          <Field label={t("prof.callsign")}>
            <Input mono value={callsign} onChange={(e) => setCallsign(e.target.value)} />
          </Field>
          <Field label={t("prof.fullname")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Btn primary type="submit" disabled={busy}>
            {busy ? t("prof.saving") : t("prof.save")}
          </Btn>
          <ErrLine>{err}</ErrLine>
          <OkLine>{ok}</OkLine>
        </form>
      </Section>

      {/* Password */}
      <Section title={t("prof.password")} icon={<LockIcon />}>
        <form onSubmit={changePassword}>
          <Field label={t("prof.newpw")}>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Field label={t("prof.confirmpw")}>
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
          <Btn primary type="submit" disabled={busy}>{t("prof.changepw")}</Btn>
        </form>
        <div style={{ color: C.dim, fontSize: 12, marginTop: 14 }}>
          {t("prof.pw_note")}
        </div>
      </Section>

      {/* Language */}
      <Section title={t("prof.language")} icon={<LangIcon />}>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn small active={lang === "he"} onClick={() => setLang("he")}>עברית</Btn>
          <Btn small active={lang === "en"} onClick={() => setLang("en")}>English</Btn>
        </div>
      </Section>

      {/* Mobile sign out */}
      {isMobile && (
        <div style={{ marginTop: 24 }}>
          <Btn fullWidth onClick={signOut}>{t("prof.logout")}</Btn>
        </div>
      )}
    </>
  );
}

// ---------- Inline SVG icons for section titles ----------------------

function GearIcon() {
  return (
    <img
      src={`${import.meta.env.BASE_URL}GunLogo.png`}
      alt=""
      style={{
        height: 14,
        maxWidth: 50,
        width: "auto",
        verticalAlign: "middle",
        objectFit: "contain",
        opacity: 0.8,
      }}
    />
  );
}

function LangIcon() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16" fill="none"
      style={{ verticalAlign: "middle", opacity: 0.8 }}
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
      <ellipse cx="8" cy="8" rx="3" ry="6.5" stroke="currentColor" strokeWidth="1" />
      <line x1="1.5" y1="8" x2="14.5" y2="8" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function SoldierIcon() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16" fill="none"
      style={{ verticalAlign: "middle", marginRight: 8, opacity: 0.8 }}
    >
      <circle cx="8" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 3.5 Q8 1.5 11 3.5" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M4 15 L4 10 Q4 8 8 8 Q12 8 12 10 L12 15" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16" fill="none"
      style={{ verticalAlign: "middle", marginRight: 8, opacity: 0.8 }}
    >
      <rect x="3" y="7" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 7 V5 Q5.5 2 8 2 Q10.5 2 10.5 5 V7" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <circle cx="8" cy="11" r="1" fill="currentColor" />
    </svg>
  );
}
