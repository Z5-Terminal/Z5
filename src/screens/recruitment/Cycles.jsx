// Z5 :: Recruitment Cycles (admin) — Phase C1.
// Sub-views (list / create / detail / question editor / exam editor)
// selected by local state and animated as one push/pop hierarchy.
// Detail surfaces the candidate-facing URL once the cycle is opened.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useI18n, fmtWhen } from "../../i18n";
import { useIsMobile } from "../../useIsMobile";
import {
  PageHeader, Panel, Tile, List, Row, Btn, Input, Textarea, Field, Badge, Num,
  Notice, ErrLine, OkLine, EmptyState, Skeleton, SkeletonRows, Progress,
  CopyField, ConfirmDialog, ViewTransition, Icon, ELLIPSIS, IconTile,
} from "../../ui";
import { C, R, S, T } from "../../theme";
import { MOTION, DURATION } from "../../motion";
import {
  listCycles, getCycle, createCycle, deleteCycle,
  beginCycle, regenerateToken, setCycleStatus, surveyUrlForCycle,
  getCycleSurveyStats, getCandidateCountsByCycle,
} from "../../data/recruitment";
import { supabase } from "../../supabase";
import QuestionEditor from "./QuestionEditor";
import ExamEditor from "./ExamEditor";

// How deep each sub-view sits: going deeper pushes, coming back pops.
const VIEW_DEPTH = { list: 0, create: 1, detail: 1, questions: 2, exam: 2 };

export default function Cycles() {
  const [view, setView] = useState("list");
  const [activeId, setActiveId] = useState(null);
  const [activeName, setActiveName] = useState("");

  // The view that actually renders (detail and the editors need a cycle).
  const shown = view === "create" ? "create"
    : (view === "questions" || view === "exam" || view === "detail") && activeId ? view
    : "list";
  const viewKey = shown === "list" || shown === "create" ? shown : `${shown}:${activeId}`;

  // Direction of the last change. Nothing animates on first mount — the
  // shell's own tab transition already covers that.
  const prev = useRef({ key: viewKey, depth: VIEW_DEPTH[shown] });
  const kindRef = useRef(null);
  if (prev.current.key !== viewKey) {
    kindRef.current = VIEW_DEPTH[shown] < prev.current.depth ? "pop" : "push";
  }
  useLayoutEffect(() => {
    if (prev.current.key === viewKey) return;
    prev.current = { key: viewKey, depth: VIEW_DEPTH[shown] };
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [viewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  let content;
  if (shown === "create") {
    content = (
      <CycleCreate
        onCreated={(id) => { setActiveId(id); setView("detail"); }}
        onCancel={() => setView("list")}
      />
    );
  } else if (shown === "questions") {
    content = (
      <QuestionEditor
        cycleId={activeId}
        cycleName={activeName}
        onBack={() => setView("detail")}
      />
    );
  } else if (shown === "exam") {
    content = (
      <ExamEditor
        cycleId={activeId}
        cycleName={activeName}
        onBack={() => setView("detail")}
      />
    );
  } else if (shown === "detail") {
    content = (
      <CycleDetail
        cycleId={activeId}
        onBack={() => setView("list")}
        onEditQuestions={(name) => { setActiveName(name); setView("questions"); }}
        onEditExam={(name) => { setActiveName(name); setView("exam"); }}
      />
    );
  } else {
    content = (
      <CycleList
        onPick={(id) => { setActiveId(id); setView("detail"); }}
        onNew={() => setView("create")}
      />
    );
  }

  return (
    <ViewTransition
      viewKey={viewKey}
      kind={kindRef.current || "tab"}
      style={kindRef.current ? undefined : { animation: "none" }}
    >
      {content}
    </ViewTransition>
  );
}

// Renders an i18n template with its `{token}` number going through <Num>
// (tabular figures, bidi-isolated). A "%" right after the token stays
// attached to the number so "88%" never splits in Hebrew.
function withNum(template, token, value) {
  const m = String(template).match(new RegExp(`\\{${token}\\}(%?)`));
  if (!m) return template;
  return [
    template.slice(0, m.index),
    <Num key="n">{value}{m[1]}</Num>,
    template.slice(m.index + m[0].length),
  ];
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
        action={(
          <Btn small primary type="button" icon="plus" onClick={onNew}>
            {t("rec.cycles.new")}
          </Btn>
        )}
      />
      <Panel>
        {loading && <SkeletonRows rows={3} />}
        {!loading && cycles.length === 0 && !err && (
          <EmptyState
            icon="cycles"
            title={t("rec.cycles.empty_title")}
            action={(
              <Btn type="button" icon="plus" onClick={onNew}>{t("rec.cycles.new")}</Btn>
            )}
          >
            {t("rec.cycles.empty_hint")}
          </EmptyState>
        )}
        {!loading && cycles.length > 0 && (
          <List>
            {cycles.map((c) => (
              <CycleRow
                key={c.id}
                cycle={c}
                count={counts[c.id] || 0}
                onClick={() => onPick(c.id)}
              />
            ))}
          </List>
        )}
        <ErrLine>{err}</ErrLine>
      </Panel>
    </>
  );
}

// One cycle: name, "{n} candidates · created {date}", status, and — while
// the survey is open — the live candidate count. On phones the badges
// drop to their own line so neither the name nor the dates get squeezed.
function CycleRow({ cycle, count, onClick }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const isLive = cycle.status === "open";
  const created = cycle.created_at
    ? fmtWhen(cycle.created_at, t, { year: "numeric", month: "short", day: "numeric" })
    : null;
  const badges = (
    <>
      <Badge tone={statusTone(cycle.status)}>
        {t(`rec.cycle_status.${cycle.status}`)}
      </Badge>
      {isLive && count > 0 && <LiveCountBadge count={count} />}
    </>
  );

  return (
    <Row
      onClick={onClick}
      chevron
      wrap
      title={cycle.name}
      subtitle={(
        <>
          {withNum(t("rec.cycles.n_candidates"), "n", count)}
          {created && (
            <>
              <span aria-hidden style={{ color: C.dimmer, margin: "0 6px" }}>·</span>
              {withNum(t("rec.cycles.created_on"), "d", created)}
            </>
          )}
        </>
      )}
      trailing={isMobile ? null : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: "row-reverse" }}>
          {badges}
        </div>
      )}
    >
      {isMobile && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 7, marginBottom: 2 }}>
          {badges}
        </div>
      )}
    </Row>
  );
}

