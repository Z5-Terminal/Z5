// Z5 :: Recruitment Cycles (admin) — Phase C1.
// Three sub-views (list / create / detail) selected by local state.
// Detail surfaces the candidate-facing URL once the cycle is opened.

import { useEffect, useRef, useState } from "react";
import { useI18n, fmtWhen } from "../../i18n";
import { useIsMobile } from "../../useIsMobile";
import {
  PageHeader, Panel, Btn, Input, Textarea, Field, Badge, ErrLine, OkLine,
  Skeleton, SkeletonRows,
} from "../../ui";
import { C, FONT_MONO } from "../../theme";
import {
  listCycles, getCycle, createCycle, updateCycle, deleteCycle,
  beginCycle, regenerateToken, setCycleStatus, surveyUrlForCycle,
  getCycleSurveyStats, getCandidateCountsByCycle,
} from "../../data/recruitment";
import { supabase } from "../../supabase";
import QuestionEditor from "./QuestionEditor";
import ExamEditor from "./ExamEditor";

export default function Cycles() {
  const { t } = useI18n();
  const [view, setView] = useState("list");
  const [activeId, setActiveId] = useState(null);
  const [activeName, setActiveName] = useState("");

  if (view === "create") {
    return (
      <CycleCreate
        onCreated={(id) => { setActiveId(id); setView("detail"); }}
        onCancel={() => setView("list")}
      />
    );
  }
  if (view === "questions" && activeId) {
    return (
      <QuestionEditor
        cycleId={activeId}
        cycleName={activeName}
        onBack={() => setView("detail")}
      />
    );
  }
  if (view === "exam" && activeId) {
    return (
      <ExamEditor
        cycleId={activeId}
        cycleName={activeName}
        onBack={() => setView("detail")}
      />
    );
  }
  if (view === "detail" && activeId) {
    return (
      <CycleDetail
        cycleId={activeId}
        onBack={() => setView("list")}
        onEditQuestions={(name) => { setActiveName(name); setView("questions"); }}
        onEditExam={(name) => { setActiveName(name); setView("exam"); }}
      />
    );
  }
  return (
    <CycleList
      onPick={(id) => { setActiveId(id); setView("detail"); }}
      onNew={() => setView("create")}
    />
  );
}

// ── List ───────────────────────────────────────────────────────────

function CycleList({ onPick, onNew }) {
  const { t } = useI18n();
  const [cycles, setCycles] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function loadCounts() {
    const { data } = await getCandidateCountsByCycle();
    if (data) setCounts(data);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data, error }] = await Promise.all([listCycles(), loadCounts()]);
      if (cancelled) return;
      if (error) setErr(error.message);
      else setCycles(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Live candidate counts — refresh whenever anyone enters a survey.
  useEffect(() => {
    const ch = supabase.channel("z5-cycles-live")
      .on("postgres_changes",
          { event: "*", schema: "public", table: "candidates" },
          () => loadCounts())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <>
      <PageHeader
        title={t("rec.cycles.title")}
        subtitle={t("rec.cycles.subtitle")}
        action={<Btn onClick={onNew}>{t("rec.cycles.new")}</Btn>}
      />
      <Panel>
        {loading && <SkeletonRows rows={3} />}
        {!loading && cycles.length === 0 && (
          <div style={{ color: C.dim, fontSize: 14 }}>{t("rec.cycles.empty")}</div>
        )}
        {!loading && cycles.map((c, i) => (
          <CycleRow
            key={c.id}
            cycle={c}
            count={counts[c.id] || 0}
            isLast={i === cycles.length - 1}
            onClick={() => onPick(c.id)}
          />
        ))}
        <ErrLine>{err}</ErrLine>
      </Panel>
    </>
  );
}

// Flat list row — hairline divider between rows, no nested card borders.
function CycleRow({ cycle, count, isLast, onClick }) {
  const { t } = useI18n();
  const [hover, setHover] = useState(false);
  const isLive = cycle.status === "open";
  const subtitle = [
    t("rec.cycles.n_candidates", { n: count }),
    cycle.created_at
      ? t("rec.cycles.created_on", { d: fmtWhen(cycle.created_at, t, { year: "numeric", month: "short", day: "numeric" }) })
      : null,
  ].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
        padding: "16px 8px",
        background: hover ? C.hoverBg : "transparent",
        border: "none",
        borderBottom: isLast ? "none" : `1px solid ${C.border}`,
        borderRadius: 8,
        textAlign: "start",
        cursor: "pointer",
        color: C.text,
        fontFamily: "inherit",
        transition: "background 140ms ease-out",
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          color: C.bright, fontWeight: 600, fontSize: 15, letterSpacing: "0.3px",
          marginBottom: 4,
        }}>{cycle.name}</div>
        <div style={{ fontSize: 12, color: C.dim }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {isLive && count > 0 && <LiveCountBadge count={count} />}
        <Badge tone={statusTone(cycle.status)}>
          {t(`rec.cycle_status.${cycle.status}`)}
        </Badge>
      </div>
    </button>
  );
}

