import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, roleLabel, canCreateInvites } from "../auth";
import { useI18n, fmtWhen } from "../i18n";
import {
  getMission, getMyChecklistState, toggleChecklistItem,
  getMissionReadiness, subscribeMissionRealtime, updateMissionStatus,
  setAdminTaskDone, deleteMission,
} from "../data/missions";
import {
  Panel, PageHeader, Btn, Badge, Mono, ErrLine, OkLine,
} from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, FONT_MONO, FONT } from "../theme";
import {
  SECTIONS, SECTION_LABELS, COMMON_SECTIONS, sectionsForRole,
  OPERATOR_ROLE_LABELS, MISSION_STATUS_LABELS, MISSION_STATUS_TONES,
} from "../missionTemplate";

// ── Section icons ──────────────────────────────────────────────────
const SECTION_ICONS = {
  sniper_rec10: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="4" y1="5" x2="4" y2="11" stroke="currentColor" strokeWidth="1"/>
      <circle cx="10" cy="8" r="3" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="10" y1="5.5" x2="10" y2="10.5" stroke="currentColor" strokeWidth="0.7"/>
      <line x1="7.5" y1="8" x2="12.5" y2="8" stroke="currentColor" strokeWidth="0.7"/>
    </svg>
  ),
  sniper_bolt: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.4"/>
      <line x1="3" y1="5" x2="3" y2="11" stroke="currentColor" strokeWidth="1"/>
      <rect x="6" y="6" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1"/>
      <line x1="12" y1="8" x2="14" y2="10" stroke="currentColor" strokeWidth="1"/>
    </svg>
  ),
  spotter_tl: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="8" y1="2" x2="8" y2="5" stroke="currentColor" strokeWidth="1"/>
      <line x1="8" y1="11" x2="8" y2="14" stroke="currentColor" strokeWidth="1"/>
      <line x1="2" y1="8" x2="5" y2="8" stroke="currentColor" strokeWidth="1"/>
      <line x1="11" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1"/>
      <circle cx="8" cy="8" r="1" fill="currentColor"/>
    </svg>
  ),
  all: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="2" width="10" height="12" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="5" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="0.8"/>
      <line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="0.8"/>
      <line x1="5" y1="11" x2="9" y2="11" stroke="currentColor" strokeWidth="0.8"/>
    </svg>
  ),
  final_check: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M5.5 8 L7.5 10 L11 5.5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  final_ready: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 8 L6.5 11.5 L13 4.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

