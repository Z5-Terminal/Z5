import { useEffect, useRef, useState } from "react";
import { useAuth, roleLabelT } from "../auth";
import { useI18n } from "../i18n";
import { useTheme } from "../ThemeContext";
import { useConsole } from "../console";
import { supabase } from "../supabase";
import { Panel, PageHeader, Field, Btn, Input, ErrLine, OkLine, Badge } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, FONT, FONT_MONO } from "../theme";
import { uploadProfileAvatar, profileAvatarPublicUrl } from "../data/avatars";
import Gear from "./Gear";

// ── Segmented control ────────────────────────────────────────────────
// Small pill switch used for the theme / language quick-preferences on
// the hero card. Instant effect, no accordion, no save button.
function Segmented({ value, options, onChange, ariaLabel }) {
  return (
    <div role="group" aria-label={ariaLabel} style={{
      display: "inline-flex",
      background: C.progressTrack,
      borderRadius: 999,
      padding: 3,
      gap: 2,
    }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => !active && onChange(o.value)}
            style={{
              all: "unset",
              cursor: active ? "default" : "pointer",
              padding: "5px 14px",
              borderRadius: 999,
              fontSize: 12.5,
              fontWeight: 600,
              fontFamily: FONT,
              background: active ? C.bgElevated : "transparent",
              color: active ? C.bright : C.dim,
              boxShadow: active ? C.shadow : "none",
              transition: "all 140ms ease-out",
              whiteSpace: "nowrap",
            }}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

// ── Profile card hero ─────────────────────────────────────────────
// Avatar + callsign + name + role badges, with the theme / language
// quick-switches living directly on the card.
function ProfileHero({ profile, onAvatarChanged }) {
  const { t, lang, setLang } = useI18n();
  const { mode, toggle: toggleTheme } = useTheme();
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

  const prefs = (
    <div style={{
      display: "flex",
      flexDirection: isMobile ? "row" : "column",
      alignItems: isMobile ? "center" : "stretch",
      justifyContent: "center",
      gap: isMobile ? 10 : 12,
      flexWrap: "wrap",
    }}>
      <Segmented
        ariaLabel={t("prof.theme")}
        value={mode}
        onChange={() => toggleTheme()}
        options={[
          { value: "light", label: t("prof.theme_light") },
          { value: "dark",  label: t("prof.theme_dark") },
        ]}
      />
      <Segmented
        ariaLabel={t("prof.language")}
        value={lang}
        onChange={(l) => setLang(l)}
        options={[
          { value: "he", label: "עברית" },
          { value: "en", label: "English" },
        ]}
      />
    </div>
  );

  return (
    <Panel>
      <div style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        alignItems: "center",
        gap: isMobile ? 14 : 24,
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

        {/* Quick preferences — theme + language, instant effect */}
        <div style={{ flexShrink: 0 }}>
          {prefs}
        </div>
      </div>
    </Panel>
  );
}

// ── Gear summary card ────────────────────────────────────────────────
// Compact teaser for the personal gear inventory; opens the full Gear
// screen as a sub-view.
function GearSummaryCard({ profile, onOpen }) {
  const { t } = useI18n();
  const { mode } = useTheme();
  const [count, setCount] = useState(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!profile?.id) return;
    (async () => {
      const { count: n } = await supabase
        .from("gear")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id);
      if (!cancelled) setCount(n ?? 0);
    })();
    return () => { cancelled = true; };
  }, [profile?.id]);

  const isLight = mode === "light";

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        all: "unset",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 16,
        width: "100%",
        cursor: "pointer",
        border: `1px solid ${hover ? C.borderBright : C.border}`,
        borderRadius: 14,
        background: hover ? C.panelHover : C.panel,
        boxShadow: C.shadow,
        padding: "18px 22px",
        marginBottom: 24,
        transition: "background 140ms ease-out, border-color 140ms ease-out",
      }}
    >
      <img
        src={`${import.meta.env.BASE_URL}${isLight ? "GunLogo-LightMode.png" : "GunLogo.png"}`}
        alt=""
        style={{
          height: 26,
          maxWidth: 90,
          width: "auto",
          objectFit: "contain",
          opacity: 0.85,
          mixBlendMode: isLight ? "multiply" : "screen",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: C.bright, fontSize: 14, fontWeight: 700,
          letterSpacing: "1px", textTransform: "uppercase", marginBottom: 3,
        }}>{t("gear.title")}</div>
        <div style={{ color: C.dim, fontSize: 12.5 }}>
          {count == null ? "…" : t("prof.gear_count", { n: count })}
        </div>
      </div>
      <span style={{ color: C.dim, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
        {t("prof.gear_open")}
      </span>
    </button>
  );
}