// "Live" pill with the current candidate count.
function LiveCountBadge({ count }) {
  return (
    <Badge tone="ok" style={{ gap: 6 }}>
      <LiveDot />
      <Num>{count}</Num>
    </Badge>
  );
}

// The one looping animation on these screens: it means "updating live".
function LiveDot({ size = 7 }) {
  return (
    <span aria-hidden style={{ position: "relative", width: size, height: size, flexShrink: 0, display: "inline-block" }}>
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
  const isMobile = useIsMobile();
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
        back={{ onClick: onCancel, label: t("rec.cycles.title") }}
        title={t("rec.cycles.create")}
        subtitle={t("rec.cycles.create_subtitle")}
      />
      <Panel style={{ maxWidth: 640 }}>
        <form onSubmit={save}>
          <Field label={t("rec.cycles.name")}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("rec.cycles.name_ph")}
            />
          </Field>
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))",
            columnGap: 12,
          }}>
            <Field label={t("rec.cycles.starts_on")}>
              <Input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
            </Field>
            <Field label={t("rec.cycles.ends_on")}>
              <Input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
            </Field>
          </div>
          <Field label={t("rec.cycles.notes")}>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("rec.cycles.notes_ph")}
              style={{ height: 96 }}
            />
          </Field>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <Btn primary type="submit" disabled={busy || !name.trim()} busy={busy}>
              {busy ? t("rec.saving") : t("rec.cycles.create_btn")}
            </Btn>
            <Btn type="button" onClick={onCancel}>{t("common.cancel")}</Btn>
          </div>
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
  // Which section the last action came from, so its message shows there.
  const [msgAt, setMsgAt] = useState("access");
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function refresh() {
    const { data } = await getCycle(cycleId);
    setCycle(data);
  }
  useEffect(() => { refresh(); }, [cycleId]);

  const back = { onClick: onBack, label: t("rec.cycles.title") };

  if (!cycle) {
    return (
      <>
        <PageHeader back={back} title={<Skeleton width={220} height={30} />} />
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
    setBusy(true); setErr(""); setOk(""); setMsgAt("access");
    const { error } = await beginCycle(cycleId);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    flash(setOk, t("rec.cycles.began"));
    await refresh();
  }

  async function handleRegen() {
    setBusy(true); setErr(""); setOk(""); setMsgAt("access");
    const { error } = await regenerateToken(cycleId);
    setBusy(false); setConfirmRegen(false);
    if (error) { setErr(error.message); return; }
    flash(setOk, t("rec.cycles.token_regenerated"));
    await refresh();
  }

  async function handleStatus(next) {
    setBusy(true); setErr(""); setOk(""); setMsgAt("stage");
    const { error } = await setCycleStatus(cycleId, next);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    flash(setOk, t("rec.cycles.status_updated"));
    await refresh();
  }

  async function handleClose() {
    setBusy(true); setErr(""); setOk(""); setMsgAt("stage");
    const { error } = await setCycleStatus(cycleId, "closed");
    setBusy(false); setConfirmClose(false);
    if (error) { setErr(error.message); return; }
    flash(setOk, t("rec.cycles.closed"));
    await refresh();
  }

  async function handleDelete() {
    setBusy(true); setErr(""); setOk(""); setMsgAt("danger");
    const { error } = await deleteCycle(cycleId);
    setBusy(false); setConfirmDelete(false);
    if (error) { setErr(error.message); return; }
    onBack();
  }

  // CopyField confirms a successful copy in place but stays silent when
  // the clipboard is unavailable. Run the same write alongside it (same
  // tap, same text) purely to surface the "select it manually" fallback.
  function probeCopy(e) {
    if (!surveyUrl || !e.target.closest || !e.target.closest("button")) return;
    setMsgAt("access");
    const msg = t("rec.cycles.url_copy_failed");
    const failed = () => setErr(msg);
    const worked = () => setErr((cur) => (cur === msg ? "" : cur));
    try {
      navigator.clipboard.writeText(surveyUrl).then(worked, failed);
    } catch {
      failed();
    }
  }

  const isDraft = cycle.status === "draft";
  const isClosed = cycle.status === "closed";
  const canMove = !isClosed && !isDraft;
  const stageHelp = canMove ? t(`rec.cycles.status_help.${cycle.status}`) : null;
  const messages = (where) => (msgAt === where ? (
    <>
      <ErrLine>{err}</ErrLine>
      <OkLine>{ok}</OkLine>
    </>
  ) : null);

  return (
    <>
      <PageHeader
        back={back}
        title={cycle.name}
        subtitle={(
          <Badge tone={statusTone(cycle.status)}>
            {t(`rec.cycle_status.${cycle.status}`)}
          </Badge>
        )}
      />

      {/* Stage first — the cycle's position in the lifecycle is the
          headline information on this page. */}
      <Panel title={t("rec.cycles.lifecycle")}>
        <CycleStageStepper currentStatus={cycle.status} help={stageHelp} />
        {canMove && (
          <>
            {!isMobile && (
              <div style={{ ...T.callout, color: C.dim, marginTop: 18 }}>
                {stageHelp}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: isMobile ? 18 : 14 }}>
              {cycle.status === "open" && (
                <Btn primary type="button" iconEnd="arrowForward" iconFlip
                  onClick={() => handleStatus("interviewing")} disabled={busy}>
                  {t("rec.cycle_status.interviewing")}
                </Btn>
              )}
              {cycle.status === "interviewing" && (
                <>
                  <Btn type="button" icon="arrowBack" iconFlip
                    onClick={() => handleStatus("open")} disabled={busy}>
                    {t("rec.cycle_status.open")}
                  </Btn>
                  <Btn primary type="button" iconEnd="arrowForward" iconFlip
                    onClick={() => handleStatus("exam")} disabled={busy}>
                    {t("rec.cycle_status.exam")}
                  </Btn>
                </>
              )}
              {cycle.status === "exam" && (
                <Btn type="button" icon="arrowBack" iconFlip
                  onClick={() => handleStatus("interviewing")} disabled={busy}>
                  {t("rec.cycle_status.interviewing")}
                </Btn>
              )}
              <Btn type="button" onClick={() => setConfirmClose(true)} disabled={busy}>
                {t("rec.cycles.close")}
              </Btn>
            </div>
          </>
        )}
        {messages("stage")}
      </Panel>

      {!isDraft && <SurveyActivity cycleId={cycleId} closed={isClosed} />}

      <Panel title={t("rec.cycles.access")}>
        {isDraft && (
          <>
            <div style={{ ...T.callout, color: C.dim, marginBottom: 16, maxWidth: 620 }}>
              {t("rec.cycles.draft_explainer")}
            </div>
            <Btn primary type="button" onClick={handleBegin} disabled={busy} busy={busy}>
              {busy ? t("rec.saving") : t("rec.cycles.begin_btn")}
            </Btn>
          </>
        )}

        {!isDraft && surveyUrl && (
          <>
            <div style={S.label}>{t("rec.cycles.survey_url")}</div>
            <div onClickCapture={probeCopy}>
              <CopyField
                value={surveyUrl}
                copyLabel={isMobile ? t("common.copy") : t("rec.cycles.copy_url")}
                copiedLabel={t("common.copied")}
              />
            </div>
            {isClosed && (
              <Notice tone="warn" style={{ marginTop: 12 }}>
                {t("rec.cycles.closed_url_warn")}
              </Notice>
            )}
            {!isClosed && (
              <div style={{ marginTop: 12 }}>
                <Btn type="button" icon="refresh" onClick={() => setConfirmRegen(true)} disabled={busy}>
                  {t("rec.cycles.regen")}
                </Btn>
              </div>
            )}
          </>
        )}

        {messages("access")}
      </Panel>

      {/* Question bank and exam — each opens its own editor. */}
      <Panel title={t("rec.cycles.content")}>
        <List>
          <Row
            onClick={() => onEditQuestions(cycle.name)}
            chevron
            wrap
            aria-label={t("rec.cycles.edit_questions")}
            leading={<IconTile icon="list" />}
            title={t("rec.cycles.questions")}
            subtitle={t("rec.cycles.questions_help")}
          />
          <Row
            onClick={() => onEditExam(cycle.name)}
            chevron
            wrap
            aria-label={t("rec.cycles.edit_exam")}
            leading={<IconTile icon="graduation" />}
            title={t("rec.cycles.exam")}
            subtitle={t("rec.cycles.exam_help")}
          />
        </List>
      </Panel>

      <Panel title={t("rec.cycles.danger")}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: isMobile ? 12 : 16 }}>
          <div style={{ flex: "1 1 280px", minWidth: 0, ...T.footnote, color: C.dim }}>
            {t("rec.cycles.delete_explainer")}
          </div>
          <Btn danger type="button" icon="trash" onClick={() => setConfirmDelete(true)} disabled={busy}>
            {t("rec.cycles.delete")}
          </Btn>
        </div>
        {messages("danger")}
      </Panel>

      <ConfirmDialog
        open={confirmClose}
        title={t("rec.cycles.close")}
        message={t("rec.cycles.close_body")}
        confirmLabel={t("rec.cycles.close_confirm")}
        cancelLabel={t("common.cancel")}
        danger={false}
        busy={busy}
        onConfirm={handleClose}
        onCancel={() => setConfirmClose(false)}
      />
      <ConfirmDialog
        open={confirmRegen}
        title={t("rec.cycles.regen")}
        message={t("rec.cycles.regen_body")}
        confirmLabel={t("rec.cycles.regen_confirm")}
        cancelLabel={t("common.cancel")}
        danger={false}
        busy={busy}
        onConfirm={handleRegen}
        onCancel={() => setConfirmRegen(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={t("rec.cycles.delete")}
        message={t("rec.cycles.delete_explainer")}
        confirmLabel={t("rec.cycles.delete_confirm")}
        cancelLabel={t("common.cancel")}
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

// ── Live survey activity ────────────────────────────────────────────
// Realtime funnel for the shared survey link: total candidates who
// opened it, how many are mid-survey right now, how many submitted.
// Subscribes to the candidates table so the numbers move live while
// the panel is open; the "entered" counter pops whenever it changes.

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
  const grid = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: isMobile ? 8 : 12,
  };

  return (
    <Panel
      title={t("rec.cycles.live_title")}
      action={!closed && (
        <Badge tone="ok" style={{ gap: 6 }}>
          <LiveDot />
          {t("rec.cycles.live")}
        </Badge>
      )}
    >
      {!stats && (
        <div aria-busy="true" style={grid}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={isMobile ? 76 : 86} style={{ borderRadius: R.md }} />
          ))}
        </div>
      )}

      {stats && stats.total === 0 && (
        <EmptyState compact icon="clipboard">
          {t("rec.cycles.live_empty")}
        </EmptyState>
      )}

      {stats && stats.total > 0 && (
        <>
          <div style={grid}>
            <ActivityStat
              key={`t${popKey}`}
              value={stats.total}
              label={t("rec.cycles.live_entered")}
              color={C.bright}
              pop={popKey > 0}
            />
            <ActivityStat
              value={stats.inProgress}
              label={t("rec.cycles.live_in_progress")}
              color={stats.inProgress > 0 ? C.bright : C.dimmer}
            />
            <ActivityStat
              value={stats.submitted}
              label={t("rec.cycles.live_submitted")}
              color={stats.submitted > 0 ? C.ok : C.dimmer}
            />
          </div>

          {/* Share of entrants who submitted — same green as "Submitted". */}
          <Progress
            value={pct}
            tone="ok"
            height={8}
            label={t("rec.cycles.live_submitted")}
            style={{ marginTop: isMobile ? 14 : 16 }}
          />
          <div style={{ ...T.caption, color: C.dim, marginTop: 8 }}>
            {withNum(t("rec.cycles.live_pct"), "pct", pct)}
          </div>
        </>
      )}
    </Panel>
  );
}

