import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useAuth, roleLabelT, canManageSquads } from "../auth";
import { useI18n } from "../i18n";
import { useConsole } from "../console";
import { useTheme } from "../ThemeContext";
import {
  Page, AppShell, MobileNavBar, NavItem, NavLabel, Badge, Avatar, Menu,
  IconButton, ViewTransition, ELLIPSIS,
} from "../ui";
import { Icon } from "../icons";
import { useIsMobile } from "../useIsMobile";
import { C, FONT_MONO, T } from "../theme";
import { profileAvatarPublicUrl } from "../data/avatars";
import Home from "./Home";
import Calendar from "./Calendar";
import Profile from "./Profile";
import Roster from "./Roster";
import Missions from "./Missions";
import MissionCreate from "./MissionCreate";
import Checklist from "./Checklist";
import Knowledge from "./Knowledge";
import CourseProgress from "./CourseProgress";
import Cycles from "./recruitment/Cycles";
import Candidates from "./recruitment/Candidates";

// ── Tab icons ────────────────────────────────────────────────────────
// Subject-matched line icons from the shared set (icons.jsx). They
// inherit currentColor, so active/dim tinting needs nothing extra.
const TAB_ICON = {
  home: "home",
  calendar: "calendar",
  missions: "target",
  knowledge: "book",
  progress: "chart",
  roster: "people",
  profile: "person",
  cycles: "cycles",
  candidates: "personCheck",
};

// Default view key per console — used when entering a console or when
// the previously-active view doesn't exist in the new console's tab set.
function defaultViewFor(mode) {
  if (mode === "recruitment") return "cycles";
  return "home";
}

