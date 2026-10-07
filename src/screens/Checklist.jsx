import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, roleLabelT, canCreateInvites } from "../auth";
import { useI18n, fmtWhen } from "../i18n";
import {
  getMission, getMyChecklistState, toggleChecklistItem,
  getMissionReadiness, subscribeMissionRealtime, updateMissionStatus,
  setAdminTaskDone, deleteMission,
} from "../data/missions";
import {
  Panel, PageHeader, Btn, Badge, Mono, Num, ErrLine, OkLine, Tile, Row, List,
  Disclosure, Checkbox, Progress, Notice, EmptyState, Skeleton, SkeletonRows,
  ConfirmDialog, Menu, IconButton, ELLIPSIS,
} from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, R, S, T } from "../theme";
import { MOTION, DURATION } from "../motion";
import {
  SECTIONS, SECTION_LABELS, sectionsForRole,
  OPERATOR_ROLE_LABELS, MISSION_STATUS_LABELS, MISSION_STATUS_TONES,
} from "../missionTemplate";

// ── Section icons ──────────────────────────────────────────────────
// Subject marks for the checklist sections (also used by the checklist
// editor in MissionCreate). They inherit currentColor.
const svg = (children) => (
  <svg
    width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden
    stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"
    style={{ display: "block", flexShrink: 0 }}
  >
    {children}
  </svg>
);

export const SECTION_ICONS = {
  sniper_rec10: svg(<>
    <line x1="1" y1="8" x2="15" y2="8" strokeWidth="1.2" />
    <line x1="4" y1="5" x2="4" y2="11" strokeWidth="1" />
    <circle cx="10" cy="8" r="3" strokeWidth="1.2" />
    <line x1="10" y1="5.5" x2="10" y2="10.5" strokeWidth="0.7" />
    <line x1="7.5" y1="8" x2="12.5" y2="8" strokeWidth="0.7" />
  </>),
  sniper_bolt: svg(<>
    <line x1="1" y1="8" x2="15" y2="8" strokeWidth="1.4" />
    <line x1="3" y1="5" x2="3" y2="11" strokeWidth="1" />
    <rect x="6" y="6" width="5" height="4" rx="1" strokeWidth="1" />
    <line x1="12" y1="8" x2="14" y2="10" strokeWidth="1" />
  </>),
  spotter_tl: svg(<>
    <circle cx="8" cy="8" r="5" strokeWidth="1.2" />
    <line x1="8" y1="2" x2="8" y2="5" strokeWidth="1" />
    <line x1="8" y1="11" x2="8" y2="14" strokeWidth="1" />
    <line x1="2" y1="8" x2="5" y2="8" strokeWidth="1" />
    <line x1="11" y1="8" x2="14" y2="8" strokeWidth="1" />
    <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
  </>),
  all: svg(<>
    <rect x="3" y="2" width="10" height="12" rx="1" strokeWidth="1.2" />
    <line x1="5" y1="5" x2="11" y2="5" strokeWidth="0.8" />
    <line x1="5" y1="8" x2="11" y2="8" strokeWidth="0.8" />
    <line x1="5" y1="11" x2="9" y2="11" strokeWidth="0.8" />
  </>),
  final_check: svg(<>
    <circle cx="8" cy="8" r="6" strokeWidth="1.2" />
    <path d="M5.5 8 L7.5 10 L11 5.5" strokeWidth="1.3" />
  </>),
  final_ready: svg(
    <path d="M3 8 L6.5 11.5 L13 4.5" strokeWidth="2" />
  ),
};

// Long form for the summary ("Wednesday, October 7, 2026, 21:30"); the
// header keeps the short form used in lists.
const LONG_WHEN = {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
};