// One funnel number in a borderless tile. Remounting it (see the key at
// the call site) replays the pop on the number.
function ActivityStat({ value, label, color, pop }) {
  const isMobile = useIsMobile();
  return (
    <Tile padding={isMobile ? "12px 12px" : "14px 16px"} style={{ minWidth: 0 }}>
      <div style={{ ...(isMobile ? T.title1 : T.largeTitle), lineHeight: 1.1, color }}>
        <span style={{
          display: "inline-block",
          animation: pop ? `z5-pop ${DURATION.bounce}ms var(--z5-spring-bounce)` : "none",
        }}>
          <Num>{value}</Num>
        </span>
      </div>
      <div style={{ ...T.caption, color: C.dim, marginTop: 4, ...ELLIPSIS }}>{label}</div>
    </Tile>
  );
}

// ── Cycle stage stepper ────────────────────────────────────────────
// Horizontal on desktop, vertical on phones. Five fixed stages: past
// ones are filled ink with a check, the current one is a ringed mark,
// upcoming ones a quiet fill. Connectors are flex children, so the whole
// thing mirrors by itself in RTL.

const CYCLE_STAGES = ["draft", "open", "interviewing", "exam", "closed"];
const STAGE_MARK = 24;

function CycleStageStepper({ currentStatus, help }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const currentIndex = CYCLE_STAGES.indexOf(currentStatus);

  return (
    <ol style={{
      listStyle: "none",
      margin: 0,
      padding: 0,
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      alignItems: "stretch",
    }}>
      {CYCLE_STAGES.map((stage, i) => {
        const props = {
          label: t(`rec.cycle_status.${stage}`),
          state: stageState(i, currentIndex),
          isFirst: i === 0,
          isLast: i === CYCLE_STAGES.length - 1,
        };
        return isMobile
          ? <StageRowVert key={stage} {...props} help={help} />
          : <StageCellHorz key={stage} {...props} />;
      })}
    </ol>
  );
}