// Small pulsing "live" pill with the current candidate count.
function LiveCountBadge({ count }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      padding: "3px 10px",
      fontSize: 11,
      fontWeight: 700,
      fontFamily: FONT_MONO,
      letterSpacing: "0.5px",
      color: C.ok,
      background: C.okBg,
      border: `1px solid ${C.okBorder}`,
      borderRadius: 999,
    }}>
      <LiveDot />
      {count}
    </span>
  );
}

function LiveDot({ size = 7 }) {
  return (
    <span style={{ position: "relative", width: size, height: size, flexShrink: 0, display: "inline-block" }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: C.ok, animation: "z5-ping 1.6s cubic-bezier(0,0,0.2,1) infinite",
      }} />
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: C.ok }} />
    </span>
  );
}

// ── Create ─────────────────────────────────────────────────────────

function CycleCreate({ onCreated, onCancel }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setErr("");
    const { data, error } = await createCycle({
      name: name.trim(), startsOn, endsOn, notes,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (data?.id) onCreated(data.id);
  }

  return (
    <>
      <PageHeader
        title={t("rec.cycles.create")}
        subtitle={t("rec.cycles.create_subtitle")}
        action={<Btn small onClick={onCancel}>{t("rec.back")}</Btn>}
      />
      <Panel>
        <form onSubmit={save}>
          <Field label={t("rec.cycles.name")}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("rec.cycles.name_ph")}
            />
          </Field>
          <Field label={t("rec.cycles.starts_on")}>
            <Input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          </Field>
          <Field label={t("rec.cycles.ends_on")}>
            <Input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
          </Field>
          <Field label={t("rec.cycles.notes")}>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("rec.cycles.notes_ph")}
            />
          </Field>
          <Btn primary type="submit" disabled={busy || !name.trim()}>
            {busy ? t("rec.saving") : t("rec.cycles.create_btn")}
          </Btn>
          <ErrLine>{err}</ErrLine>
        </form>
      </Panel>
    </>
  );
}

// ── Detail ─────────────────────────────────────────────────────────