// ── Chevron for collapsible sections ───────────────────────────────
function Chevron({ open }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 12 12" fill="none"
      style={{
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 200ms",
        flexShrink: 0,
      }}
    >
      <path d="M4 2 L8 6 L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function Checklist({ missionId, onBack }) {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const { t } = useI18n();
  const canSeeRollup = canCreateInvites(profile?.role);

  const [mission, setMission] = useState(null);
  const [items, setItems] = useState([]);
  const [operators, setOperators] = useState([]);
  const [myState, setMyState] = useState([]);
  const [readiness, setReadiness] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busyStatus, setBusyStatus] = useState(false);

  const myOp = useMemo(
    () => operators.find((o) => o.user_id === profile?.id) || null,
    [operators, profile?.id],
  );
  const myRole = myOp?.role || null;

  const load = useCallback(async () => {
    if (!missionId || !profile?.id) return;
    setErr("");
    const resp = await getMission(missionId);
    if (resp.error) { setErr(String(resp.error.message || resp.error)); setLoading(false); return; }
    setMission(resp.mission);
    setItems(resp.items || []);
    setOperators(resp.operators || []);
    const { data: st } = await getMyChecklistState(missionId, profile.id);
    setMyState(st || []);
    if (canCreateInvites(profile?.role)) {
      const { data: rd } = await getMissionReadiness(missionId);
      setReadiness(rd || []);
    }
    setLoading(false);
  }, [missionId, profile?.id, profile?.role]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!missionId) return;
    const unsub = subscribeMissionRealtime(missionId, () => load());
    return () => { unsub && unsub(); };
  }, [missionId, load]);

  const myApplicableSections = useMemo(
    () => sectionsForRole(myRole),
    [myRole],
  );
  const myItems = useMemo(
    () => items.filter((it) => myApplicableSections.has(it.section)),
    [items, myApplicableSections],
  );

  const stateMap = useMemo(() => {
    const m = new Map();
    for (const s of myState) m.set(s.item_id, !!s.checked);
    return m;
  }, [myState]);

  // For leaders: always show aggregate team progress in the progress bar,
  // whether assigned or not. This keeps the view consistent across accounts.
  const aggregateProgress = useMemo(() => {
    if (!canSeeRollup || readiness.length === 0) return null;
    const totalChecked = readiness.reduce((s, r) => s + (r.checked_items || 0), 0);
    const totalItems   = readiness.reduce((s, r) => s + (r.total_items || 0), 0);
    return { checked: totalChecked, total: totalItems };
  }, [canSeeRollup, readiness]);

  // Personal progress (for the operator's own items)
  const myCheckedCount = useMemo(
    () => myItems.reduce((n, it) => n + (stateMap.get(it.id) ? 1 : 0), 0),
    [myItems, stateMap],
  );

  // Progress bar shows aggregate for leaders, personal for regular operators
  const checkedCount = aggregateProgress ? aggregateProgress.checked : myCheckedCount;
  const total = aggregateProgress ? aggregateProgress.total : myItems.length;
  const pct = total ? Math.round((checkedCount / total) * 100) : 0;

  const finalReadyItems = myItems.filter((it) => it.section === "final_ready");
  const allFinalReadyChecked =
    finalReadyItems.length > 0 &&
    finalReadyItems.every((it) => stateMap.get(it.id));

  async function onToggle(itemId, next) {
    setMyState((prev) => {
      const other = prev.filter((s) => s.item_id !== itemId);
      return [...other, { item_id: itemId, checked: next, checked_at: new Date().toISOString() }];
    });
    const { error } = await toggleChecklistItem({ missionId, itemId, checked: next });
    if (error) {
      setErr(String(error.message || error));
      setMyState((prev) => {
        const other = prev.filter((s) => s.item_id !== itemId);
        return [...other, { item_id: itemId, checked: !next, checked_at: null }];
      });
    }
  }

  async function setStatus(next) {
    setBusyStatus(true);
    setErr(""); setOk("");
    const { error } = await updateMissionStatus(missionId, next);
    setBusyStatus(false);
    if (error) { setErr(String(error.message || error)); return; }
    setOk(t("cl.status_set", { status: next }));
    load();
  }

  function canDeleteMission(m) {
    if (!m || !profile) return false;
    if (m.created_by === profile.id) return true;
    return ["admin", "officer", "squad_leader"].includes(profile.role);
  }

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusyDelete(true);
    setErr("");
    const { error } = await deleteMission(missionId);
    setBusyDelete(false);
    if (error) { setErr(String(error.message || error)); setConfirmDelete(false); return; }
    onBack();
  }

  if (loading) {
    return (
      <>
        <PageHeader title={t("cl.title")} />
        <Panel><div style={{ color: C.dim, fontSize: 13 }}>{t("cl.loading")}</div></Panel>
        <Btn onClick={onBack} fullWidth={isMobile}>{t("cl.back")}</Btn>
      </>
    );
  }

  if (!mission) {
    return (
      <>
        <PageHeader title={t("cl.title")} />
        <Panel><ErrLine>{err || t("cl.notfound")}</ErrLine></Panel>
        <Btn onClick={onBack} fullWidth={isMobile}>{t("cl.back")}</Btn>
      </>
    );
  }

  if (mission.kind === "admin") {
    return (
      <AdminTaskView
        mission={mission} operators={operators} profile={profile}
        isMobile={isMobile} canSeeRollup={canSeeRollup} onBack={onBack}
        reload={load} canDelete={canDeleteMission(mission)}
        onDelete={handleDelete} confirmDelete={confirmDelete}
        setConfirmDelete={setConfirmDelete} busyDelete={busyDelete} deleteErr={err}
      />
    );
  }

  const statusLabel = MISSION_STATUS_LABELS[mission.status] || mission.status;
  const statusTone = MISSION_STATUS_TONES[mission.status] || "default";
  const opCount = operators.length;

  // Build section list for assigned / admin view
  const assignedSections = myOp
    ? SECTIONS.filter((sec) => myApplicableSections.has(sec.key))
    : (canSeeRollup ? SECTIONS : []);

  return (
    <>
      <PageHeader
        title={mission.name}
        subtitle={formatWhen(mission.scheduled_at, t) + (mission.location ? ` · ${mission.location}` : "")}
      />

      {/* ═══ Single unified mission panel ═══════════════════════════ */}
      <div style={{
        border: `1px solid ${C.border}`,
        background: C.panel,
        borderRadius: 4,
        marginBottom: 24,
        overflow: "hidden",
      }}>

        {/* ── Header: badges + info ──────────────────────────────── */}
        <div style={{ padding: isMobile ? "18px 16px" : "22px 24px" }}>
          {/* Badges */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            marginBottom: 16,
          }}>
            <Badge tone={statusTone}>{statusLabel}</Badge>
            {myRole
              ? <Badge tone="ok">{t("cl.yourrole")} {OPERATOR_ROLE_LABELS[myRole] || myRole}</Badge>
              : !canSeeRollup && <Badge tone="warn">{t("cl.notassigned")}</Badge>}
            {opCount > 0 && (
              <span style={{ color: C.dim, fontSize: 12, fontFamily: FONT_MONO }}>
                {opCount} {opCount === 1 ? t("mc.member") : t("mc.members")}
              </span>
            )}
          </div>

          {/* Mission info rows */}
          {(mission.location || mission.notes) && (
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "auto 1fr",
              gap: isMobile ? "4px 0" : "6px 16px",
              padding: "10px 14px",
              background: C.cardBg,
              border: `1px solid ${C.border}`,
              borderRadius: 3,
              marginBottom: 16,
            }}>
              {mission.location && (<>
                <span style={infoLabelStyle}>{t("mc.location").replace(" (optional)", "")}</span>
                <span style={infoValueStyle}>{mission.location}</span>
              </>)}
              {mission.notes && (<>
                <span style={infoLabelStyle}>{t("mc.notes")}</span>
                <span style={{ ...infoValueStyle, whiteSpace: "pre-wrap" }}>{mission.notes}</span>
              </>)}
            </div>
          )}

          {/* Progress bar */}
          <ProgressBar checked={checkedCount} total={total} />

          {/* Ready banner */}
          {allFinalReadyChecked && (
            <div style={{
              marginTop: 16,
              padding: "12px 16px",
              border: `1px solid ${C.ok}`,
              background: C.okBg,
              color: C.ok,
              borderRadius: 3,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              textAlign: "center",
              fontFamily: FONT_MONO,
            }}>
              ✔ {t("cl.ready")}
            </div>
          )}

          {/* Status buttons — only show valid next transitions */}
          {canSeeRollup && (
            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {mission.status === "scheduled" && (
                <Btn small disabled={busyStatus} onClick={() => setStatus("active")}>
                  {t("cl.mark_active")}
                </Btn>
              )}
              {(mission.status === "active" || mission.status === "scheduled") && (
                <Btn small disabled={busyStatus} onClick={() => setStatus("complete")}>
                  {t("cl.mark_complete")}
                </Btn>
              )}
              {mission.status !== "complete" && mission.status !== "cancelled" && (
                <Btn small disabled={busyStatus} onClick={() => setStatus("cancelled")}>
                  {t("cl.cancel")}
                </Btn>
              )}
            </div>
          )}

          {canDeleteMission(mission) && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
              <Btn
                small
                disabled={busyDelete}
                onClick={handleDelete}
                style={{
                  color: C.error,
                  borderColor: confirmDelete ? C.error : C.errBorderFaint,
                }}
              >
                {busyDelete ? t("cl.deleting") : confirmDelete ? t("cl.confirm_delete") : t("cl.delete")}
              </Btn>
              {confirmDelete && !busyDelete && (
                <Btn small onClick={() => setConfirmDelete(false)}>{t("cl.cancel")}</Btn>
              )}
            </div>
          )}

          <ErrLine>{err}</ErrLine>
          <OkLine>{ok}</OkLine>
        </div>

        {/* ── Not assigned message ───────────────────────────────── */}
        {!myOp && !canSeeRollup && (
          <div style={{
            padding: "14px 24px",
            borderTop: `1px solid ${C.border}`,
            color: C.dim,
            fontSize: 13,
          }}>
            {t("cl.not_assigned_msg")}
          </div>
        )}

        {/* ── Checklist sections (collapsible) ───────────────────── */}
        {assignedSections.map((sec) => {
          const isReadOnly = !myOp && canSeeRollup;
          const sectionItems = isReadOnly
            ? items.filter((it) => it.section === sec.key)
            : myItems.filter((it) => it.section === sec.key);
          if (sectionItems.length === 0) return null;
          const done = isReadOnly ? 0 : sectionItems.filter((it) => stateMap.get(it.id)).length;
          const allDone = !isReadOnly && done === sectionItems.length;
          return (
            <CollapsibleSection
              key={sec.key}
              sectionKey={sec.key}
              done={done}
              total={sectionItems.length}
              allDone={allDone}
              readOnly={isReadOnly}
              defaultOpen
              isMobile={isMobile}
            >
              {sectionItems.map((it, idx) => isReadOnly ? (
                <ReadOnlyRow key={it.id} index={idx + 1} label={it.label} isMobile={isMobile} />
              ) : (
                <ChecklistRow
                  key={it.id}
                  index={idx + 1}
                  label={it.label}
                  checked={!!stateMap.get(it.id)}
                  onToggle={(next) => onToggle(it.id, next)}
                  isMobile={isMobile}
                />
              ))}
            </CollapsibleSection>
          );
        })}

        {/* ── Team readiness rollup ──────────────────────────────── */}
        {canSeeRollup && readiness.length > 0 && (
          <CollapsibleSection
            sectionKey="__readiness__"
            customTitle={t("cl.team_ready")}
            done={readiness.filter((r) => r.ready_to_move).length}
            total={readiness.length}
            allDone={readiness.every((r) => r.ready_to_move)}
            defaultOpen
            isMobile={isMobile}
          >
            {readiness.map((r) => (
              <ReadinessRow key={r.user_id} row={r} isMobile={isMobile} />
            ))}
          </CollapsibleSection>
        )}
      </div>

      <Btn onClick={onBack} fullWidth={isMobile}>{t("cl.back")}</Btn>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// INFO LABEL/VALUE STYLES
