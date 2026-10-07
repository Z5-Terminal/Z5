import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth, roleLabelT } from "../auth";
import { useI18n } from "../i18n";
import { useTheme } from "../ThemeContext";
import { useConsole } from "../console";
import { supabase } from "../supabase";
import {
  Panel, PageHeader, Field, Btn, Input, ErrLine, OkLine, Badge, Avatar, Mono,
  Row, List, Segmented, Skeleton, Spinner, ViewTransition, ELLIPSIS, IconTile,
} from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, R, T } from "../theme";
import { uploadProfileAvatar, profileAvatarPublicUrl } from "../data/avatars";
import Gear from "./Gear";

// Panels that hold nothing but list rows sit tighter than content panels,
// so the rows don't float inside the card.
function listPanelPadding(isMobile) {
  return { padding: isMobile ? "6px 16px" : "8px 22px" };
}

// ── Profile hero ─────────────────────────────────────────────────────
// The page identity: avatar (tap to upload), callsign, name and role.
function ProfileHero({ profile, onAvatarChanged }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  // The public URL carries a cache-busting timestamp, so derive it once
  // per stored path / upload instead of on every render (which made the
  // photo reload on each keystroke elsewhere on the page).
  const [avatarVersion, setAvatarVersion] = useState(0);
  const avatarSrc = useMemo(
    () => profileAvatarPublicUrl(profile?.avatar_url),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile?.avatar_url, avatarVersion],
  );

  async function handleFile(file) {
    if (!file || !profile?.id) return;
    setUploading(true); setErr("");
    const { path, error } = await uploadProfileAvatar(profile.id, file);
    if (error) {
      setErr(error.message || String(error));
      setUploading(false);
      return;
    }
    // Direct UPDATE on profiles is revoked; the RPC validates that the
    // path lives under the caller's own folder.
    const { error: updErr } = await supabase.rpc("update_my_avatar", { p_path: path });
    setUploading(false);
    if (updErr) { setErr(updErr.message); return; }
    setAvatarVersion((v) => v + 1);
    onAvatarChanged && onAvatarChanged();
  }

  const pick = () => { if (!uploading) fileRef.current?.click(); };
  const avatarSize = isMobile ? 92 : 88;
  const uploadLabel = avatarSrc ? t("prof.replace_avatar") : t("prof.upload_avatar");
  const displayName = profile?.callsign || profile?.full_name || profile?.email || "";
  const secondary = [profile?.full_name || profile?.email, roleLabelT(profile?.role, t)]
    .filter(Boolean);
  const hasFlags = !!(profile?.is_instructor || profile?.is_recruiter);

  const uploadBtn = (
    <Btn small type="button" icon="camera" onClick={pick} disabled={uploading} busy={uploading}>
      {uploadLabel}
    </Btn>
  );

  return (
    <Panel>
      <div style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        alignItems: "center",
        gap: isMobile ? 12 : 20,
      }}>
        <button
          type="button"
          data-press="scale"
          onClick={pick}
          aria-busy={uploading || undefined}
          aria-label={uploadLabel}
          title={uploadLabel}
          style={{
            all: "unset",
            boxSizing: "border-box",
            flexShrink: 0,
            display: "flex",
            borderRadius: R.pill,
            cursor: uploading ? "default" : "pointer",
          }}
        >
          <Avatar src={avatarSrc} name={displayName} size={avatarSize}>
            {uploading && (
              <span style={{
                position: "absolute",
                inset: 0,
                background: `${C.imageShade}0.5)`,
                color: C.imageOverlayText,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                ...T.caption2,
              }}>
                <Spinner size={18} />
                <span>{t("prof.uploading")}</span>
              </span>
            )}
          </Avatar>
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
          width: isMobile ? "100%" : "auto",
          textAlign: isMobile ? "center" : "start",
        }}>
          <div style={{ color: C.bright, ...ELLIPSIS }}>
            <Mono style={{
              fontSize: isMobile ? T.title2.fontSize : T.title1.fontSize,
              lineHeight: T.title2.lineHeight,
              fontWeight: 700,
              direction: "ltr",
              unicodeBidi: "isolate",
            }}>{profile?.callsign || "—"}</Mono>
          </div>
          {secondary.length > 0 && (
            <div style={{ ...T.callout, color: C.dim, marginTop: 3, overflowWrap: "anywhere" }}>
              {secondary.map((part, i) => (
                <span key={i}>
                  {i > 0 && <span aria-hidden style={{ color: C.dimmer, margin: "0 6px" }}>·</span>}
                  <span style={{ unicodeBidi: "isolate" }}>{part}</span>
                </span>
              ))}
            </div>
          )}
          {hasFlags && (
            <div style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              justifyContent: isMobile ? "center" : "flex-start",
              marginTop: 10,
            }}>
              {profile?.is_instructor && <Badge tone="ok">{t("prof.instructor_badge")}</Badge>}
              {profile?.is_recruiter && <Badge tone="ok">{t("prof.recruiter_badge")}</Badge>}
            </div>
          )}
          {isMobile && <div style={{ marginTop: 14 }}>{uploadBtn}</div>}
        </div>

        {!isMobile && <div style={{ flexShrink: 0 }}>{uploadBtn}</div>}
      </div>
      <ErrLine>{err}</ErrLine>
    </Panel>
  );
}