function stageState(i, currentIndex) {
  if (currentIndex < 0) return "future";
  if (i < currentIndex)  return "past";
  if (i === currentIndex) return "current";
  return "future";
}

function stageLabelStyle(state) {
  return {
    ...T.footnote,
    fontWeight: state === "current" ? 600 : 400,
    color: state === "current" ? C.bright : state === "past" ? C.text : C.dimmer,
  };
}

function StageMark({ state }) {
  const base = {
    width: STAGE_MARK,
    height: STAGE_MARK,
    flexShrink: 0,
    boxSizing: "border-box",
    borderRadius: R.pill,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: `background-color ${MOTION.fade}, border-color ${MOTION.fade}, box-shadow ${MOTION.fade}`,
  };
  if (state === "past") {
    return (
      <span aria-hidden style={{ ...base, background: C.tint, color: C.onTint }}>
        <Icon name="check" size={14} strokeWidth={2.6} />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span aria-hidden style={{
        ...base,
        border: `2px solid ${C.tint}`,
        boxShadow: `0 0 0 4px ${C.fill}`,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: R.pill, background: C.tint }} />
      </span>
    );
  }
  return <span aria-hidden style={{ ...base, background: C.fill }} />;
}

function StageCellHorz({ label, state, isFirst, isLast }) {
  // The leading half-line is the segment FROM the previous stage; it is
  // "done" once we've left that stage — i.e. whenever this stage is past
  // or current. The trailing half-line leads OUT of this stage; done
  // only after we've moved past it.
  const lineInDone  = !isFirst && (state === "past" || state === "current");
  const lineOutDone = !isLast  && state === "past";
  const line = (hidden, done) => ({
    flex: 1,
    height: 2,
    borderRadius: 1,
    background: hidden ? "transparent" : (done ? C.tint : C.separator),
  });

  return (
    <li
      aria-current={state === "current" ? "step" : undefined}
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div aria-hidden style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", height: 34 }}>
        <div style={line(isFirst, lineInDone)} />
        <StageMark state={state} />
        <div style={line(isLast, lineOutDone)} />
      </div>
      <div style={{
        ...stageLabelStyle(state),
        marginTop: 6,
        maxWidth: "100%",
        textAlign: "center",
        ...ELLIPSIS,
      }}>
        {label}
      </div>
    </li>
  );
}

function StageRowVert({ label, state, isLast, help }) {
  return (
    <li
      aria-current={state === "current" ? "step" : undefined}
      style={{ display: "flex", alignItems: "stretch", gap: 14 }}
    >
      <div aria-hidden style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: STAGE_MARK,
        flexShrink: 0,
      }}>
        <StageMark state={state} />
        {!isLast && (
          <div style={{
            flex: 1,
            width: 2,
            minHeight: 12,
            marginBlock: 6,
            borderRadius: 1,
            background: state === "past" ? C.tint : C.separator,
          }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 3, paddingBottom: isLast ? 0 : 12 }}>
        <div style={stageLabelStyle(state)}>{label}</div>
        {state === "current" && help && (
          <div style={{ ...T.footnote, color: C.dim, marginTop: 2 }}>{help}</div>
        )}
      </div>
    </li>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function statusTone(s) {
  if (s === "open") return "ok";
  if (s === "draft") return "warn";
  if (s === "closed") return "default";
  return "bright"; // interviewing / exam
}
