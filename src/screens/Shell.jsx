import { useState, useEffect, useMemo } from "react";
import { useAuth, roleLabelT, canManageSquads } from "../auth";
import { useI18n } from "../i18n";
import { useConsole } from "../console";
import { useTheme } from "../ThemeContext";
import { Page, AppShell, NavItem, NavLabel, TabItem, Badge } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, FONT_MONO } from "../theme";
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
// Subject-matched line icons (mobile bottom bar + anywhere tabs render).
// All inherit currentColor so active/dim tab tinting works untouched.
function tabSvg(children) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const ICONS = {
  // Home — house
  home: tabSvg(<>
    <path d="M3 9.5 12 3l9 6.5V20a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20z" />
    <path d="M9 21.5V13h6v8.5" />
  </>),
  // Calendar
  calendar: tabSvg(<>
    <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
    <path d="M16 2.5v4M8 2.5v4M3 10h18" />
  </>),
  // Missions — crosshair / scope reticle
  missions: tabSvg(<>
    <circle cx="12" cy="12" r="7.5" />
    <path d="M12 1.5V6M12 18v4.5M1.5 12H6M18 12h4.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </>),
  // Knowledge — book (unchanged shape)
  knowledge: tabSvg(<>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </>),
  // Course progress — rising chart
  progress: tabSvg(<>
    <path d="M3 20.5h18" />
    <path d="M4 16.5 9.5 11l4 4L20 8" />
    <path d="M15 8h5v5" />
  </>),
  // Roster — two people
  roster: tabSvg(<>
    <path d="M16.5 21v-2a4 4 0 0 0-4-4h-7a4 4 0 0 0-4 4v2" transform="translate(1.5 0)" />
    <circle cx="10.5" cy="7" r="4" />
    <path d="M22.5 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>),
  // Profile — single person
  profile: tabSvg(<>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </>),
  // Recruitment cycles — circular arrows
  cycles: tabSvg(<>
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
    <path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </>),
  // Candidates — person + check
  candidates: tabSvg(<>
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <path d="M17 11l2 2 4-4" />
  </>),
};

// Default view key per console — used when entering a console or when
// the previously-active view doesn't exist in the new console's tab set.
function defaultViewFor(mode) {
  if (mode === "recruitment") return "cycles";
  return "home";
}

export default function Shell() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const { consoleMode, mySquad } = useConsole();
  // Subscribe to theme so the sidebar / mobile top bar re-render after
  // a theme toggle. Without this, NavItem/NavLabel inline styles keep
  // their stale C.* values (because C is a mutable module export) and
  // the sidebar text becomes near-invisible on the new background.
  const { mode } = useTheme();
  // z5-logo.png is black line art — invert it on the dark (night) theme.
  const logoFilter = mode === "dark" ? "invert(0.9)" : "none";
  const [view, setView] = useState(() => defaultViewFor(consoleMode));
  const [missionView, setMissionView] = useState("list");
  const [activeMissionId, setActiveMissionId] = useState(null);
  const [prefillDate, setPrefillDate] = useState(null);
  const [createKind, setCreateKind] = useState("operational");
  const isMobile = useIsMobile();

  const isAdminOrOfficer = canManageSquads(profile?.role);
  const isBootcamp = mySquad?.is_bootcamp === true;

  // Console wordmark shown in the sidebar header / mobile top bar.
  const consoleLabel = useMemo(() => {
    if (consoleMode === "bootcamp")    return t("console.bootcamp");
    if (consoleMode === "recruitment") return t("console.recruitment");
    return t("nav.terminal"); // Z5 TERMINAL
  }, [consoleMode, t]);

  // ── Tab definitions per console ───────────────────────────────────
  const tabs = useMemo(() => {
    if (consoleMode === "recruitment") {
      const recTabs = [
        { key: "cycles",      label: t("nav.cycles"),      icon: ICONS.cycles },
        { key: "candidates",  label: t("nav.candidates"),  icon: ICONS.candidates },
      ];
      recTabs.push({ key: "profile", label: t("nav.profile"), icon: ICONS.profile });
      return recTabs;
    }
    // terminal + bootcamp share the operational tab set
    const opsTabs = [
      { key: "home",      label: t("nav.home"),      icon: ICONS.home },
      { key: "calendar",  label: t("nav.calendar"),  icon: ICONS.calendar },
      { key: "missions",  label: t("nav.missions"),  icon: ICONS.missions },
      { key: "knowledge", label: t("nav.knowledge"), icon: ICONS.knowledge },
    ];
    if (consoleMode === "bootcamp") {
      opsTabs.splice(3, 0, { key: "progress", label: t("nav.progress"), icon: ICONS.progress });
    }
    if (isAdminOrOfficer) {
      opsTabs.push({ key: "roster", label: t("nav.roster"), icon: ICONS.roster });
    }
    opsTabs.push({ key: "profile", label: t("nav.profile"), icon: ICONS.profile });
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

  // ── Desktop sidebar ───────────────────────────────────────────────
  const sidebar = (
    <>
      <div style={{
        padding: "0 14px 24px",
        borderBottom: `1px solid ${C.border}`,
        marginBottom: 12,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}>
        <img
          src={`${import.meta.env.BASE_URL}z5-logo.png`}
          alt="Z5"
          style={{ width: "100%", maxWidth: 150, maxHeight: 90, objectFit: "contain", display: "block", filter: logoFilter }}
        />
        <div style={{
          color: C.bright,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: "2px",
          textAlign: "center",
        }}>
          {consoleLabel}
        </div>
      </div>

      <NavLabel>{t("nav.navigation")}</NavLabel>
      {tabs.filter((tab) => tab.key !== "profile" && tab.key !== "roster").map((tab) => (
        <NavItem key={tab.key} active={view === tab.key} onClick={() => goTab(tab.key)}>
          {tab.label}
        </NavItem>
      ))}

      {isAdminOrOfficer && tabs.some((tab) => tab.key === "roster") && (
        <>
          <NavLabel>{t("nav.admin")}</NavLabel>
          <NavItem active={view === "roster"} onClick={() => goTab("roster")}>{t("nav.roster")}</NavItem>
        </>
      )}

      <NavLabel>{t("nav.account")}</NavLabel>
      <NavItem active={view === "profile"} onClick={() => goTab("profile")}>{t("nav.profile")}</NavItem>

      <div style={{ flex: 1 }} />

      <div style={{ borderTop: `1px solid ${C.border}`, padding: "16px 14px 4px", marginTop: 16 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: C.bright, fontWeight: 600, letterSpacing: "0.5px", marginBottom: 4 }}>
          {profile?.callsign || "—"}
        </div>
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 8 }}>
          {profile?.full_name || profile?.email}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge tone="bright">{roleLabelT(profile?.role, t)}</Badge>
          {isBootcamp && <Badge tone="warn">{t("nav.bootcamp")}</Badge>}
          {!profile?.squad_id && <Badge tone="warn">{t("nav.nosquad")}</Badge>}
        </div>
      </div>
    </>
  );

  // ── Mobile top bar ────────────────────────────────────────────────
  const mobileTopBar = (
    <div style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 52 }}>
      <img
        src={`${import.meta.env.BASE_URL}z5-logo.png`}
        alt="Z5"
        style={{ height: 52, width: "auto", maxWidth: 92, objectFit: "contain", flexShrink: 0, filter: logoFilter }}
      />
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
        <div style={{ color: C.bright, fontSize: 18, fontWeight: 800, letterSpacing: "2px", lineHeight: 1.1 }}>
          {consoleLabel}
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginTop: 3,
          fontSize: 12, color: C.dim, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
        }}>
          <span style={{ fontFamily: FONT_MONO, color: C.bright, fontWeight: 600, letterSpacing: "0.5px" }}>
            {profile?.callsign || "—"}
          </span>
          <span style={{ color: C.dimmer }}>·</span>
          <span>{roleLabelT(profile?.role, t)}</span>
          {isBootcamp && (
            <>
              <span style={{ color: C.dimmer }}>·</span>
              <span style={{ color: C.warn }}>{t("nav.bootcamp")}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ── Mobile bottom tab bar ─────────────────────────────────────────
  const mobileTabBar = (
    <>
      {tabs.map((tab) => (
        <TabItem key={tab.key} active={view === tab.key} onClick={() => goTab(tab.key)} icon={tab.icon} label={tab.label} />
      ))}
    </>
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
        mobileTabBar={isMobile ? mobileTabBar : null}
      >
        {renderView()}
      </AppShell>
    </Page>
  );
}
