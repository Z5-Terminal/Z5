// Z5 :: Public Exam — anonymous Hebrew RTL timed cognitive exam.
// Reached at #/recruitment/<token>/exam/<personal-id> via App.jsx.
// 15-minute server-enforced window; answers auto-save on selection;
// auto-submits when the clock runs out.

import { useEffect, useRef, useState } from "react";
import {
  Page, Panel, Tile, List, Btn, Progress, Notice, Num, Stat, Icon,
  Skeleton, ViewTransition, ConfirmDialog,
} from "../ui";
// `T` is the local Hebrew string table below, so the type scale is `TY`.
import { C, FONT, MATERIAL, R, T as TY, Z } from "../theme";
import { DURATION, MOTION } from "../motion";
import { useIsMobile } from "../useIsMobile";
import { useTheme } from "../ThemeContext";
import {
  getExamForToken, startExamAttempt, saveExamAnswer, submitExam,
} from "../data/publicExam";
import { examFigureUrl } from "../data/examQuestions";

const T = {
  brand: "Z5",
  footer: "Z5 · שימוש פנימי בלבד · אין העברה מחוץ לרשת מבצעית",
  loading: "טוען…",
  invalid: "הקישור אינו תקף.",
  exam_not_open: "המבחן אינו פתוח כרגע.",
  candidate_not_found: "לא נמצא מועמד עבור מספר אישי זה.",
  exam_locked: "המבחן עדיין לא נפתח עבורך. פנה למפקדים.",
  already_completed: "כבר השלמת את המבחן.",
  generic_error: "אירעה תקלה. נסה שוב.",
  intro_title: "מבחן פסיכוטכני לצוות צלפים",
  intro_body: "ניתן ומומלץ להשתמש בדף ועט. ברגע שתתחיל — השעון מתחיל לרוץ ולא ניתן לעצור אותו.",
  fact_questions: "{n} שאלות",
  fact_time: "{n} דקות",
  start: "התחל מבחן",
  submit: "סיים והגש",
  submitting: "מגיש…",
  time_left: "זמן שנותר",
  time_up: "הזמן נגמר",
  question: "שאלה",
  points_suffix: "נק׳",
  of: "מתוך",
  answered: "נענו",
  previous: "הקודמת",
  next: "הבאה",
  result_title: "המבחן הוגש.",
  result_score: "ציון",
  result_body: "תשובותיך נשמרו ונבדקו. המשך לחכות לעדכון מהמפקדים.",
  unanswered_title: "ישנן שאלות שלא נענו",
  unanswered_body: "נענו {k} מתוך {n} שאלות. להגיש בכל זאת?",
  unanswered_confirm: "הגש בכל זאת",
  unanswered_cancel: "חזרה למבחן",
};

// Stated length of the exam window (the server enforces the real one).
const EXAM_MINUTES = 15;

// Content column shared by every phase.
const COLUMN = 640;