// ═══════════════════════════════════════════════════════════════════

const infoLabelStyle = {
  color: C.dim,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.8px",
  textTransform: "uppercase",
  paddingTop: 2,
};
const infoValueStyle = {
  color: C.text,
  fontSize: 14,
  lineHeight: 1.5,
};

// ═══════════════════════════════════════════════════════════════════
// COLLAPSIBLE SECTION
// ═══════════════════════════════════════════════════════════════════

function CollapsibleSection({
  sectionKey, customTitle, done, total, allDone,
  readOnly, defaultOpen = true, isMobile, children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const icon = SECTION_ICONS[sectionKey] || null;
  const label = customTitle || SECTION_LABELS[sectionKey] || sectionKey;

  return (
    <div style={{ borderTop: `1px solid ${C.border}` }}>
      {/* Clickable header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          all: "unset",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          boxSizing: "border-box",
          padding: isMobile ? "14px 16px" : "14px 24px",
          cursor: "pointer",
          transition: "background 100ms",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <Chevron open={open} />
          {icon && <span style={{
            color: allDone ? C.ok : C.dim,
            display: "inline-flex",
            transition: "color 300ms",
          }}>{icon}</span>}
          <span style={{
            color: allDone ? C.ok : C.bright,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            transition: "color 300ms",
          }}>{label}</span>
        </div>
        <Badge tone={allDone ? "ok" : readOnly ? "default" : (done > 0 ? "warn" : "default")}>
          {readOnly ? `${total}` : `${done}/${total}`}
        </Badge>
      </button>

      {/* Collapsible body */}
      {open && (
        <div style={{ padding: isMobile ? "0 16px 8px" : "0 24px 8px" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PROGRESS BAR
// ═══════════════════════════════════════════════════════════════════

function ProgressBar({ checked, total }) {
  const { t } = useI18n();
  const pct = total ? Math.round((checked / total) * 100) : 0;
  const barColor = pct === 100 ? C.ok : pct >= 50 ? C.warn : C.bright;

  return (
    <div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 8,
      }}>
        <div>
          <span style={{
            fontFamily: FONT_MONO,
            fontSize: 26,
            fontWeight: 700,
            color: pct === 100 ? C.ok : C.bright,
            transition: "color 300ms",
          }}>{checked}</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 15, color: C.dim }}>/{total}</span>
          <span style={{
            fontSize: 11, color: C.dim, marginInlineStart: 8,
            letterSpacing: "0.8px", textTransform: "uppercase",
          }}>{t("cl.complete")}</span>
        </div>
        <span style={{
          fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700,
          color: pct === 100 ? C.ok : C.dim, transition: "color 300ms",
        }}>{pct}%</span>
      </div>
      <div style={{
        width: "100%", height: 10,
        background: C.progressTrack,
        border: `1px solid ${C.border}`,
        borderRadius: 3, overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: barColor, borderRadius: 2,
          transition: "width 400ms ease, background 300ms",
          boxShadow: pct > 0 ? `0 0 6px ${barColor}40` : "none",
        }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CHECKLIST ROW — interactive
// ═══════════════════════════════════════════════════════════════════

function ChecklistRow({ index, label, checked, onToggle, isMobile }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!checked)}
      style={{
        all: "unset",
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        boxSizing: "border-box",
        padding: isMobile ? "12px 2px" : "10px 2px",
        minHeight: isMobile ? 48 : 42,
        borderBottom: `1px solid ${C.border}`,
        cursor: "pointer",
        transition: "background 100ms",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{
        fontFamily: FONT_MONO, fontSize: 11,
        color: checked ? C.ok : C.dimmer,
        width: 20, textAlign: "center", flexShrink: 0,
      }}>{index}</span>
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 20, height: 20, flexShrink: 0,
        border: `1.5px solid ${checked ? C.ok : C.borderBright}`,
        background: checked ? C.selectedBg : "transparent",
        color: checked ? C.ok : "transparent",
        fontSize: 13, fontWeight: 700, borderRadius: 3,
        transition: "all 200ms",
      }}>✓</span>
      <span style={{
        flex: 1,
        color: checked ? C.dim : C.text,
        textDecoration: checked ? "line-through" : "none",
        fontSize: isMobile ? 15 : 14,
        transition: "color 200ms",
      }}>{label}</span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// READ-ONLY ROW — admin view when not assigned
// ═══════════════════════════════════════════════════════════════════

function ReadOnlyRow({ index, label, isMobile }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: isMobile ? "12px 2px" : "10px 2px",
      borderBottom: `1px solid ${C.border}`,
    }}>
      <span style={{
        fontFamily: FONT_MONO, fontSize: 11, color: C.dimmer,
        width: 20, textAlign: "center", flexShrink: 0,
      }}>{index}</span>
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 20, height: 20, flexShrink: 0,
        border: `1px solid ${C.border}`, borderRadius: 3, opacity: 0.3,
      }} />
      <span style={{ flex: 1, color: C.dim, fontSize: isMobile ? 15 : 14 }}>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// READINESS ROW
// ═══════════════════════════════════════════════════════════════════

function ReadinessRow({ row, isMobile }) {
  const { t } = useI18n();
  const pct = Number(row.pct || 0);
  const ready = !!row.ready_to_move;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 2px", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap",
    }}>
      <div style={{ flex: 1, minWidth: 120 }}>
        <div style={{
          fontFamily: FONT_MONO, color: C.bright,
          fontWeight: 600, fontSize: 13, letterSpacing: "0.3px",
        }}>{row.callsign || "—"}</div>
        <div style={{ color: C.dim, fontSize: 11 }}>
          {row.full_name || "—"}
          {row.op_role && <> · {OPERATOR_ROLE_LABELS[row.op_role] || row.op_role}</>}
        </div>
      </div>
      <div style={{ width: isMobile ? 60 : 100, flexShrink: 0 }}>
        <div style={{
          height: 4, background: C.progressTrack,
          borderRadius: 2, overflow: "hidden",
        }}>
          <div style={{
            width: `${pct}%`, height: "100%",
            background: ready ? C.ok : pct > 0 ? C.warn : C.dimmer,
            transition: "width 300ms",
          }} />
        </div>
      </div>
      <span style={{
        fontFamily: FONT_MONO, fontSize: 11, color: C.dim, minWidth: 50, textAlign: "end",
      }}>{row.checked_items}/{row.total_items}</span>
      <Badge tone={ready ? "ok" : pct > 0 ? "warn" : "default"}>
        {ready ? t("cl.ready_label") : t("cl.notready_label")}
      </Badge>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════════════════════════════