export default function Profile() {
  const { profile, refreshProfile, signOut } = useAuth();
  const { t } = useI18n();
  const { consoleMode, clearConsole } = useConsole();
  const isMobile = useIsMobile();
  const [view, setView] = useState("main"); // 'main' | 'gear'
  const [callsign, setCallsign] = useState(profile?.callsign || "");
  const [name, setName] = useState(profile?.full_name || "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [errId, setErrId] = useState("");
  const [okId, setOkId] = useState("");
  const [errPw, setErrPw] = useState("");
  const [okPw, setOkPw] = useState("");
  const [confirmSwitch, setConfirmSwitch] = useState(false);

  function handleSwitchConsole() {
    if (!confirmSwitch) { setConfirmSwitch(true); return; }
    setConfirmSwitch(false);
    clearConsole();
  }

  async function saveProfile(e) {
    e.preventDefault();
    setBusy(true); setErrId(""); setOkId("");
    try {
      const { error } = await supabase.rpc("update_my_profile", {
        p_callsign: callsign.trim().toUpperCase(),
        p_full_name: name,
      });
      if (error) throw error;
      await refreshProfile();
      setOkId(t("prof.updated"));
    } catch (e) {
      setErrId(String(e.message || e));
    } finally { setBusy(false); }
  }

  async function changePassword(e) {
    e.preventDefault();
    setBusy(true); setErrPw(""); setOkPw("");
    try {
      if (pw.length < 6) throw new Error(t("prof.err_pw_short"));
      if (pw !== pw2) throw new Error(t("prof.err_pw_mismatch"));
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setPw(""); setPw2("");
      setOkPw(t("prof.pw_updated"));
    } catch (e) {
      setErrPw(String(e.message || e));
    } finally { setBusy(false); }
  }

  // ── Gear sub-view ──────────────────────────────────────────────────
  if (view === "gear") {
    return (
      <>
        <PageHeader
          title={t("gear.title")}
          subtitle={t("prof.subtitle")}
          action={<Btn small onClick={() => setView("main")}>← {t("rec.back")}</Btn>}
        />
        <div style={{ marginTop: isMobile ? 14 : 20 }}>
          <Gear embedded />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("prof.title")}
        subtitle={t("prof.subtitle")}
      />

      <div style={{ marginTop: isMobile ? 14 : 20 }}>

        {/* Hero: identity + quick prefs (theme / language) */}
        <ProfileHero profile={profile} onAvatarChanged={refreshProfile} />

        {/* Gear — summary card opening the full inventory */}
        <GearSummaryCard profile={profile} onOpen={() => setView("gear")} />

        {/* Identity — open panel, no accordion */}
        <Panel title={t("prof.identity")}>
          <form onSubmit={saveProfile}>
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              columnGap: 16,
            }}>
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
            </div>
            <Btn primary type="submit" disabled={busy}>
              {busy ? t("prof.saving") : t("prof.save")}
            </Btn>
            <ErrLine>{errId}</ErrLine>
            <OkLine>{okId}</OkLine>
          </form>
        </Panel>

        {/* Security */}
        <Panel title={t("prof.password")}>
          <form onSubmit={changePassword}>
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              columnGap: 16,
            }}>
              <Field label={t("prof.newpw")}>
                <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
              </Field>
              <Field label={t("prof.confirmpw")}>
                <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </Field>
            </div>
            <Btn primary type="submit" disabled={busy}>{t("prof.changepw")}</Btn>
            <ErrLine>{errPw}</ErrLine>
            <OkLine>{okPw}</OkLine>
          </form>
          <div style={{ color: C.dim, fontSize: 12, marginTop: 14 }}>
            {t("prof.pw_note")}
          </div>
        </Panel>

        {/* Session: console switch + sign out, together at the bottom */}
        <Panel title={t("prof.session_title")}>
          <div style={{
            display: "flex",
            alignItems: isMobile ? "stretch" : "center",
            flexDirection: isMobile ? "column" : "row",
            gap: 12,
          }}>
            <div style={{ fontSize: 13, color: C.dim, flex: 1 }}>
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
              <Btn small onClick={handleSwitchConsole}>{t("console.switch")}</Btn>
            )}
            <Btn small onClick={signOut} style={{
              color: C.error,
              borderColor: C.errBorderFaint,
            }}>{t("prof.logout")}</Btn>
          </div>
        </Panel>

      </div>
    </>
  );
}