export default function PublicExam({ token, personalId }) {
  const [phase, setPhase] = useState("loading"); // loading|intro|exam|submitted|error
  const [error, setError] = useState("");
  const [exam, setExam] = useState(null);     // get_exam_for_token payload
  const [attempt, setAttempt] = useState(null); // { attempt_id, expires_at }
  const [answers, setAnswers] = useState({});  // questionId -> optionKey
  const [result, setResult] = useState(null); // { score, total }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await getExamForToken(token, personalId);
      if (cancelled) return;
      if (error) {
        const msg = String(error.message || "");
        if (msg.includes("invalid_token"))        setError(T.invalid);
        else if (msg.includes("exam_not_open"))   setError(T.exam_not_open);
        else if (msg.includes("candidate_not_found")) setError(T.candidate_not_found);
        else if (msg.includes("exam_locked"))     setError(T.exam_locked);
        else setError(T.generic_error);
        setPhase("error");
        return;
      }
      setExam(data);
      setAnswers(data.answers || {});
      const att = data.attempt;
      if (att && att.finished_at) {
        setResult({ score: att.score, total: att.total });
        setPhase("submitted");
      } else if (att) {
        // Resume an in-progress attempt.
        setAttempt({ attempt_id: att.id, expires_at: att.expires_at });
        setPhase("exam");
      } else {
        setPhase("intro");
      }
    })();
    return () => { cancelled = true; };
  }, [token, personalId]);

  async function handleStart() {
    const { data, error } = await startExamAttempt(token, personalId);
    if (error) {
      const msg = String(error.message || "");
      if (msg.includes("exam_already_completed")) {
        setError(T.already_completed);
        setPhase("error");
      } else {
        setError(T.generic_error);
        setPhase("error");
      }
      return;
    }
    setAttempt({ attempt_id: data.attempt_id, expires_at: data.expires_at });
    setPhase("exam");
  }

  // The running exam brings its own shell: the sticky timer bar replaces
  // the brand header.
  if (phase === "exam" && exam && attempt) {
    return (
      <Page>
        <ExamRunner
          token={token}
          personalId={personalId}
          exam={exam}
          attempt={attempt}
          answers={answers}
          setAnswers={setAnswers}
          onSubmitted={(res) => { setResult(res); setPhase("submitted"); }}
          onError={(msg) => { setError(msg); setPhase("error"); }}
        />
      </Page>
    );
  }

  return (
    <Page>
      <ExamShell>
        <ViewTransition viewKey={phase} kind="tab">
          {phase === "loading" && <Loading />}
          {phase === "error" && <ErrorBlock message={error} />}
          {phase === "intro" && exam && (
            <Intro exam={exam} onStart={handleStart} />
          )}
          {phase === "submitted" && result && <Result result={result} />}
        </ViewTransition>
      </ExamShell>
    </Page>
  );
}

// ── Shell kit (kept in step with PublicSurvey.jsx) ─────────────────

// Width + gutters of the content column (also used by the timer bar).
function columnStyle(isMobile) {
  const gutter = isMobile ? 16 : 24;
  return {
    width: "100%",
    maxWidth: COLUMN + gutter * 2,
    marginInline: "auto",
    boxSizing: "border-box",
    paddingInline: `max(${gutter}px, var(--safe-left), var(--safe-right))`,
  };
}

function ExamShell({ bar, children }) {
  const isMobile = useIsMobile();
  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: FONT,
        color: C.text,
        // Page transitions slide a few px sideways; never let that
        // make the document scroll horizontally.
        overflowX: "clip",
      }}
    >
      {bar}
      <div style={{
        ...columnStyle(isMobile),
        flex: 1,
        display: "flex",
        flexDirection: "column",
        paddingTop: bar
          ? (isMobile ? 4 : 12)
          : (isMobile ? "calc(14px + var(--safe-top))" : 36),
        paddingBottom: isMobile ? "calc(18px + var(--safe-bottom))" : 32,
      }}>
        {!bar && <Brand />}
        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
        <FooterLine />
      </div>
    </div>
  );
}

function Brand() {
  const isMobile = useIsMobile();
  // z5-logo.png is black line art — invert it on the night theme.
  const { mode } = useTheme();
  return (
    <header style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingBottom: isMobile ? 4 : 8,
    }}>
      <img
        src={`${import.meta.env.BASE_URL}z5-logo.png`}
        alt=""
        style={{
          height: isMobile ? 30 : 36,
          width: "auto",
          display: "block",
          filter: mode === "dark" ? "invert(0.9)" : "none",
        }}
      />
      <span style={{ ...(isMobile ? TY.headline : TY.title3), color: C.bright }}>{T.brand}</span>
    </header>
  );
}

function FooterLine() {
  return (
    <footer style={{
      paddingTop: 20,
      textAlign: "center",
      ...TY.caption,
      color: C.dimmer,
    }}>
      {T.footer}
    </footer>
  );
}