function formatWhen(ts, t) {
  return fmtWhen(ts, t);
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN TASK VIEW
// ═══════════════════════════════════════════════════════════════════

function AdminTaskView({
  mission, operators, profile, isMobile, canSeeRollup, onBack, reload,
  canDelete, onDelete, confirmDelete, setConfirmDelete, busyDelete, deleteErr,
}) {
  const { t } = useI18n();
  const myOp = operators.find((o) => o.user_id === profile?.id) || null;
  const isAssignee = !!myOp;
  const iAmDone = !!myOp?.done;

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const doneCount  = operators.filter((o) => o.done).length;
  const totalCount = operators.length;

  async function toggleMine() {
    setBusy(true); setErr("");
    const { error } = await setAdminTaskDone({ missionId: mission.id, done: !iAmDone });
    setBusy(false);
    if (error) { setErr(String(error.message || error)); return; }
    reload && reload();
  }

  const statusLabel = MISSION_STATUS_LABELS[mission.status] || mission.status;
  const statusTone  = MISSION_STATUS_TONES[mission.status] || "default";

  return (
    <>
      <PageHeader
        title={mission.name}
        subtitle={`${t("cl.admin_due")} ${formatWhen(mission.due_at, t)}${mission.location ? ` · ${mission.location}` : ""}`}
      />

      <Panel>
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 10,
          alignItems: "center", marginBottom: 14,
        }}>
          <Badge tone={statusTone}>{statusLabel}</Badge>
          <Badge tone="bright">{t("cl.admin_task")}</Badge>
          <Badge tone={doneCount === totalCount ? "ok" : "default"}>
            {doneCount}/{totalCount} {t("cl.done")}
          </Badge>
        </div>

        {mission.notes && (
          <div style={{
            color: C.text, fontSize: 14, lineHeight: 1.5,
            whiteSpace: "pre-wrap", padding: "10px 12px",
            background: C.hoverBg,
            border: `1px solid ${C.border}`, borderRadius: 3, marginBottom: 14,
          }}>{mission.notes}</div>
        )}

        {isAssignee ? (
          <Btn primary={!iAmDone} disabled={busy} fullWidth={isMobile} onClick={toggleMine}>
            {iAmDone ? t("cl.mark_notdone") : t("cl.mark_done")}
          </Btn>
        ) : (
          <div style={{ color: C.dim, fontSize: 13 }}>{t("cl.not_assigned_task")}</div>
        )}

        {canDelete && (
          <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center" }}>
            <Btn small disabled={busyDelete} onClick={onDelete}
              style={{ color: C.error, borderColor: confirmDelete ? C.error : C.errBorderFaint }}>
              {busyDelete ? t("cl.deleting") : confirmDelete ? t("cl.confirm_delete") : t("cl.delete_task")}
            </Btn>
            {confirmDelete && !busyDelete && (
              <Btn small onClick={() => setConfirmDelete(false)}>{t("cl.cancel")}</Btn>
            )}
          </div>
        )}

        <ErrLine>{err || deleteErr}</ErrLine>
      </Panel>

      {canSeeRollup && (
        <Panel title={t("cl.assignees")}>
          {operators.length === 0 && (
            <div style={{ color: C.dim, fontSize: 13 }}>{t("cl.no_assignees")}</div>
          )}
          {operators.map((o) => (
            <div key={o.user_id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 0", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap",
            }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontFamily: FONT_MONO, color: C.bright, fontWeight: 600, fontSize: 14 }}>
                  {o.callsign || "—"}
                </div>
                <div style={{ color: C.dim, fontSize: 12 }}>
                  {o.full_name || "—"}
                  {o.profile_role && <> · {roleLabel(o.profile_role)}</>}
                </div>
              </div>
              <Badge tone={o.done ? "ok" : "default"}>
                {o.done ? t("cl.done") : t("cl.pending")}
              </Badge>
            </div>
          ))}
        </Panel>
      )}

      <div style={{ marginTop: 8 }}>
        <Btn onClick={onBack} fullWidth={isMobile}>{t("cl.back")}</Btn>
      </div>
    </>
  );
}
