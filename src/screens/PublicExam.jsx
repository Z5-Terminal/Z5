// Z5 :: Public Exam — anonymous Hebrew RTL timed cognitive exam.
// Reached at #/recruitment/<token>/exam/<personal-id> via App.jsx.
// 15-minute server-enforced window; answers auto-save on selection;
// auto-submits when the clock runs out.

import { useEffect, useRef, useState } from "react";
import { Page } from "../ui";
import { C, FONT, FONT_MONO } from "../theme";
import { useIsMobile } from "../useIsMobile";
import {
  getExamForToken, startExamAttempt, saveExamAnswer, submitExam,
} from "../data/publicExam";
import { examFigureUrl } from "../data/examQuestions";

const T = {
  loading: "טוען…",
  invalid: "הקישור אינו תקף.",
  exam_not_open: "המבחן אינו פתוח כרגע.",
  candidate_not_found: "לא נמצא מועמד עבור מספר אישי זה.",
  exam_locked: "המבחן עדיין לא נפתח עבורך. פנה למפקדים.",
  already_completed: "כבר השלמת את המבחן.",
  generic_error: "אירעה תקלה. נסה שוב.",
  intro_title: "מבחן פסיכוטכני לצוות צלפים",
  intro_body: "במבחן יש 16 שאלות. סך הזמן למבחן הוא 15 דקות.\n\nניתן ומומלץ להשתמש בדף ועט. ברגע שתתחיל — השעון מתחיל לרוץ ולא ניתן לעצור אותו.",
  start: "התחל מבחן",
  submit: "סיים והגש",
  submitting: "מגיש…",
  time_left: "זמן שנותר",
  time_up: "הזמן נגמר",
  question: "שאלה",
  of: "מתוך",
  answered: "נענו",
  previous: "‹ הקודמת",
  next: "הבאה ›",
  result_title: "המבחן הוגש.",
  result_score: "ציון",
  result_body: "תשובותיך נשמרו ונבדקו. המשך לחכות לעדכון מהמפקדים.",
  unanswered_warn: "ישנן שאלות שלא נענו. להגיש בכל זאת?",
};

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

  return (
    <Page>
      <ExamShell>
        {phase === "loading" && <Centered>{T.loading}</Centered>}
        {phase === "error" && <ErrorBlock message={error} />}
        {phase === "intro" && exam && (
          <Intro exam={exam} onStart={handleStart} />
        )}
        {phase === "exam" && exam && attempt && (
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
        )}
        {phase === "submitted" && result && <Result result={result} />}
      </ExamShell>
    </Page>
  );
}

// ── Shell ──────────────────────────────────────────────────────────

function ExamShell({ children }) {
  const isMobile = useIsMobile();
  return (
    <div dir="rtl" style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
      padding: isMobile
        ? "calc(20px + var(--safe-top)) 16px calc(20px + var(--safe-bottom))"
        : "40px 24px",
      fontFamily: FONT,
      color: C.text,
    }}>
      <div style={{
        width: "100%", maxWidth: 720, margin: "0 auto",
        display: "flex", flexDirection: "column", flex: 1,
      }}>
        {children}
      </div>
    </div>
  );
}

function Centered({ children }) {
  return <div style={{ padding: "60px 0", textAlign: "center", color: C.dim }}>{children}</div>;
}

function ErrorBlock({ message }) {
  return (
    <div style={{
      marginTop: 60, padding: "20px 18px", textAlign: "center",
      background: C.errBg, border: `1px solid ${C.errBorder}`,
      borderRadius: 4, color: C.error, fontSize: 14, lineHeight: 1.6,
    }}>{message}</div>
  );
}

// ── Intro ──────────────────────────────────────────────────────────