// Placeholder in the shape of the intro card while the link is checked.
function Loading() {
  return (
    <Panel>
      <div role="status" aria-label={T.loading} aria-busy="true">
        <Skeleton width="64%" height={26} style={{ marginBottom: 12 }} />
        <Skeleton width="36%" height={12} style={{ marginBottom: 22 }} />
        <Skeleton height={13} style={{ marginBottom: 10 }} />
        <Skeleton width="94%" height={13} style={{ marginBottom: 10 }} />
        <Skeleton width="58%" height={13} />
        <Skeleton height={48} style={{ marginTop: 24, borderRadius: R.md }} />
      </div>
    </Panel>
  );
}

function ErrorBlock({ message }) {
  const isMobile = useIsMobile();
  return (
    <Notice
      tone="error"
      style={{ marginTop: isMobile ? 12 : 16, padding: "14px 16px", ...TY.callout }}
    >
      {message}
    </Notice>
  );
}

// Primary / secondary action — the shared button at thumb height.
function BigButton({ style, ...props }) {
  const isMobile = useIsMobile();
  return (
    <Btn
      type="button"
      {...props}
      style={{ minHeight: isMobile ? 50 : 46, ...style }}
    />
  );
}

// "{n} …" template with the number set in tabular figures.
function withNum(template, n) {
  const [before, after = ""] = String(template).split("{n}");
  return <>{before}<Num>{n}</Num>{after}</>;
}

// Quiet icon + text row for the intro card.
function Fact({ icon, children }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      minHeight: 44,
      padding: "8px 0",
      boxSizing: "border-box",
      ...TY.callout,
      color: C.text,
    }}>
      <Icon name={icon} size={18} style={{ color: C.dim }} />
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  );
}

// Finished state: the check materialises together with the message.
function Done({ title, extra, children }) {
  const isMobile = useIsMobile();
  return (
    <Panel>
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: isMobile ? "28px 4px 22px" : "40px 16px 32px",
        animation: `z5-materialize ${DURATION.move}ms var(--z5-spring) both`,
      }}>
        <Icon name="checkCircle" size={64} strokeWidth={1.5} style={{ color: C.ok, marginBottom: 14 }} />
        <h2 style={{ margin: 0, ...TY.title2, color: C.bright }}>{title}</h2>
        {extra}
        <div style={{ ...TY.callout, lineHeight: 1.6, color: C.dim, maxWidth: 420, marginTop: 10 }}>
          {children}
        </div>
      </div>
    </Panel>
  );
}

// ── Intro ──────────────────────────────────────────────────────────

function Intro({ exam, onStart }) {
  const isMobile = useIsMobile();
  // Presentation only: show that the tap registered while the attempt
  // is being opened (the intro unmounts as soon as that resolves).
  const [starting, setStarting] = useState(false);
  async function start() {
    if (starting) return;
    setStarting(true);
    try { await onStart(); } finally { setStarting(false); }
  }
  return (
    <Panel>
      <h1 style={{ margin: 0, ...TY.title1, color: C.bright }}>{T.intro_title}</h1>
      <div style={{ ...TY.footnote, color: C.dim, marginTop: 6 }}>
        {exam.cycle_name}
      </div>
      <div style={{
        whiteSpace: "pre-line",
        ...TY.body,
        fontSize: isMobile ? 16 : 15,
        lineHeight: 1.6,
        color: C.text,
        marginTop: isMobile ? 16 : 18,
      }}>{T.intro_body}</div>
      <Tile padding="2px 14px" style={{ marginTop: isMobile ? 18 : 20 }}>
        <List>
          {exam.candidate_name && <Fact icon="person">{exam.candidate_name}</Fact>}
          <Fact icon="list">
            {withNum(T.fact_questions, String((exam.questions || []).length || 17))}
          </Fact>
          <Fact icon="clock">{withNum(T.fact_time, EXAM_MINUTES)}</Fact>
        </List>
      </Tile>
      <BigButton
        primary
        fullWidth
        onClick={start}
        disabled={starting}
        busy={starting}
        style={{ marginTop: isMobile ? 18 : 20 }}
      >
        {T.start}
      </BigButton>
    </Panel>
  );
}