function CycleDetail({ cycleId, onBack, onEditQuestions, onEditExam }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [cycle, setCycle] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function refresh() {
    const { data } = await getCycle(cycleId);
    setCycle(data);
  }
  useEffect(() => { refresh(); }, [cycleId]);

  if (!cycle) {
    return (
      <>
        <PageHeader title={<Skeleton width={180} height={24} />} />
        <Panel><SkeletonRows rows={2} /></Panel>
        <Panel><SkeletonRows rows={2} /></Panel>
      </>
    );
  }

  const surveyUrl = surveyUrlForCycle(cycle);

  function flash(setter, msg, ms = 2000) {
    setter(msg);
    setTimeout(() => setter(""), ms);
  }

  async function handleBegin() {
    setBusy(true); setErr(""); setOk("");
    const { error } = await beginCycle(cycleId);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    flash(setOk, t("rec.cycles.began"));
    await refresh();
  }

  async function handleRegen() {
    setBusy(true); setErr(""); setOk("");
    const { error } = await regenerateToken(cycleId);
    setBusy(false); setConfirmRegen(false);
    if (error) { setErr(error.message); return; }
    flash(setOk, t("rec.cycles.token_regenerated"));
    await refresh();
  }

  async function handleStatus(next) {
    setBusy(true); setErr(""); setOk("");
    const { error } = await setCycleStatus(cycleId, next);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    flash(setOk, t("rec.cycles.status_updated"));
    await refresh();
  }

  async function handleClose() {
    setBusy(true); setErr(""); setOk("");
    const { error } = await setCycleStatus(cycleId, "closed");
    setBusy(false); setConfirmClose(false);
    if (error) { setErr(error.message); return; }
    flash(setOk, t("rec.cycles.closed"));
    await refresh();
  }

  async function handleDelete() {
    setBusy(true); setErr(""); setOk("");
    const { error } = await deleteCycle(cycleId);
    setBusy(false); setConfirmDelete(false);
    if (error) { setErr(error.message); return; }
    onBack();
  }

  async function copyUrl() {
    if (!surveyUrl) return;
    try {
      await navigator.clipboard.writeText(surveyUrl);
      flash(setOk, t("rec.cycles.url_copied"));
    } catch {
      setErr(t("rec.cycles.url_copy_failed"));
    }
  }

  const isDraft = cycle.status === "draft";
  const isOpen  = cycle.status === "open";
  const isClosed = cycle.status === "closed";

  return (
    <>
      <PageHeader
        title={cycle.name}
        subtitle={t(`rec.cycle_status.${cycle.status}`)}
        action={<Btn small onClick={onBack}>← {t("rec.back")}</Btn>}
      />

      {/* Stage first — the cycle's position in the lifecycle is the
          headline information on this page. */}
      <Panel title={t("rec.cycles.lifecycle")}>
        <CycleStageStepper currentStatus={cycle.status} />
        {!isClosed && !isDraft && (
          <>
            <div style={{ color: C.dim, fontSize: 13, lineHeight: 1.6, marginTop: 22, marginBottom: 14 }}>
              {t(`rec.cycles.status_help.${cycle.status}`)}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {cycle.status === "open" && (
                <Btn small onClick={() => handleStatus("interviewing")} disabled={busy}>
                  → {t("rec.cycle_status.interviewing")}
                </Btn>
              )}
              {cycle.status === "interviewing" && (
                <>
                  <Btn small onClick={() => handleStatus("open")} disabled={busy}>
                    ← {t("rec.cycle_status.open")}
                  </Btn>
                  <Btn small onClick={() => handleStatus("exam")} disabled={busy}>
                    → {t("rec.cycle_status.exam")}
                  </Btn>
                </>
              )}
              {cycle.status === "exam" && (
                <Btn small onClick={() => handleStatus("interviewing")} disabled={busy}>
                  ← {t("rec.cycle_status.interviewing")}
                </Btn>
              )}
              {confirmClose ? (
                <>
                  <Btn small onClick={handleClose} disabled={busy}>
                    {t("rec.cycles.close_confirm")}
                  </Btn>
                  <Btn small onClick={() => setConfirmClose(false)}>✕</Btn>
                </>
              ) : (
                <Btn small onClick={() => setConfirmClose(true)}>{t("rec.cycles.close")}</Btn>
              )}
            </div>
          </>
        )}
      </Panel>

      {!isDraft && <SurveyActivity cycleId={cycleId} closed={isClosed} />}

      <Panel title={t("rec.cycles.access")}>
        {isDraft && (
          <>
            <div style={{ color: C.dim, fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>
              {t("rec.cycles.draft_explainer")}
            </div>
            <Btn primary onClick={handleBegin} disabled={busy}>
              {busy ? t("rec.saving") : t("rec.cycles.begin_btn")}
            </Btn>
          </>
        )}

        {!isDraft && surveyUrl && (
          <>
            <div style={{ color: C.dim, fontSize: 12, marginBottom: 6, letterSpacing: "0.5px", textTransform: "uppercase" }}>
              {t("rec.cycles.survey_url")}
            </div>
            <div style={{
              fontFamily: FONT_MONO,
              fontSize: 13,
              padding: "12px 14px",
              border: `1px solid ${C.border}`,
              background: C.cardBg,
              borderRadius: 3,
              wordBreak: "break-all",
              color: isClosed ? C.dim : C.text,
              marginBottom: 14,
              lineHeight: 1.5,
            }}>
              {surveyUrl}
            </div>
            {isClosed && (
              <div style={{ color: C.warn, fontSize: 12, marginBottom: 14 }}>
                {t("rec.cycles.closed_url_warn")}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn small onClick={copyUrl}>{t("rec.cycles.copy_url")}</Btn>
              {!isClosed && (
                confirmRegen ? (
                  <>
                    <Btn small onClick={handleRegen} disabled={busy}>
                      {t("rec.cycles.regen_confirm")}
                    </Btn>
                    <Btn small onClick={() => setConfirmRegen(false)}>✕</Btn>
                  </>
                ) : (
                  <Btn small onClick={() => setConfirmRegen(true)}>{t("rec.cycles.regen")}</Btn>
                )
              )}
            </div>
          </>
        )}

        <ErrLine>{err}</ErrLine>
        <OkLine>{ok}</OkLine>
      </Panel>

      <Panel title={t("rec.cycles.questions")}>
        <div style={{ color: C.dim, fontSize: 13, marginBottom: 12, lineHeight: 1.6 }}>
          {t("rec.cycles.questions_help")}
        </div>
        <Btn small onClick={() => onEditQuestions(cycle.name)}>
          {t("rec.cycles.edit_questions")}
        </Btn>
      </Panel>

      <Panel title={t("rec.cycles.exam")}>
        <div style={{ color: C.dim, fontSize: 13, marginBottom: 12, lineHeight: 1.6 }}>
          {t("rec.cycles.exam_help")}
        </div>
        <Btn small onClick={() => onEditExam(cycle.name)}>
          {t("rec.cycles.edit_exam")}
        </Btn>
      </Panel>

      <Panel title={t("rec.cycles.danger")}>
        <div style={{ color: C.dim, fontSize: 13, marginBottom: 12, lineHeight: 1.6 }}>
          {t("rec.cycles.delete_explainer")}
        </div>
        {confirmDelete ? (
          <div style={{ display: "flex", gap: 8 }}>
            <Btn small onClick={handleDelete} disabled={busy}>
              {t("rec.cycles.delete_confirm")}
            </Btn>
            <Btn small onClick={() => setConfirmDelete(false)}>✕</Btn>
          </div>
        ) : (
          <Btn small onClick={() => setConfirmDelete(true)}>{t("rec.cycles.delete")}</Btn>
        )}
      </Panel>
    </>
  );
}

// ── Live survey activity ────────────────────────────────────────────
// Realtime funnel for the shared survey link: total candidates who
// opened it, how many are mid-survey right now, how many submitted.
// Subscribes to the candidates table so the numbers move live while
// the panel is open; the big counter "pops" whenever a value changes.

function SurveyActivity({ cycleId, closed }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [stats, setStats] = useState(null); // { total, inProgress, submitted }
  const [popKey, setPopKey] = useState(0);
  const prevTotal = useRef(null);

  async function load() {
    const { data } = await getCycleSurveyStats(cycleId);
    if (!data) return;
    setStats(data);
    if (prevTotal.current !== null && data.total !== prevTotal.current) {
      setPopKey((k) => k + 1); // retrigger the pop animation
    }
    prevTotal.current = data.total;
  }

  useEffect(() => {
    prevTotal.current = null;
    load();
    const ch = supabase.channel(`z5-cycle-live-${cycleId}`)
      .on("postgres_changes",
          { event: "*", schema: "public", table: "candidates", filter: `cycle_id=eq.${cycleId}` },
          () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId]);

  const pct = stats && stats.total > 0
    ? Math.round((stats.submitted / stats.total) * 100)
    : 0;

  return (
    <Panel
      title={t("rec.cycles.live_title")}
      action={!closed && (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700,
          letterSpacing: "1.5px", color: C.ok, textTransform: "uppercase",
        }}>
          <LiveDot />
          {t("rec.cycles.live")}
        </span>
      )}
    >
      {!stats && <SkeletonRows rows={1} />}

      {stats && stats.total === 0 && (
        <div style={{ color: C.dim, fontSize: 13, lineHeight: 1.6 }}>
          {t("rec.cycles.live_empty")}
        </div>
      )}

      {stats && stats.total > 0 && (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: isMobile ? 8 : 14,
            marginBottom: 18,
          }}>
            <ActivityStat
              key={`t${popKey}`}
              value={stats.total}
              label={t("rec.cycles.live_entered")}
              tone={C.bright}
              big
              pop={popKey > 0}
            />
            <ActivityStat
              value={stats.inProgress}
              label={t("rec.cycles.live_in_progress")}
              tone={stats.inProgress > 0 ? C.warn : C.dim}
            />
            <ActivityStat
              value={stats.submitted}
              label={t("rec.cycles.live_submitted")}
              tone={stats.submitted > 0 ? C.ok : C.dim}
            />
          </div>

          {/* Submission progress — animated width */}
          <div style={{
            height: 8,
            borderRadius: 999,
            background: C.progressTrack,
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${pct}%`,
              borderRadius: 999,
              background: C.ok,
              transition: "width 600ms cubic-bezier(0.22, 1, 0.36, 1)",
            }} />
          </div>
          <div style={{
            marginTop: 8,
            fontSize: 11,
            fontFamily: FONT_MONO,
            color: C.dim,
            letterSpacing: "0.5px",
          }}>
            {t("rec.cycles.live_pct", { pct })}
          </div>
        </>
      )}
    </Panel>
  );
}

function ActivityStat({ value, label, tone, big, pop }) {
  const isMobile = useIsMobile();
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4,
      padding: isMobile ? "10px 4px" : "14px 8px",
      background: C.cardBg,
      borderRadius: 10,
    }}>
      <div style={{
        fontFamily: FONT_MONO,
        fontSize: big ? (isMobile ? 30 : 38) : (isMobile ? 22 : 28),
        fontWeight: 700,
        lineHeight: 1,
        color: tone,
        animation: pop ? "z5-pop 420ms ease-out" : "none",
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 10,
        color: C.dim,
        letterSpacing: "1px",
        textTransform: "uppercase",
        fontWeight: 600,
        textAlign: "center",
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Cycle stage stepper ────────────────────────────────────────────
// Horizontal on desktop, vertical on mobile. Five fixed stages, the
// current one rendered in C.ok (green) with a faint glow ring; past
// stages as solid dim circles with active connectors; future stages
// as hollow outlined circles with faint connectors.

const CYCLE_STAGES = ["draft", "open", "interviewing", "exam", "closed"];

function CycleStageStepper({ currentStatus }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const currentIndex = CYCLE_STAGES.indexOf(currentStatus);

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {CYCLE_STAGES.map((stage, i) => (
          <StageRowVert
            key={stage}
            stage={stage}
            state={stageState(i, currentIndex)}
            isLast={i === CYCLE_STAGES.length - 1}
            t={t}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "stretch" }}>
      {CYCLE_STAGES.map((stage, i) => (
        <StageCellHorz
          key={stage}
          stage={stage}
          state={stageState(i, currentIndex)}
          isFirst={i === 0}
          isLast={i === CYCLE_STAGES.length - 1}
          t={t}
        />
      ))}
    </div>
  );
}

function stageState(i, currentIndex) {
  if (currentIndex < 0) return "future";
  if (i < currentIndex)  return "past";
  if (i === currentIndex) return "current";
  return "future";
}

function StageCellHorz({ stage, state, isFirst, isLast, t }) {
  // Left half-line is the segment FROM the previous stage; it's "active"
  // (filled past colour) once we've left the previous stage — i.e., any
  // time this stage is past or current.
  const lineLeftActive  = !isFirst && (state === "past" || state === "current");
  // Right half-line is the segment OUT of this stage; active only after
  // we've moved past it.
  const lineRightActive = !isLast  && state === "past";

  const dotSize = state === "current" ? 14 : 10;
  const dotBg = state === "current" ? C.ok
              : state === "past"    ? C.dim
              : "transparent";
  const dotBorder = state === "future" ? `2px solid ${C.dimmer}` : "none";
  const labelColor = state === "current" ? C.ok
                  : state === "past"    ? C.dim
                  : C.dimmer;

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      minWidth: 0,
    }}>
      <div style={{
        display: "flex", alignItems: "center", width: "100%", height: 18,
      }}>
        <div style={{
          flex: 1, height: 2,
          background: isFirst ? "transparent"
                     : lineLeftActive ? C.dim : C.border,
        }} />
        <div style={{
          width: dotSize, height: dotSize,
          borderRadius: "50%",
          background: dotBg,
          border: dotBorder,
          boxShadow: state === "current" ? `0 0 0 4px ${C.okBg}` : "none",
          margin: "0 6px",
          flexShrink: 0,
          transition: "box-shadow 220ms ease-out",
        }} />
        <div style={{
          flex: 1, height: 2,
          background: isLast ? "transparent"
                    : lineRightActive ? C.dim : C.border,
        }} />
      </div>
      <div style={{
        marginTop: 10,
        fontSize: 11,
        color: labelColor,
        fontFamily: FONT_MONO,
        letterSpacing: "1px",
        textTransform: "uppercase",
        fontWeight: state === "current" ? 700 : 500,
        textAlign: "center",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        width: "100%",
      }}>
        {t(`rec.cycle_status.${stage}`)}
      </div>
    </div>
  );
}

function StageRowVert({ stage, state, isLast, t }) {
  const dotSize = state === "current" ? 14 : 10;
  const dotBg = state === "current" ? C.ok
              : state === "past"    ? C.dim
              : "transparent";
  const dotBorder = state === "future" ? `2px solid ${C.dimmer}` : "none";
  const labelColor = state === "current" ? C.ok
                  : state === "past"    ? C.dim
                  : C.dimmer;
  const connectorColor = state === "past" ? C.dim : C.border;

  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 12 }}>
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        width: 18, flexShrink: 0,
      }}>
        <div style={{ height: 4 }} />
        <div style={{
          width: dotSize, height: dotSize,
          borderRadius: "50%",
          background: dotBg,
          border: dotBorder,
          boxShadow: state === "current" ? `0 0 0 4px ${C.okBg}` : "none",
        }} />
        {!isLast && (
          <div style={{
            width: 2, flex: 1, background: connectorColor, marginTop: 4,
          }} />
        )}
      </div>
      <div style={{
        flex: 1,
        paddingBottom: isLast ? 0 : 12,
        fontSize: 13,
        color: labelColor,
        fontFamily: FONT_MONO,
        letterSpacing: "0.8px",
        textTransform: "uppercase",
        fontWeight: state === "current" ? 700 : 500,
        lineHeight: 1.4,
      }}>
        {t(`rec.cycle_status.${stage}`)}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function statusTone(s) {
  if (s === "open") return "ok";
  if (s === "draft") return "warn";
  if (s === "closed") return "default";
  return "bright"; // interviewing / exam
}