const rise = () => ({ animation: `z5-rise ${DURATION.move}ms var(--z5-spring) backwards` });

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
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);

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
    setOk(t("cl.status_set", { status: statusText(next, t) }));
    load();
  }

  function canDeleteMission(m) {
    if (!m || !profile) return false;
    if (m.created_by === profile.id) return true;
    return ["admin", "officer", "squad_leader"].includes(profile.role);
  }

  // Runs from the confirmation dialog.
  async function handleDelete() {
    setBusyDelete(true);
    setErr("");
    const { error } = await deleteMission(missionId);
    setBusyDelete(false);
    if (error) { setErr(String(error.message || error)); setConfirmDelete(false); return; }
    onBack();
  }

  const back = { onClick: onBack, label: t("cl.back") };

  if (loading) {
    return (
      <>
        <PageHeader back={back} title={t("cl.title")} />
        <Panel>
          <div aria-busy="true">
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <Skeleton width={62} height={22} style={{ borderRadius: R.pill }} />
              <Skeleton width={84} height={22} style={{ borderRadius: R.pill }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 20 }}>
              <Skeleton height={58} style={{ borderRadius: R.md }} />
              <Skeleton height={58} style={{ borderRadius: R.md }} />
            </div>
            <Skeleton width="32%" height={26} style={{ marginBottom: 12 }} />
            <Skeleton height={8} style={{ borderRadius: R.pill }} />
          </div>
        </Panel>
        <Panel>
          <SkeletonRows rows={5} />
        </Panel>
      </>
    );
  }

  if (!mission) {
    // The data layer reports a missing row with its own (English)
    // message; the title already says that, so only show other errors.
    const detail = err && !/not found/i.test(err) ? err : null;
    return (
      <>
        <PageHeader back={back} title={t("cl.title")} />
        <Panel>
          <EmptyState icon="target" title={t("cl.notfound")}>{detail}</EmptyState>
        </Panel>
      </>
    );
  }

  const isAdminKind = mission.kind === "admin";

  // Destructive action lives behind "more"; it is confirmed in a dialog.
  const moreMenu = canDeleteMission(mission) ? (
    <Menu
      items={[{
        key: "delete",
        label: isAdminKind ? t("cl.delete_task") : t("cl.delete"),
        icon: "trash",
        danger: true,
        onSelect: () => setConfirmDelete(true),
      }]}
      trigger={(p) => (
        <IconButton icon="ellipsis" label={t("mis.more")} size={isMobile ? 40 : 34} {...p} />
      )}
    />
  ) : null;

  const deleteDialog = (
    <ConfirmDialog
      open={confirmDelete}
      title={isAdminKind ? t("cl.delete_task_title") : t("cl.delete_title")}
      message={isAdminKind ? t("cl.delete_task_body") : t("cl.delete_body")}
      confirmLabel={busyDelete ? t("cl.deleting") : (isAdminKind ? t("cl.delete_task") : t("cl.delete"))}
      cancelLabel={t("common.cancel")}
      busy={busyDelete}
      onConfirm={handleDelete}
      onCancel={() => setConfirmDelete(false)}
    />
  );

  if (isAdminKind) {
    return (
      <AdminTaskView
        mission={mission} operators={operators} profile={profile}
        isMobile={isMobile} canSeeRollup={canSeeRollup} back={back}
        reload={load} headerAction={moreMenu} deleteDialog={deleteDialog}
        deleteErr={err}
      />
    );
  }

  const opCount = operators.length;
  const isReadOnly = !myOp && canSeeRollup;
  // Someone who is neither assigned nor a leader has no checklist here,
  // so there is no progress to report for them.
  const showProgress = !!aggregateProgress || !!myOp;

  // Build section list for assigned / admin view
  const assignedSections = myOp
    ? SECTIONS.filter((sec) => myApplicableSections.has(sec.key))
    : (canSeeRollup ? SECTIONS : []);

  const sectionBlocks = assignedSections
    .map((sec) => {
      const sectionItems = isReadOnly
        ? items.filter((it) => it.section === sec.key)
        : myItems.filter((it) => it.section === sec.key);
      if (sectionItems.length === 0) return null;
      const done = isReadOnly ? 0 : sectionItems.filter((it) => stateMap.get(it.id)).length;
      return { key: sec.key, sectionItems, done, allDone: !isReadOnly && done === sectionItems.length };
    })
    .filter(Boolean);

  const readyCount = readiness.filter((r) => r.ready_to_move).length;

  // Valid next transitions (unchanged): a scheduled mission can become
  // active or complete, an active one complete, and anything that is not
  // finished can be cancelled.
  const canActivate = mission.status === "scheduled";
  const canComplete = mission.status === "active" || mission.status === "scheduled";
  const canCancel = mission.status !== "complete" && mission.status !== "cancelled";
  const hasStatusActions = canSeeRollup && (canActivate || canComplete || canCancel);

  // Checklist sections
  const checklistPanel = sectionBlocks.length > 0 && (
    <Panel title={isReadOnly ? t("mc.checklist") : t("cl.my_checklist")}>
      {isReadOnly && (
        <div style={{ ...T.footnote, color: C.dim, marginBottom: 6 }}>{t("cl.readonly_hint")}</div>
      )}
      <List>
        {sectionBlocks.map((b) => (
          <Disclosure
            key={b.key}
            defaultOpen
            title={SECTION_LABELS[b.key] || b.key}
            icon={SECTION_ICONS[b.key]
              ? <span style={{ display: "flex", color: b.allDone ? C.ok : C.dim, transition: `color ${MOTION.fade}` }}>{SECTION_ICONS[b.key]}</span>
              : null}
            trailing={(
              <Badge tone={b.allDone ? "ok" : "default"}>
                <Num>{isReadOnly ? `${b.sectionItems.length}` : `${b.done}/${b.sectionItems.length}`}</Num>
              </Badge>
            )}
          >
            <List inset={34}>
              {b.sectionItems.map((it) => (
                <ChecklistRow
                  key={it.id}
                  label={it.label}
                  checked={!isReadOnly && !!stateMap.get(it.id)}
                  onToggle={isReadOnly ? undefined : (next) => onToggle(it.id, next)}
                />
              ))}
            </List>
          </Disclosure>
        ))}
      </List>
    </Panel>
  );

  // Team readiness roll-up
  const readinessPanel = canSeeRollup && readiness.length > 0 && (
    <Panel
      title={t("cl.team_ready")}
      action={(
        <Badge tone={readyCount === readiness.length ? "ok" : "default"}>
          <Num>{`${readyCount}/${readiness.length}`}</Num> {t("cl.ready_label")}
        </Badge>
      )}
    >
      <List>
        {readiness.map((r) => (
          <ReadinessRow key={r.user_id} row={r} isMobile={isMobile} />
        ))}
      </List>
    </Panel>
  );

  return (
    <>
      <PageHeader
        back={back}
        title={mission.name}
        subtitle={<KindLine kind={t("kind.operational")} count={opCount} />}
        action={moreMenu}
      />

      {/* ── Summary: what, when, where, who — and how far along ─────── */}
      <Panel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 14 }}>
          <Badge tone={MISSION_STATUS_TONES[mission.status] || "default"}>
            {statusText(mission.status, t)}
          </Badge>
          {myRole
            ? <Badge tone="ok">{t("cl.yourrole")} {OPERATOR_ROLE_LABELS[myRole] || myRole}</Badge>
            : !canSeeRollup && <Badge tone="warn">{t("cl.notassigned")}</Badge>}
        </div>

        <FactGrid columns={isMobile || !mission.location ? 1 : 2}>
          <Fact label={t("cl.f_when")}>
            <Num>{mission.scheduled_at ? fmtWhen(mission.scheduled_at, t, LONG_WHEN) : t("common.tbd")}</Num>
          </Fact>
          {mission.location && (
            <Fact label={t("cl.f_location")}><bdi>{mission.location}</bdi></Fact>
          )}
          {mission.notes && (
            <Fact label={t("mc.notes")} wide text><bdi>{mission.notes}</bdi></Fact>
          )}
        </FactGrid>

        {showProgress && (
          <ProgressSummary
            label={aggregateProgress ? t("cl.progress_team") : t("cl.progress_mine")}
            checked={checkedCount}
            total={total}
            style={{ marginTop: 20 }}
          />
        )}

        {allFinalReadyChecked && (
          <Notice tone="ok" title={t("cl.ready")} style={{ marginTop: 14, ...rise() }}>
            {t("cl.ready_sub")}
          </Notice>
        )}

        {/* Status — only valid next transitions; the natural next step
            is the primary action. */}
        {hasStatusActions && (
          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {canActivate && (
              <Btn primary type="button" disabled={busyStatus} onClick={() => setStatus("active")}
                style={isMobile ? { flex: "1 1 auto" } : undefined}>
                {t("cl.mark_active")}
              </Btn>
            )}
            {canComplete && (
              <Btn primary={!canActivate} type="button" icon={canActivate ? undefined : "check"}
                disabled={busyStatus} onClick={() => setStatus("complete")}
                style={isMobile ? { flex: "1 1 auto" } : undefined}>
                {t("cl.mark_complete")}
              </Btn>
            )}
            {canCancel && (
              <Btn type="button" disabled={busyStatus} onClick={() => setConfirmCancel(true)}
                style={isMobile ? { flex: "1 1 auto" } : undefined}>
                {t("cl.cancel_mission")}
              </Btn>
            )}
          </div>
        )}

        <ErrLine>{err}</ErrLine>
        <OkLine>{ok}</OkLine>
      </Panel>

      {/* ── Not assigned (and not a leader): nothing to check ────────── */}
      {!myOp && !canSeeRollup && (
        <Notice style={{ marginTop: isMobile ? 12 : 16 }}>{t("cl.not_assigned_msg")}</Notice>
      )}

      {/* A leader who is only observing gets the team first; an assigned
          operator gets their own checklist first. */}
      {isReadOnly ? readinessPanel : checklistPanel}
      {isReadOnly ? checklistPanel : readinessPanel}

      <ConfirmDialog
        open={confirmCancel}
        title={t("cl.cancel_title")}
        message={t("cl.cancel_body")}
        confirmLabel={t("cl.cancel_mission")}
        cancelLabel={t("cl.keep_mission")}
        busy={busyStatus}
        onConfirm={async () => { await setStatus("cancelled"); setConfirmCancel(false); }}
        onCancel={() => setConfirmCancel(false)}
      />
      {deleteDialog}
    </>
  );
}