// ── Runner (the timed exam itself) ─────────────────────────────────

function ExamRunner({ token, personalId, exam, attempt, answers, setAnswers, onSubmitted, onError }) {
  const isMobile = useIsMobile();
  // Server returns questions in the candidate's stored question_order;
  // do NOT sort by ord here — that would defeat the per-candidate shuffle.
  const questions = exam.questions || [];
  const total = questions.length;
  const [pageIdx, setPageIdx] = useState(0);
  const [remaining, setRemaining] = useState(() => secondsLeft(attempt.expires_at));
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);
  // Presentation only: confirm sheet, direction of travel, bar hairline.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [travel, setTravel] = useState("push");
  const [scrolled, setScrolled] = useState(false);

  // Countdown — ticks every second, auto-submits at zero.
  useEffect(() => {
    const id = setInterval(() => {
      const left = secondsLeft(attempt.expires_at);
      setRemaining(left);
      if (left <= 0 && !submittedRef.current) {
        submittedRef.current = true;
        doSubmit();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.expires_at]);

  // The bar's hairline appears only once content is underneath it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function pick(questionId, optionKey) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionKey }));
    // Fire-and-forget save; server rejects after the grace window.
    await saveExamAnswer({ token, personalId, questionId, selectedOption: optionKey });
  }

  async function doSubmit() {
    if (submitting) return;
    setSubmitting(true);
    const { data, error } = await submitExam(token, personalId);
    if (error) {
      setSubmitting(false);
      onError(T.generic_error);
      return;
    }
    onSubmitted({ score: data.score, total: data.total });
  }

  function handleSubmitClick() {
    const unanswered = questions.filter((q) => !answers[q.id]).length;
    // Unanswered questions: ask first (the time-out path never comes here).
    if (unanswered > 0) { setConfirmOpen(true); return; }
    submittedRef.current = true;
    doSubmit();
  }

  function confirmSubmit() {
    setConfirmOpen(false);
    submittedRef.current = true;
    doSubmit();
  }

  function scrollTop() {
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }
  function goPrev() {
    if (pageIdx === 0) return;
    setTravel("pop");
    setPageIdx((i) => i - 1);
    scrollTop();
  }
  function goNext() {
    if (pageIdx >= total - 1) return;
    setTravel("push");
    setPageIdx((i) => i + 1);
    scrollTop();
  }

  const danger = remaining <= 60;
  const current = questions[pageIdx];
  const isFirst = pageIdx === 0;
  const isLast = pageIdx === total - 1;
  const answeredCount = questions.filter((q) => answers[q.id]).length;

  if (!current) return null;

  // Sticky countdown + progress bar: translucent, content scrolls under.
  const bar = (
    <div
      data-material=""
      style={{
        position: "sticky",
        top: 0,
        zIndex: Z.sticky,
        background: C.material,
        ...MATERIAL.bar,
        borderBottom: `1px solid ${scrolled ? C.separator : "transparent"}`,
        transition: `border-color ${MOTION.fade}`,
        paddingTop: "var(--safe-top)",
      }}
    >
      <div style={{
        ...columnStyle(isMobile),
        paddingTop: isMobile ? 10 : 12,
        paddingBottom: isMobile ? 10 : 12,
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...TY.caption, color: C.dim }}>{T.time_left}</div>
            <div
              role="timer"
              style={{
                ...TY.title2,
                color: danger ? C.error : C.bright,
                transition: `color ${MOTION.fade}`,
              }}
            >
              {remaining <= 0 ? T.time_up : <Num>{formatClock(remaining)}</Num>}
            </div>
          </div>
          <div style={{
            ...TY.footnote,
            color: C.dim,
            textAlign: "end",
            paddingBottom: 3,
            minWidth: 0,
          }}>
            <span style={{ color: C.bright, fontWeight: 600 }}>
              {T.question} <Num>{pageIdx + 1}</Num> {T.of} <Num>{total}</Num>
            </span>
            <span aria-hidden style={{ color: C.dimmer, margin: "0 6px" }}>·</span>
            <span style={{ whiteSpace: "nowrap" }}>
              <Num>{answeredCount}</Num> {T.answered}
            </span>
          </div>
        </div>
        <Progress
          value={total > 0 ? (answeredCount / total) * 100 : 0}
          height={4}
          label={T.answered}
          style={{ marginTop: 8 }}
        />
      </div>
    </div>
  );

  return (
    <ExamShell bar={bar}>
      <ViewTransition viewKey={current.id} kind={travel}>
        <ExamQuestion
          key={current.id}
          index={pageIdx + 1}
          question={current}
          selected={answers[current.id]}
          onPick={(optKey) => pick(current.id, optKey)}
        />
      </ViewTransition>

      <div style={{ display: "flex", gap: 10, marginTop: isMobile ? 12 : 16 }}>
        <BigButton onClick={goPrev} disabled={isFirst} icon="chevronBack" iconFlip>
          {T.previous}
        </BigButton>
        {isLast ? (
          <BigButton
            primary
            onClick={handleSubmitClick}
            disabled={submitting}
            busy={submitting}
            style={{ flex: 1 }}
          >
            {submitting ? T.submitting : T.submit}
          </BigButton>
        ) : (
          <BigButton primary onClick={goNext} iconEnd="chevronForward" iconFlip style={{ flex: 1 }}>
            {T.next}
          </BigButton>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={T.unanswered_title}
        // The dialog is portalled outside this screen's dir="rtl" root.
        message={(
          <span dir="rtl">
            {T.unanswered_body
              .replace("{k}", String(answeredCount))
              .replace("{n}", String(total))}
          </span>
        )}
        confirmLabel={T.unanswered_confirm}
        cancelLabel={T.unanswered_cancel}
        danger={false}
        dir="rtl"
        onConfirm={confirmSubmit}
        onCancel={() => setConfirmOpen(false)}
      />
    </ExamShell>
  );
}

// Keyboard focus ring for the shared tappables whose inline `all: unset`
// cancels the global :focus-visible outline (Row, Tile).
function useFocusRing() {
  const [on, setOn] = useState(false);
  return {
    onFocus: (e) => {
      try { setOn(e.currentTarget.matches(":focus-visible")); } catch { setOn(false); }
    },
    onBlur: () => setOn(false),
    ring: on ? { outline: `2px solid ${C.focusRing}`, outlineOffset: 2 } : null,
  };
}

// Radio mark: a ring that fills with ink and gains a dot when chosen.
function RadioMark({ checked }) {
  return (
    <span aria-hidden style={{
      width: 22,
      height: 22,
      flexShrink: 0,
      boxSizing: "border-box",
      borderRadius: R.pill,
      border: `1.5px solid ${checked ? C.tint : C.borderBright}`,
      background: checked ? C.tint : "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      {checked && (
        <span style={{
          width: 8,
          height: 8,
          borderRadius: R.pill,
          background: C.onTint,
          animation: `z5-pop ${DURATION.bounce}ms var(--z5-spring-bounce) both`,
        }} />
      )}
    </span>
  );
}

// One answer option: a tappable tile with a radio mark. Figure options
// stack the mark (with the option's key) above the image.
function OptionTile({ option, image, active, inFigureGrid, figureStyle, onPick }) {
  const focus = useFocusRing();
  return (
    <Tile
      onClick={onPick}
      aria-pressed={active}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      padding={image ? 10 : "12px 14px"}
      style={{
        display: "flex",
        flexDirection: image ? "column" : "row",
        alignItems: image ? "stretch" : inFigureGrid ? "flex-start" : "center",
        gap: image ? 8 : 12,
        width: "100%",
        minHeight: 52,
        fontFamily: FONT,
        color: active ? C.bright : C.text,
        textAlign: "start",
        background: active ? C.selectedBg : C.cardBg,
        border: `1.5px solid ${active ? C.tint : "transparent"}`,
        ...focus.ring,
      }}
    >
      {image ? (
        <>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RadioMark checked={active} />
            <span style={{ ...TY.footnote, fontWeight: 600, color: C.dim }}>
              <Num>{option.key}</Num>
            </span>
          </span>
          <img
            src={image}
            alt=""
            style={{
              maxWidth: "100%",
              maxHeight: 120,
              display: "block",
              marginInline: "auto",
              objectFit: "contain",
              ...figureStyle,
            }}
          />
        </>
      ) : (
        <>
          <RadioMark checked={active} />
          <span style={{
            flex: 1,
            minWidth: 0,
            ...TY.body,
            fontSize: 16,
            lineHeight: 1.35,
            overflowWrap: "anywhere",
          }}>{option.text || option.key}</span>
        </>
      )}
    </Tile>
  );
}

function ExamQuestion({ index, question, selected, onPick }) {
  const promptImg = examFigureUrl(question.prompt_image_url);
  const options = Array.isArray(question.options) ? question.options : [];
  const hasFigures = options.some((o) => o.image_url);
  const promptId = `exam-q-${question.id}`;
  // Figures are line art: a paper backdrop keeps transparent ones legible
  // on the night theme and is invisible behind opaque ones.
  const figure = { background: C.posterPaper, borderRadius: R.sm };

  return (
    <Panel>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        ...TY.footnote,
        color: C.dim,
        marginBottom: 8,
      }}>
        <span id={promptId}>{T.question} <Num>{index}</Num></span>
        <span><Num>{question.points ?? 1}</Num> {T.points_suffix}</span>
      </div>

      {question.prompt_text && (
        <div style={{
          // Short prompts read as a title; passages step down a size.
          ...(String(question.prompt_text).length > 90
            ? { ...TY.headline, fontSize: 17, lineHeight: 1.5 }
            : TY.title3),
          color: C.bright,
          overflowWrap: "anywhere",
          marginBottom: promptImg ? 14 : 16,
        }}>{question.prompt_text}</div>
      )}
      {promptImg && (
        <img
          src={promptImg}
          alt=""
          style={{
            maxWidth: "100%",
            display: "block",
            margin: "0 auto 16px",
            ...figure,
            borderRadius: R.md,
          }}
        />
      )}

      <div
        role="group"
        aria-labelledby={promptId}
        style={{
          display: "grid",
          gridTemplateColumns: hasFigures
            ? "minmax(0, 1fr) minmax(0, 1fr)"
            : "minmax(0, 1fr)",
          gap: 8,
        }}
      >
        {options.map((opt) => {
          const active = selected === opt.key;
          const optImg = examFigureUrl(opt.image_url);
          return (
            <OptionTile
              key={opt.key}
              option={opt}
              image={optImg}
              active={active}
              inFigureGrid={hasFigures}
              figureStyle={figure}
              onPick={() => onPick(opt.key)}
            />
          );
        })}
      </div>
    </Panel>
  );
}

// ── Result ─────────────────────────────────────────────────────────

function Result({ result }) {
  return (
    <Done
      title={T.result_title}
      extra={(
        <Tile padding="16px 28px" style={{ marginTop: 18, marginBottom: 6, minWidth: 180 }}>
          <Stat
            size="lg"
            align="center"
            value={`${result.score} / ${result.total}`}
            label={T.result_score}
          />
        </Tile>
      )}
    >
      {T.result_body}
    </Done>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function secondsLeft(expiresAt) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / 1000));
}

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