// ── Gear summary ─────────────────────────────────────────────────────
// Navigation row for the personal gear inventory; opens the full Gear
// screen as a sub-view.
function GearSummaryCard({ profile, onOpen }) {
  const { t } = useI18n();
  const { mode } = useTheme();
  const isMobile = useIsMobile();
  const [count, setCount] = useState(null);

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

  const artwork = (
    <div aria-hidden style={{
      width: isMobile ? 76 : 88,
      height: 46,
      borderRadius: R.sm,
      background: C.fill,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <img
        src={`${import.meta.env.BASE_URL}${isLight ? "GunLogo-LightMode.png" : "GunLogo.png"}`}
        alt=""
        style={{
          height: 24,
          maxWidth: "86%",
          width: "auto",
          objectFit: "contain",
          opacity: 0.9,
          mixBlendMode: isLight ? "multiply" : "screen",
          // The artwork's backdrop is not quite pure white / black; push
          // it to the extreme so the blend mode drops it completely.
          filter: "contrast(1.4)",
        }}
      />
    </div>
  );

  return (
    <Panel style={listPanelPadding(isMobile)}>
      <Row
        onClick={onOpen}
        chevron
        leading={artwork}
        aria-label={`${t("prof.gear_open")}: ${t("gear.title")}`}
        style={{ minHeight: 64 }}
      >
        <div style={{ ...T.headline, color: C.bright, ...ELLIPSIS }}>{t("gear.title")}</div>
        <div style={{ ...T.footnote, color: C.dim, marginTop: 1, minHeight: 18, display: "flex", alignItems: "center" }}>
          {count == null
            ? <Skeleton width={104} height={10} />
            : <span style={ELLIPSIS}>{t("prof.gear_count", { n: count })}</span>}
        </div>
      </Row>
    </Panel>
  );
}

// One quick preference: label on the leading side, control on the
// trailing side (the control drops under the label if space runs out).
function SettingRow({ label, children }) {
  const isMobile = useIsMobile();
  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "8px 16px",
      padding: "8px 0",
      minHeight: isMobile ? 50 : 46,
      boxSizing: "border-box",
    }}>
      <div style={{ ...T.body, fontWeight: 600, color: C.bright }}>{label}</div>
      {children}
    </div>
  );
}