function Intro({ exam, onStart }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ padding: isMobile ? "16px 4px" : "32px 4px" }}>
      <h1 style={{
        margin: "0 0 8px", color: C.bright,
        fontSize: isMobile ? 20 : 26, fontWeight: 700, letterSpacing: "0.5px",
      }}>{T.intro_title}</h1>
      <div style={{ color: C.dim, fontSize: 13, marginBottom: 24 }}>
        {exam.cycle_name}{exam.candidate_name ? ` · ${exam.candidate_name}` : ""}
      </div>
      <div style={{
        whiteSpace: "pre-line", fontSize: 15, lineHeight: 1.8,
        color: C.text, marginBottom: 32,
      }}>{T.intro_body}</div>
      <BigButton primary onClick={onStart}>{T.start}</BigButton>
    </div>
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
    if (unanswered > 0 && !window.confirm(T.unanswered_warn)) return;
    submittedRef.current = true;
    doSubmit();
  }

  function scrollTop() {
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }
  function goPrev() {
    if (pageIdx === 0) return;
    setPageIdx((i) => i - 1);
    scrollTop();
  }
  function goNext() {
    if (pageIdx >= total - 1) return;
    setPageIdx((i) => i + 1);
    scrollTop();
  }

  const danger = remaining <= 60;
  const current = questions[pageIdx];
  const isFirst = pageIdx === 0;
  const isLast = pageIdx === total - 1;
  const answeredCount = questions.filter((q) => answers[q.id]).length;

  if (!current) return null;

  return (
    <div>
      {/* Sticky countdown + progress header */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: C.bg,
        borderBottom: `1px solid ${C.border}`,
        padding: "12px 0",
        marginBottom: 18,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{
            fontFamily: FONT_MONO, fontSize: 11, color: C.dim,
            letterSpacing: "1px", textTransform: "uppercase",
          }}>{T.time_left}</div>
          <div style={{
            fontFamily: FONT_MONO,
            fontSize: isMobile ? 22 : 26,
            fontWeight: 700,
            color: danger ? C.error : C.bright,
            letterSpacing: "1px",
            lineHeight: 1,
          }}>{remaining <= 0 ? T.time_up : formatClock(remaining)}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "end" }}>
          <div style={{
            fontFamily: FONT_MONO, fontSize: 11, color: C.dim,
            letterSpacing: "1px", textTransform: "uppercase",
          }}>{T.question}</div>
          <div style={{
            fontFamily: FONT_MONO,
            fontSize: isMobile ? 16 : 18,
            fontWeight: 700,
            color: C.bright,
            letterSpacing: "0.5px",
            lineHeight: 1,
          }}>
            {pageIdx + 1} {T.of} {total}
            <span style={{
              color: C.dim, fontSize: isMobile ? 11 : 12, fontWeight: 400,
              marginInlineStart: 8,
            }}>· {answeredCount} {T.answered}</span>
          </div>
        </div>
      </div>

      <ExamQuestion
        key={current.id}
        index={pageIdx + 1}
        question={current}
        selected={answers[current.id]}
        onPick={(optKey) => pick(current.id, optKey)}
      />

      <div style={{
        marginTop: 22,
        display: "flex",
        gap: 10,
      }}>
        <BigButton onClick={goPrev} disabled={isFirst}>
          {T.previous}
        </BigButton>
        {isLast ? (
          <BigButton primary onClick={handleSubmitClick} disabled={submitting}>
            {submitting ? T.submitting : T.submit}
          </BigButton>
        ) : (
          <BigButton primary onClick={goNext}>
            {T.next}
          </BigButton>
        )}
      </div>
    </div>
  );
}

function ExamQuestion({ index, question, selected, onPick }) {
  const isMobile = useIsMobile();
  const promptImg = examFigureUrl(question.prompt_image_url);
  const options = Array.isArray(question.options) ? question.options : [];

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 4,
      background: C.cardBg,
      padding: isMobile ? "14px" : "18px 20px",
      marginBottom: 14,
    }}>
      <div style={{
        fontFamily: FONT_MONO, fontSize: 12, color: C.dim,
        letterSpacing: "1px", marginBottom: 8,
      }}>{T.question} {index}</div>

      {question.prompt_text && (
        <div style={{
          fontSize: 15, lineHeight: 1.7, color: C.text, marginBottom: promptImg ? 12 : 14,
        }}>{question.prompt_text}</div>
      )}
      {promptImg && (
        <img
          src={promptImg}
          alt=""
          style={{
            maxWidth: "100%", display: "block", margin: "0 auto 14px",
            border: `1px solid ${C.border}`, borderRadius: 3,
          }}
        />
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: options.some((o) => o.image_url)
          ? (isMobile ? "1fr 1fr" : "1fr 1fr")
          : "1fr",
        gap: 8,
      }}>
        {options.map((opt) => {
          const active = selected === opt.key;
          const optImg = examFigureUrl(opt.image_url);
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onPick(opt.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: optImg ? "8px" : "12px 14px",
                background: active ? C.selectedBg : C.inputBg,
                border: `1px solid ${active ? C.bright : C.border}`,
                borderRadius: 2,
                cursor: "pointer",
                fontFamily: FONT,
                color: C.text,
                textAlign: "start",
                minHeight: 46,
              }}
            >
              <span style={{
                flexShrink: 0,
                width: 16, height: 16, borderRadius: "50%",
                border: `2px solid ${active ? C.bright : C.borderBright}`,
                background: active ? C.bright : "transparent",
              }} />
              {optImg ? (
                <img src={optImg} alt={opt.key}
                  style={{ maxWidth: "100%", maxHeight: 120, display: "block" }} />
              ) : (
                <span style={{ fontSize: 15 }}>{opt.text || opt.key}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Result ─────────────────────────────────────────────────────────

function Result({ result }) {
  return (
    <div style={{ padding: "60px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 56, color: C.ok, marginBottom: 14, lineHeight: 1 }}>✓</div>
      <h2 style={{ margin: "0 0 18px", color: C.bright, fontSize: 22, fontWeight: 700 }}>
        {T.result_title}
      </h2>
      <div style={{
        fontFamily: FONT_MONO, fontSize: 40, fontWeight: 700,
        color: C.bright, marginBottom: 6,
      }}>{result.score} / {result.total}</div>
      <div style={{
        fontSize: 11, color: C.dim, letterSpacing: "1px",
        textTransform: "uppercase", marginBottom: 20,
      }}>{T.result_score}</div>
      <div style={{
        color: C.dim, fontSize: 14, lineHeight: 1.7,
        maxWidth: 420, margin: "0 auto",
      }}>{T.result_body}</div>
    </div>
  );
}

// ── Shared button ──────────────────────────────────────────────────

function BigButton({ children, onClick, disabled, primary }) {
  const isMobile = useIsMobile();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        background: primary ? C.bright : "transparent",
        color: primary ? C.btnActiveColor : C.text,
        border: `1px solid ${primary ? C.bright : C.border}`,
        padding: isMobile ? "14px 20px" : "13px 22px",
        fontFamily: FONT,
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: "0.4px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        borderRadius: 2,
        minHeight: isMobile ? 50 : 46,
      }}
    >{children}</button>
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
