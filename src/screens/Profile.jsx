import { useRef, useState } from "react";
import { useAuth, roleLabelT, canManageSquads } from "../auth";
import { useI18n } from "../i18n";
import { useTheme } from "../ThemeContext";
import { useConsole } from "../console";
import { supabase } from "../supabase";
import { Panel, PageHeader, Field, Btn, Input, ErrLine, OkLine, Badge } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, S, FONT_MONO } from "../theme";
import { uploadProfileAvatar, profileAvatarPublicUrl } from "../data/avatars";
import Gear from "./Gear";

// ── Collapsible section used on Profile page ──────────────────────────
// Each section is its own bordered box. The title span uses explicit
// styles (no S.panelTitle spread) so no borderBottom leaks under the
// title text — that was creating a third hairline inside each row.
function Section({ title, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const isMobile = useIsMobile();
  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      marginBottom: isMobile ? 10 : 14,
      background: C.cardBg,
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
          color: C.bright,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "1.2px",
          textTransform: "uppercase",
          margin: 0,
          padding: 0,
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

// ── Profile card hero ─────────────────────────────────────────────
// Avatar (circular) + callsign + name + role badge. Tapping the avatar
// opens the file picker; upload writes to the profile-avatars bucket
// and stores the path in profiles.avatar_url.
function ProfileHero({ profile, onAvatarChanged }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const avatarSrc = profileAvatarPublicUrl(profile?.avatar_url);
  const initials = (profile?.callsign || profile?.full_name || profile?.email || "?")
    .trim()
    .slice(0, 2)
    .toUpperCase();

  async function handleFile(file) {
    if (!file || !profile?.id) return;
    setUploading(true); setErr("");
    const { path, error } = await uploadProfileAvatar(profile.id, file);
    if (error) {
      setErr(error.message || String(error));
      setUploading(false);
      return;
    }
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", profile.id);
    setUploading(false);
    if (updErr) { setErr(updErr.message); return; }
    onAvatarChanged && onAvatarChanged();
  }

  const avatarSize = isMobile ? 96 : 104;

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      background: C.cardBg,
      padding: isMobile ? "20px 16px" : "22px 24px",
      marginBottom: isMobile ? 14 : 18,
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      alignItems: "center",
      gap: isMobile ? 14 : 22,
    }}>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        title={t("prof.upload_avatar")}
        style={{
          all: "unset",
          width: avatarSize,
          height: avatarSize,
          borderRadius: "50%",
          background: C.inputBg,
          border: `1px solid ${C.borderBright}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          flexShrink: 0,
          cursor: uploading ? "wait" : "pointer",
          position: "relative",
        }}
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{
            fontSize: avatarSize * 0.36,
            color: C.dim,
            fontFamily: FONT_MONO,
            fontWeight: 700,
            letterSpacing: "1.5px",
          }}>{initials}</div>
        )}
        {uploading && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 11, letterSpacing: "1px", textTransform: "uppercase",
          }}>{t("prof.uploading")}</div>
        )}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) handleFile(f);
        }}
      />

      <div style={{
        flex: 1,
        minWidth: 0,
        textAlign: isMobile ? "center" : "start",
        width: "100%",
      }}>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: isMobile ? 22 : 26,
          color: C.bright,
          fontWeight: 700,
          letterSpacing: "2px",
          marginBottom: 4,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>{profile?.callsign || "—"}</div>
        <div style={{
          color: C.dim,
          fontSize: 14,
          marginBottom: 12,
        }}>{profile?.full_name || profile?.email || ""}</div>
        <div style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          justifyContent: isMobile ? "center" : "flex-start",
          marginBottom: 14,
        }}>
          <Badge tone="bright">{roleLabelT(profile?.role, t)}</Badge>
          {profile?.is_instructor && <Badge tone="ok">{t("prof.instructor_badge")}</Badge>}
          {profile?.is_recruiter && <Badge tone="ok">{t("prof.recruiter_badge")}</Badge>}
        </div>
        <Btn small onClick={() => fileRef.current?.click()} disabled={uploading}>
          {avatarSrc ? t("prof.replace_avatar") : t("prof.upload_avatar")}
        </Btn>
        <ErrLine>{err}</ErrLine>
      </div>
    </div>
  );
}

export default function Profile() {
  const { profile, refreshProfile, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { mode, toggle: toggleTheme } = useTheme();
  const { consoleMode, clearConsole } = useConsole();
  const isMobile = useIsMobile();
  const [callsign, setCallsign] = useState(profile?.callsign || "");
  const [name, setName] = useState(profile?.full_name || "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [confirmSwitch, setConfirmSwitch] = useState(false);

  function handleSwitchConsole() {
    if (!confirmSwitch) { setConfirmSwitch(true); return; }
    setConfirmSwitch(false);
    clearConsole();
  }

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
        standalone
        title={t("prof.title")}
        subtitle={t("prof.subtitle")}
      />

      <div style={{ marginTop: isMobile ? 18 : 24 }}>

      {/* Profile card hero — avatar + identity + role badges */}
      <ProfileHero profile={profile} onAvatarChanged={refreshProfile} />

      {/* Personal gear inventory */}
      <Section title={t("gear.title")} icon={<GearIcon mode={mode} />}>
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

      {/* Theme */}
      <Section title={t("prof.theme")} icon={<ThemeIcon />}>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn small active={mode === "dark"} onClick={() => mode !== "dark" && toggleTheme()}>
            {t("prof.theme_dark")}
          </Btn>
          <Btn small active={mode === "light"} onClick={() => mode !== "light" && toggleTheme()}>
            {t("prof.theme_light")}
          </Btn>
        </div>
      </Section>

      {/* Language */}
      <Section title={t("prof.language")} icon={<LangIcon />}>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn small active={lang === "he"} onClick={() => setLang("he")}>עברית</Btn>
          <Btn small active={lang === "en"} onClick={() => setLang("en")}>English</Btn>
        </div>
      </Section>

      {/* Switch console — moved here from the desktop sidebar and the
          mobile top bar; this is the single canonical place for both
          this action and the sign-out below it. */}
      <Section title={t("console.title")} icon={<ConsoleIcon />}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, color: C.dim }}>
            {t("console.current")}:{" "}
            <span style={{ color: C.bright, fontWeight: 600, letterSpacing: "0.5px" }}>
              {t(`console.${consoleMode || "terminal"}`)}
            </span>
          </div>
          {confirmSwitch ? (
            <div style={{ display: "flex", gap: 8 }}>
              <Btn small onClick={handleSwitchConsole}>{t("console.switch_confirm")}</Btn>
              <Btn small onClick={() => setConfirmSwitch(false)}>✕</Btn>
            </div>
          ) : (
            <Btn fullWidth={isMobile} onClick={handleSwitchConsole}>{t("console.switch")}</Btn>
          )}
        </div>
      </Section>

      </div>
      {/* /Section list */}

      {/* Sign out */}
      <div style={{ marginTop: 24 }}>
        <Btn fullWidth={isMobile} onClick={signOut}>{t("prof.logout")}</Btn>
      </div>
    </>
  );
}

// ---------- Inline SVG icons for section titles ----------------------

function GearIcon({ mode }) {
  // Both PNGs are RGB (no alpha channel) — GunLogo.png is white-on-
  // near-black, GunLogo-LightMode.png is black-on-near-white. We use
  // mix-blend-mode so the solid PNG background disappears into the
  // page surface and only the gun silhouette shows through.
  //   - dark mode: 'screen' drops the near-black bg (black + x = x)
  //   - light mode: 'multiply' drops the near-white bg (white * x = x)
  const isLight = mode === "light";
  const file = isLight ? "GunLogo-LightMode.png" : "GunLogo.png";
  return (
    <img
      src={`${import.meta.env.BASE_URL}${file}`}
      alt=""
      style={{
        height: 14,
        maxWidth: 50,
        width: "auto",
        verticalAlign: "middle",
        objectFit: "contain",
        opacity: 0.85,
        mixBlendMode: isLight ? "multiply" : "screen",
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

function ThemeIcon() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16" fill="none"
      style={{ verticalAlign: "middle", marginRight: 8, opacity: 0.8 }}
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 1.5 A6.5 6.5 0 0 1 8 14.5 Z" fill="currentColor" />
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

function ConsoleIcon() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16" fill="none"
      style={{ verticalAlign: "middle", marginRight: 8, opacity: 0.8 }}
    >
      <rect x="2" y="3" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <line x1="5" y1="14" x2="11" y2="14" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 6 L7 8 L5 10" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="8" y1="10" x2="11" y2="10" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