export default function Profile() {
  const { profile, refreshProfile, signOut } = useAuth();
  const { t, lang, setLang, isRTL } = useI18n();
  const { mode, toggle: toggleTheme } = useTheme();
  const { consoleMode, clearConsole } = useConsole();
  const isMobile = useIsMobile();
  // 'main' | 'gear' — `kind` is the direction of the last move (none on
  // first paint: the shell already animates the tab change).
  const [nav, setNav] = useState({ view: "main", kind: null });
  const [callsign, setCallsign] = useState(profile?.callsign || "");
  const [name, setName] = useState(profile?.full_name || "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  // Which form is saving: null | 'id' | 'pw'. Either one locks both.
  const [busy, setBusy] = useState(null);
  const [errId, setErrId] = useState("");
  const [okId, setOkId] = useState("");
  const [errPw, setErrPw] = useState("");
  const [okPw, setOkPw] = useState("");

  const view = nav.view;
  const openGear = () => setNav({ view: "gear", kind: "push" });
  const closeGear = () => setNav({ view: "main", kind: "pop" });

  // Back to the Hub, which should open at its top rather than at this
  // page's scroll offset.
  function switchConsole() {
    if (typeof window !== "undefined") window.scrollTo(0, 0);
    clearConsole();
  }

  // Each view starts at its top.
  const firstPaint = useRef(true);
  useLayoutEffect(() => {
    if (firstPaint.current) { firstPaint.current = false; return; }
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [view]);

  async function saveProfile(e) {
    e.preventDefault();
    setBusy("id"); setErrId(""); setOkId("");
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
    } finally { setBusy(null); }
  }

  async function changePassword(e) {
    e.preventDefault();
    setBusy("pw"); setErrPw(""); setOkPw("");
    try {
      if (pw.length < 6) throw new Error(t("prof.err_pw_short"));
      if (pw !== pw2) throw new Error(t("prof.err_pw_mismatch"));
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setPw(""); setPw2("");
      setOkPw(t("prof.pw_updated"));
    } catch (e) {
      setErrPw(String(e.message || e));
    } finally { setBusy(null); }
  }

  const fieldGrid = {
    display: "grid",
    gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)",
    columnGap: 16,
  };
  // Read-only facts look like values, not like fields waiting for input.
  const readOnlyStyle = { background: C.cardBg, borderColor: "transparent", color: C.dim };
  // Codes are typed left-to-right in either language; keep them on the
  // reading edge of the field.
  const codeInput = { dir: "ltr", style: { textAlign: isRTL ? "end" : "start" } };

  let body;
  if (view === "gear") {
    // ── Gear sub-view ────────────────────────────────────────────────
    body = (
      <>
        <PageHeader
          title={t("gear.title")}
          subtitle={t("gear.subtitle")}
          back={{ onClick: closeGear, label: t("prof.title") }}
        />
        <Gear embedded />
      </>
    );
  } else {
    body = (
      <>
        {/* No page title here — the hero card IS the page identity. */}
        <ProfileHero profile={profile} onAvatarChanged={refreshProfile} />

        {/* Gear — opens the full inventory */}
        <GearSummaryCard profile={profile} onOpen={openGear} />

        {/* Quick preferences: instant effect, no save button */}
        <Panel style={listPanelPadding(isMobile)}>
          <List>
            <SettingRow label={t("prof.theme")}>
              <Segmented
                ariaLabel={t("prof.theme")}
                value={mode}
                onChange={() => toggleTheme()}
                options={[
                  { value: "light", label: t("prof.theme_light"), icon: "sun" },
                  { value: "dark", label: t("prof.theme_dark"), icon: "moon" },
                ]}
              />
            </SettingRow>
            <SettingRow label={t("prof.language")}>
              <Segmented
                ariaLabel={t("prof.language")}
                value={lang}
                onChange={(l) => setLang(l)}
                options={[
                  { value: "he", label: "עברית" },
                  { value: "en", label: "English" },
                ]}
              />
            </SettingRow>
          </List>
        </Panel>

        {/* Identity */}
        <Panel title={t("prof.identity")}>
          <form onSubmit={saveProfile}>
            <div style={fieldGrid}>
              <Field label={t("prof.callsign")}>
                <Input
                  mono
                  {...codeInput}
                  aria-label={t("prof.callsign")}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  value={callsign}
                  onChange={(e) => setCallsign(e.target.value)}
                />
              </Field>
              <Field label={t("prof.fullname")}>
                <Input
                  aria-label={t("prof.fullname")}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label={t("prof.email")}>
                <Input
                  {...codeInput}
                  aria-label={t("prof.email")}
                  value={profile?.email || ""}
                  readOnly
                  style={{ ...codeInput.style, ...readOnlyStyle }}
                />
              </Field>
              <Field label={t("prof.role")}>
                <Input
                  aria-label={t("prof.role")}
                  value={roleLabelT(profile?.role, t)}
                  readOnly
                  style={readOnlyStyle}
                />
              </Field>
            </div>
            <Btn primary type="submit" fullWidth={isMobile} disabled={!!busy} busy={busy === "id"}>
              {busy === "id" ? t("prof.saving") : t("prof.save")}
            </Btn>
            <ErrLine>{errId}</ErrLine>
            <OkLine>{okId}</OkLine>
          </form>
        </Panel>

        {/* Password */}
        <Panel title={t("prof.password")}>
          <form onSubmit={changePassword}>
            <div style={fieldGrid}>
              <Field label={t("prof.newpw")}>
                <Input
                  type="password"
                  aria-label={t("prof.newpw")}
                  autoComplete="new-password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                />
              </Field>
              <Field label={t("prof.confirmpw")}>
                <Input
                  type="password"
                  aria-label={t("prof.confirmpw")}
                  autoComplete="new-password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                />
              </Field>
            </div>
            <div style={{ ...T.caption, color: C.dim, marginTop: -4, marginBottom: 14 }}>
              {t("prof.pw_note")}
            </div>
            <Btn primary type="submit" fullWidth={isMobile} disabled={!!busy} busy={busy === "pw"}>
              {t("prof.changepw")}
            </Btn>
            <ErrLine>{errPw}</ErrLine>
            <OkLine>{okPw}</OkLine>
          </form>
        </Panel>

        {/* Console — back to the Hub; nothing is lost, so no confirm */}
        <Panel style={listPanelPadding(isMobile)}>
          <Row
            onClick={switchConsole}
            chevron
            leading={<IconTile icon="swap" />}
            title={t("console.switch")}
            subtitle={`${t("console.current")}: ${t(`console.${consoleMode || "terminal"}`)}`}
          />
        </Panel>

        {/* Sign out — last thing on the page */}
        <Btn
          danger
          fullWidth
          type="button"
          icon="logout"
          iconFlip
          onClick={signOut}
          style={{ marginTop: isMobile ? 4 : 8 }}
        >
          {t("prof.logout")}
        </Btn>
      </>
    );
  }

  if (!nav.kind) return body;
  return (
    <ViewTransition viewKey={view} kind={nav.kind}>
      {body}
    </ViewTransition>
  );
}
