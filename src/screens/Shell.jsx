import { useState, useEffect, useMemo } from "react";
import { useAuth, roleLabelT, canManageSquads } from "../auth";
import { useI18n } from "../i18n";
import { useConsole } from "../console";
import { Page, AppShell, NavItem, NavLabel, TabItem, Badge, Btn } from "../ui";
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
import Candidates from "./recruitment/Candidates";
import Pipeline from "./recruitment/Pipeline";
import Evaluations from "./recruitment/Evaluations";
import Documents from "./recruitment/Documents";

// Knowledge tab icon (kept identical to its prior inline form).
const KnowledgeIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);

// Default view key per console — used when entering a console or when
// the previously-active view doesn't exist in the new console's tab set.
function defaultViewFor(mode) {
  if (mode === "recruitment") return "candidates";
  return "home";
}

export default function Shell() {
  const { profile, signOut } = useAuth();
  const { t } = useI18n();
  const { consoleMode, clearConsole, mySquad } = useConsole();
  const [view, setView] = useState(() => defaultViewFor(consoleMode));
  const [missionView, setMissionView] = useState("list");
  const [activeMissionId, setActiveMissionId] = useState(null);
  const [prefillDate, setPrefillDate] = useState(null);
  const [createKind, setCreateKind] = useState("operational");
  const [confirmSwitch, setConfirmSwitch] = useState(false);
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
        { key: "candidates",  label: t("nav.candidates"),  icon: "◍" },
        { key: "pipeline",    label: t("nav.pipeline"),    icon: "▤" },
        { key: "evaluations", label: t("nav.evaluations"), icon: "✓" },
        { key: "documents",   label: t("nav.documents"),   icon: "▦" },
      ];
      recTabs.push({ key: "profile", label: t("nav.profile"), icon: "◍" });
      return recTabs;
    }
    // terminal + bootcamp share the operational tab set
    const opsTabs = [
      { key: "home",      label: t("nav.home"),      icon: "◉" },
      { key: "calendar",  label: t("nav.calendar"),  icon: "▤" },
      { key: "missions",  label: t("nav.missions"),  icon: "⌖" },
      { key: "knowledge", label: t("nav.knowledge"), icon: KnowledgeIcon },
    ];
    if (consoleMode === "bootcamp") {
      opsTabs.splice(3, 0, { key: "progress", label: t("nav.progress"), icon: "⌑" });
    }
    if (isAdminOrOfficer) {
      opsTabs.push({ key: "roster", label: t("nav.roster"), icon: "⌯" });
    }
    opsTabs.push({ key: "profile", label: t("nav.profile"), icon: "◍" });
    return opsTabs;
  }, [consoleMode, isAdminOrOfficer, t]);

  // If console changes (or initial mount lands on an invalid view),
  // reset to that console's default view.
  useEffect(() => {
    const valid = tabs.some((tab) => tab.key === view);
    if (!valid) setView(defaultViewFor(consoleMode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consoleMode, tabs]);

  // Reset confirm-switch when navigating around so it doesn't linger.
  useEffect(() => { setConfirmSwitch(false); }, [view]);

  function goTab(key) {
    setView(key);
    if (key === "missions") {
      setMissionView("list");
      setActiveMissionId(null);
    }
  }

  function handleSwitchConsole() {
    if (!confirmSwitch) { setConfirmSwitch(true); return; }
    setConfirmSwitch(false);
    clearConsole();
  }

  // ── Switch-console control (used in both desktop sidebar + mobile bar) ──
  function SwitchConsoleControl({ inline = false }) {
    if (confirmSwitch) {
      return (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Btn small onClick={handleSwitchConsole}>{t("console.switch_confirm")}</Btn>
          <Btn small onClick={() => setConfirmSwitch(false)}>✕</Btn>
        </div>
      );
    }
    if (inline) {
      // Mobile: compact button styled like the EXIT button.
      return (
        <button
          onClick={handleSwitchConsole}
          aria-label={t("console.switch")}
          style={{
            background: "transparent",
            border: `1px solid ${C.border}`,
            color: C.dim,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.8px",
            textTransform: "uppercase",
            borderRadius: 2,
            padding: "8px 10px",
            minHeight: 36,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {t("console.switch_short")}
        </button>
      );
    }
    return (
      <NavItem onClick={handleSwitchConsole}>{t("console.switch")}</NavItem>
    );
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
          style={{ width: "100%", maxWidth: 150, maxHeight: 90, objectFit: "contain", display: "block" }}
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
      <SwitchConsoleControl />
      <NavItem onClick={signOut}>{t("nav.logout")}</NavItem>

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
        style={{ height: 52, width: "auto", maxWidth: 92, objectFit: "contain", flexShrink: 0 }}
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
      if (view === "candidates")  return <Candidates />;
      if (view === "pipeline")    return <Pipeline />;
      if (view === "evaluations") return <Evaluations />;
      if (view === "documents")   return <Documents />;
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