// Header context line: what kind of thing this is and how many people
// are on it.
function KindLine({ kind, count }) {
  const { t } = useI18n();
  return (
    <>
      {kind}
      {count > 0 && (
        <>
          <span aria-hidden style={{ color: C.dimmer, margin: "0 6px" }}>·</span>
          <Num>{count}</Num> {count === 1 ? t("mc.member") : t("mc.members")}
        </>
      )}
    </>
  );
}

function statusText(status, t) {
  return t(`status.${status}`) || MISSION_STATUS_LABELS[status] || status;
}

// ═══════════════════════════════════════════════════════════════════
// FACTS — label over value in borderless tiles
// ═══════════════════════════════════════════════════════════════════

function FactGrid({ columns = 1, children }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap: 8,
    }}>
      {children}
    </div>
  );
}

//   wide — spans the whole grid; text — long free text (keeps line breaks).
function Fact({ label, children, wide, text }) {
  return (
    <Tile padding="10px 12px" style={{ minWidth: 0, ...(wide ? { gridColumn: "1 / -1" } : null) }}>
      <div style={{ ...S.label, marginBottom: 2 }}>{label}</div>
      <div style={{
        ...T.body,
        color: text ? C.text : C.bright,
        fontWeight: text ? 400 : 500,
        overflowWrap: "anywhere",
        ...(text ? { whiteSpace: "pre-wrap" } : null),
      }}>
        {children}
      </div>
    </Tile>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PROGRESS — the number that matters, its percentage and a bar
// ═══════════════════════════════════════════════════════════════════

function ProgressSummary({ label, checked, total, style }) {
  const pct = total ? Math.round((checked / total) * 100) : 0;
  const complete = pct === 100;
  return (
    <div style={style}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...S.label, marginBottom: 2 }}>{label}</div>
          <div style={{
            ...T.title1,
            lineHeight: 1.1,
            color: complete ? C.ok : C.bright,
            transition: `color ${MOTION.fade}`,
          }}>
            <Num>{`${checked} / ${total}`}</Num>
          </div>
        </div>
        <div style={{
          ...T.title3,
          color: complete ? C.ok : C.dim,
          transition: `color ${MOTION.fade}`,
        }}>
          <Num>{`${pct}%`}</Num>
        </div>
      </div>
      <Progress value={pct} tone="auto" height={8} label={label} style={{ marginTop: 10 }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CHECKLIST ROW — the whole row is the tap target. Without onToggle it
// is the same row, read-only (a leader viewing a mission they are not
// assigned to).
// ═══════════════════════════════════════════════════════════════════

function ChecklistRow({ label, checked, onToggle }) {
  const readOnly = !onToggle;
  return (
    <Row
      onClick={readOnly ? undefined : () => onToggle(!checked)}
      {...(readOnly ? null : { role: "checkbox", "aria-checked": checked })}
      leading={(
        <span style={{ display: "flex", opacity: readOnly ? 0.45 : 1 }}>
          <Checkbox checked={checked} tone="ok" />
        </span>
      )}
    >
      <span style={{
        display: "block",
        ...T.body,
        color: checked ? C.dim : C.text,
        transition: `color ${MOTION.fade}`,
        overflowWrap: "anywhere",
      }}>
        {/* Labels may be in either language: <bdi> keeps their own
            reading order ("5× Magazines") inside the RTL row. */}
        <bdi>{label}</bdi>
      </span>
    </Row>
  );
}

// ═══════════════════════════════════════════════════════════════════
// READINESS ROW — one operator
// ═══════════════════════════════════════════════════════════════════

function ReadinessRow({ row, isMobile }) {
  const { t } = useI18n();
  const pct = Number(row.pct || 0);
  const ready = !!row.ready_to_move;
  // Fixed-width slots so bars, counts and badges line up down the list.
  const badge = (
    <span style={{ display: "flex", justifyContent: "flex-end", minWidth: 72 }}>
      <Badge tone={ready ? "ok" : "default"}>
        {ready ? t("cl.ready_label") : t("cl.notready_label")}
      </Badge>
    </span>
  );
  const bar = (
    <Progress
      value={pct}
      tone={ready ? "ok" : "ink"}
      height={5}
      style={isMobile ? { flex: 1 } : { width: 160 }}
    />
  );
  const count = (
    <span style={{ ...T.caption, fontWeight: 600, color: ready ? C.ok : C.dim, minWidth: 40, textAlign: "end" }}>
      <Num>{`${row.checked_items}/${row.total_items}`}</Num>
    </span>
  );
  return (
    <Row trailing={isMobile ? badge : <>{bar}{count}{badge}</>}>
      <div style={{ ...T.body, fontWeight: 600, color: C.bright, ...ELLIPSIS }}>
        <Mono>{row.callsign || "—"}</Mono>
      </div>
      <div style={{ ...T.footnote, color: C.dim, marginTop: 1, ...ELLIPSIS }}>
        {row.full_name || "—"}
        {row.op_role && (
          <>
            <span aria-hidden style={{ color: C.dimmer, margin: "0 6px" }}>·</span>
            {OPERATOR_ROLE_LABELS[row.op_role] || row.op_role}
          </>
        )}
      </div>
      {isMobile && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7 }}>
          {bar}
          {count}
        </div>
      )}
    </Row>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN TASK VIEW
// ═══════════════════════════════════════════════════════════════════

function AdminTaskView({
  mission, operators, profile, isMobile, canSeeRollup, back, reload,
  headerAction, deleteDialog, deleteErr,
}) {
  const { t } = useI18n();
  const myOp = operators.find((o) => o.user_id === profile?.id) || null;
  const isAssignee = !!myOp;
  const iAmDone = !!myOp?.done;

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // What I just tapped, shown at once while the server call and the
  // reload are in flight; cleared as soon as real data is back.
  const [pendingDone, setPendingDone] = useState(null);
  const shownDone = pendingDone === null ? iAmDone : pendingDone;

  const doneCount  = operators.filter((o) => o.done).length;
  const totalCount = operators.length;

  async function toggleMine() {
    // Stay busy until the reload lands: the button must not be tappable
    // while what it shows (the pending value) is ahead of loaded state.
    const next = !iAmDone;
    setBusy(true); setErr("");
    setPendingDone(next);
    const { error } = await setAdminTaskDone({ missionId: mission.id, done: next });
    if (error) { setPendingDone(null); setBusy(false); setErr(String(error.message || error)); return; }
    if (reload) await reload();
    setPendingDone(null);
    setBusy(false);
  }

  return (
    <>
      <PageHeader
        back={back}
        title={mission.name}
        subtitle={<KindLine kind={t("cl.admin_task")} count={totalCount} />}
        action={headerAction}
      />

      <Panel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 14 }}>
          <Badge tone={MISSION_STATUS_TONES[mission.status] || "default"}>
            {statusText(mission.status, t)}
          </Badge>
          {!isAssignee && !canSeeRollup && <Badge tone="warn">{t("cl.notassigned")}</Badge>}
        </div>

        <FactGrid columns={isMobile || !mission.location ? 1 : 2}>
          <Fact label={t("common.due")}>
            <Num>{mission.due_at ? fmtWhen(mission.due_at, t, LONG_WHEN) : t("common.tbd")}</Num>
          </Fact>
          {mission.location && (
            <Fact label={t("cl.f_location")}><bdi>{mission.location}</bdi></Fact>
          )}
          {mission.notes && (
            <Fact label={t("cl.f_details")} wide text><bdi>{mission.notes}</bdi></Fact>
          )}
        </FactGrid>

        {totalCount > 0 && (
          <ProgressSummary
            label={t("cl.task_progress")}
            checked={doneCount}
            total={totalCount}
            style={{ marginTop: 20 }}
          />
        )}

        {/* My status — one clear action, answered in place. */}
        <div style={{ marginTop: 16 }}>
          {!isAssignee ? (
            <Notice>{t("cl.not_assigned_task")}</Notice>
          ) : shownDone ? (
            <Notice
              key="done"
              tone="ok"
              title={t("cl.you_done")}
              style={{ alignItems: "center", ...rise() }}
              action={(
                <Btn small type="button" icon="undo" disabled={busy} onClick={toggleMine}>
                  {t("cl.mark_notdone")}
                </Btn>
              )}
            />
          ) : (
            <Btn key="todo" primary type="button" icon="check" disabled={busy}
              fullWidth={isMobile} onClick={toggleMine}>
              {t("cl.mark_done")}
            </Btn>
          )}
        </div>

        <ErrLine>{err || deleteErr}</ErrLine>
      </Panel>

      {canSeeRollup && (
        <Panel
          title={t("cl.assignees")}
          action={totalCount > 0 && (
            <Badge tone={doneCount === totalCount ? "ok" : "default"}>
              <Num>{`${doneCount}/${totalCount}`}</Num> {t("cl.done")}
            </Badge>
          )}
        >
          {operators.length === 0 && (
            <EmptyState compact icon="people" title={t("cl.no_assignees")} />
          )}
          <List>
            {operators.map((o) => (
              <Row
                key={o.user_id}
                title={<Mono>{o.callsign || "—"}</Mono>}
                subtitle={(
                  <>
                    {o.full_name || "—"}
                    {o.profile_role && (
                      <>
                        <span aria-hidden style={{ color: C.dimmer, margin: "0 6px" }}>·</span>
                        {roleLabelT(o.profile_role, t)}
                      </>
                    )}
                  </>
                )}
                trailing={(
                  <Badge tone={o.done ? "ok" : "default"}>
                    {o.done ? t("cl.done") : t("cl.pending")}
                  </Badge>
                )}
              />
            ))}
          </List>
        </Panel>
      )}

      {deleteDialog}
    </>
  );
}