export default function Shell() {
  const { profile, signOut } = useAuth();
  const { t } = useI18n();
  const { consoleMode, mySquad, clearConsole } = useConsole();
  // Subscribe to theme so the sidebar / mobile top bar re-render after
  // a theme toggle. Without this, inline styles keep their stale C.*
  // values (because C is a mutable module export).
  const { mode } = useTheme();
  // z5-logo.png is black line art — invert it on the dark (night) theme.
  const logoFilter = mode === "dark" ? "invert(0.9)" : "none";
  const [view, setView] = useState(() => defaultViewFor(consoleMode));
  const [missionView, setMissionView] = useState("list");
  const [activeMissionId, setActiveMissionId] = useState(null);
  const [prefillDate, setPrefillDate] = useState(null);
  const [createKind, setCreateKind] = useState("operational");
  const isMobile = useIsMobile();

  // Keyed on the profile object (not just the path): a re-upload keeps the
  // same storage path, and refreshProfile() hands us a new object, which
  // re-derives the cache-busted URL so the new photo shows here too.
  const avatarSrc = useMemo(() => profileAvatarPublicUrl(profile?.avatar_url), [profile]);

  const isAdminOrOfficer = canManageSquads(profile?.role);
  const isBootcamp = mySquad?.is_bootcamp === true;

  // Console wordmark shown in the sidebar header / mobile top bar.
  const consoleLabel = useMemo(() => {
    if (consoleMode === "bootcamp")    return t("console.bootcamp");
    if (consoleMode === "recruitment") return t("console.recruitment");
    return t("nav.terminal"); // Z5 Terminal
  }, [consoleMode, t]);

  // ── Tab definitions per console ───────────────────────────────────
  const tabs = useMemo(() => {
    const mk = (key, label) => ({
      key,
      label,
      iconName: TAB_ICON[key],
      icon: <Icon name={TAB_ICON[key]} size={23} strokeWidth={1.8} />,
    });
    if (consoleMode === "recruitment") {
      return [
        mk("cycles", t("nav.cycles")),
        mk("candidates", t("nav.candidates")),
        mk("profile", t("nav.profile")),
      ];
    }
    // terminal + bootcamp share the operational tab set
    const opsTabs = [
      mk("home", t("nav.home")),
      mk("calendar", t("nav.calendar")),
      mk("missions", t("nav.missions")),
      mk("knowledge", t("nav.knowledge")),
    ];
    if (consoleMode === "bootcamp") {
      opsTabs.splice(3, 0, mk("progress", t("nav.progress")));
    }
    if (isAdminOrOfficer) {
      opsTabs.push(mk("roster", t("nav.roster")));
    }
    opsTabs.push(mk("profile", t("nav.profile")));
    return opsTabs;
  }, [consoleMode, isAdminOrOfficer, t]);

  // If console changes (or initial mount lands on an invalid view),
  // reset to that console's default view.
  useEffect(() => {
    const valid = tabs.some((tab) => tab.key === view);
    if (!valid) setView(defaultViewFor(consoleMode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consoleMode, tabs]);

  function goTab(key) {
    setView(key);
    if (key === "missions") {
      setMissionView("list");
      setActiveMissionId(null);
    }
  }

  // ── View transitions ──────────────────────────────────────────────
  // Switching tabs cross-fades; going into a mission pushes in from the
  // trailing edge and coming back pops from the leading edge, so the
  // hierarchy reads spatially. Every view change starts at the top.
  const depth = view === "missions" && missionView !== "list" ? 1 : 0;
  const viewKey = `${consoleMode}:${view}:${depth ? `${missionView}:${activeMissionId || ""}` : "root"}`;
  const prev = useRef({ view, depth });
  let kind = "tab";
  if (prev.current.view === view) {
    if (depth > prev.current.depth) kind = "push";
    else if (depth < prev.current.depth) kind = "pop";
  }
  const kindRef = useRef(kind);
  if (prev.current.view !== view || prev.current.depth !== depth) kindRef.current = kind;
  useLayoutEffect(() => {
    prev.current = { view, depth };
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [viewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Account menu (profile / switch console / log out) — the way out is
  // always one tap away, wherever you are.
  const accountItems = [
    { key: "profile", label: t("nav.profile"), icon: "person", onSelect: () => goTab("profile") },
    { key: "switch", label: t("console.switch"), icon: "swap", onSelect: () => clearConsole() },
    "divider",
    { key: "logout", label: t("nav.logout"), icon: "logout", danger: true, onSelect: () => signOut() },
  ];

  const mainTabs = tabs.filter((tab) => tab.key !== "profile" && tab.key !== "roster");

  // ── Desktop sidebar ───────────────────────────────────────────────
  const sidebar = (
    <>
      <div style={{
        padding: "4px 12px 14px",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 10,
      }}>
        <img
          src={`${import.meta.env.BASE_URL}z5-logo.png`}
          alt="Z5"
          style={{ height: 56, width: "auto", maxWidth: 150, objectFit: "contain", display: "block", filter: logoFilter }}
        />
        <div style={{ ...T.title3, color: C.bright }}>
          {consoleLabel}
        </div>
      </div>

      <NavLabel>{t("nav.navigation")}</NavLabel>
      {mainTabs.map((tab) => (
        <NavItem
          key={tab.key}
          active={view === tab.key}
          onClick={() => goTab(tab.key)}
          icon={<Icon name={tab.iconName} size={18} />}
        >
          {tab.label}
        </NavItem>
      ))}

      {isAdminOrOfficer && tabs.some((tab) => tab.key === "roster") && (
        <>
          <NavLabel>{t("nav.admin")}</NavLabel>
          <NavItem active={view === "roster"} onClick={() => goTab("roster")} icon={<Icon name="people" size={18} />}>
            {t("nav.roster")}
          </NavItem>
        </>
      )}

      <NavLabel>{t("nav.account")}</NavLabel>
      <NavItem active={view === "profile"} onClick={() => goTab("profile")} icon={<Icon name="person" size={18} />}>
        {t("nav.profile")}
      </NavItem>

      <div style={{ flex: 1, minHeight: 16 }} />

      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        paddingBlock: "10px 2px",
        paddingInline: "12px 8px",
        borderTop: `1px solid ${C.separator}`,
        marginTop: 8,
      }}>
        <Avatar src={avatarSrc} name={profile?.callsign || profile?.full_name} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: C.bright, fontWeight: 600, letterSpacing: "0.02em", ...ELLIPSIS }}>
            {profile?.callsign || "—"}
          </div>
          <div style={{ ...T.caption, color: C.dim, ...ELLIPSIS }}>
            {roleLabelT(profile?.role, t)}
            {isBootcamp ? ` · ${t("nav.bootcamp")}` : ""}
            {!profile?.squad_id ? ` · ${t("nav.nosquad")}` : ""}
          </div>
        </div>
        <Menu
          align="start"
          items={accountItems}
          trigger={(p) => <IconButton icon="ellipsis" label={t("nav.account")} size={30} {...p} />}
        />
      </div>
    </>
  );

  // ── Mobile top bar ────────────────────────────────────────────────
  const mobileTopBar = (
    <MobileNavBar
      leading={
        <img
          src={`${import.meta.env.BASE_URL}z5-logo.png`}
          alt="Z5"
          style={{ height: 30, width: "auto", maxWidth: 58, objectFit: "contain", display: "block", filter: logoFilter }}
        />
      }
      brand={
        <div style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0, maxWidth: "100%" }}>
          <span style={{ ...T.headline, color: C.bright, ...ELLIPSIS }}>{consoleLabel}</span>
          {isBootcamp && <Badge tone="warn">{t("nav.bootcamp")}</Badge>}
        </div>
      }
      trailing={
        <Menu
          align="end"
          items={accountItems}
          trigger={(p) => (
            <button
              type="button"
              data-press="scale"
              aria-label={t("nav.account")}
              {...p}
              style={{ all: "unset", cursor: "pointer", display: "flex", borderRadius: 999 }}
            >
              <Avatar src={avatarSrc} name={profile?.callsign || profile?.full_name} size={32} />
            </button>
          )}
        />
      }
    />
  );

  // ── Missions sub-router (terminal + bootcamp) ─────────────────────
  function renderMissions() {
    if (missionView === "create") {
      return (
        <MissionCreate
          initialKind={createKind}
          prefillDate={prefillDate}
          onCreated={(id) => {
            setPrefillDate(null);
            if (id) { setActiveMissionId(id); setMissionView("detail"); }
            else { setMissionView("list"); }
          }}
          onCancel={() => { setPrefillDate(null); setMissionView("list"); }}
        />
      );
    }
    if (missionView === "detail" && activeMissionId) {
      return <Checklist missionId={activeMissionId} onBack={() => { setMissionView("list"); setActiveMissionId(null); }} />;
    }
    return (
      <Missions
        isBootcamp={isBootcamp}
        squadId={profile?.squad_id}
        onOpenMission={(id) => { setActiveMissionId(id); setMissionView("detail"); }}
        onCreateMission={(kind) => { setCreateKind(kind || "operational"); setMissionView("create"); }}
      />
    );
  }

  function openMission(id) {
    setActiveMissionId(id);
    setMissionView("detail");
    setView("missions");
  }

  // ── Render the active view ────────────────────────────────────────
  function renderView() {
    // Profile is shared across all consoles.
    if (view === "profile") return <Profile />;

    if (consoleMode === "recruitment") {
      if (view === "cycles")      return <Cycles />;
      if (view === "candidates")  return <Candidates />;
      return null;
    }

    // Terminal + BootCamp shared screens
    if (view === "home") {
      return (
        <Home
          isBootcamp={isBootcamp}
          squadId={profile?.squad_id}
          onOpenMission={openMission}
          onGoMissions={() => { setMissionView("list"); setView("missions"); }}
        />
      );
    }
    if (view === "calendar")  return <Calendar />;
    if (view === "missions")  return renderMissions();
    if (view === "knowledge") return <Knowledge isBootcamp={isBootcamp} canSquadEditKnowledge={mySquad?.can_edit_knowledge === true} />;
    if (view === "roster" && isAdminOrOfficer) return <Roster />;
    if (view === "progress" && consoleMode === "bootcamp") return <CourseProgress />;
    return null;
  }

  return (
    <Page>
      <AppShell
        sidebar={sidebar}
        mobileTopBar={isMobile ? mobileTopBar : null}
        tabs={tabs}
        activeTab={view}
        onSelectTab={goTab}
      >
        <ViewTransition viewKey={viewKey} kind={kindRef.current}>
          {renderView()}
        </ViewTransition>
      </AppShell>
    </Page>
  );
}
