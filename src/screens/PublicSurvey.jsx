// Z5 :: Public Survey — anonymous Hebrew RTL form for soldier candidates.
// Reached at #/recruitment/<token>/survey via App.jsx hash routing.
// One page per section (identity → self_assessment → background → physical),
// answers saved on page advance, submission marks candidate as survey_done.

import { useEffect, useState } from "react";
import { Page } from "../ui";
import { C, FONT, FONT_MONO } from "../theme";
import { useIsMobile } from "../useIsMobile";
import {
  getSurveyForToken, startCandidate, saveAnswer, submitSurvey,
} from "../data/publicSurvey";

// Hebrew strings for the public survey. We don't go through i18n here —
// candidate-facing screens are Hebrew-only per the project decision.
const T = {
  loading: "טוען…",
  invalid: "הקישור אינו תקף או שמחזור הגיוס נסגר.",
  not_open: "מחזור הגיוס אינו פתוח כרגע. נסה שוב מאוחר יותר.",
  generic_error: "אירעה תקלה. נסה שוב.",
  intro_title: "שאלון למועמד לקורס צליפה",
  intro_body: "תפקיד הצלף משלב חדות קוגניטיבית, חתירה למצוינות וקור רוח בתנאי קיצון. השאלון הוא חובה ועל כל לוחם למלא אותו במלוא הכנות והרצינות.\n\nהשאלון אישי — אין לחלוק מידע ותשובות. אי עמידה בדרישות הללו עלולה להוביל לפסילה ממועמדות לצוות צלפים.",
  intro_required_note: "כוכבית (*) מציינת שאלה חובה",
  start: "התחל שאלון",
  next: "הלאה",
  prev: "חזרה",
  submit: "שלח שאלון",
  saving: "שומר…",
  required_missing: "יש לענות על כל שאלות החובה לפני המעבר.",
  invalid_personal_id: "מספר אישי הוא שדה חובה.",
  invalid_team: "יש לבחור צוות.",
  invalid_name: "שם מלא הוא שדה חובה.",
  thanks_title: "השאלון נשלח. תודה.",
  thanks_body: "תשובותיך נשמרו. המשך לחיכות לעדכון מהמפקדים.",
  page: "שלב",
  of: "מתוך",
  section_identity: "פרטים אישיים",
  section_self_assessment: "מוטיבציה והערכה עצמית",
  section_background: "רקע אקדמי וצבאי",
  section_physical: "כושר גופני ושאיפות",
  likert_low: "במידה מועטה מאוד",
  likert_high: "במידה רבה מאוד",
  pick_one: "בחר אפשרות אחת",
  choose: "בחר…",
  recommend_ph: "שם 1, שם 2",
  dont_recommend_ph: "שם 1, שם 2, שם 3",
};

const SECTION_ORDER = ["identity", "self_assessment", "background", "physical"];

// ── Root ───────────────────────────────────────────────────────────

export default function PublicSurvey({ token }) {
  const [phase, setPhase] = useState("loading"); // loading | intro | form | submitted | error
  const [error, setError] = useState("");
  const [survey, setSurvey] = useState(null); // { cycle_id, cycle_name, status, questions }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await getSurveyForToken(token);
      if (cancelled) return;
      if (error) {
        const msg = String(error.message || "");
        if (msg.includes("invalid_token")) setError(T.invalid);
        else if (msg.includes("cycle_not_open")) setError(T.not_open);
        else setError(T.generic_error);
        setPhase("error");
        return;
      }
      setSurvey(data);
      setPhase("intro");
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <Page>
      <SurveyShell>
        {phase === "loading" && <Centered>{T.loading}</Centered>}
        {phase === "error" && <ErrorBlock message={error} />}
        {phase === "intro" && survey && (
          <Intro survey={survey} onStart={() => setPhase("form")} />
        )}
        {phase === "form" && survey && (
          <SurveyForm
            token={token}
            survey={survey}
            onSubmitted={() => setPhase("submitted")}
          />
        )}
        {phase === "submitted" && <Thanks />}
      </SurveyShell>
    </Page>
  );
}

// ── Shell wrapper ──────────────────────────────────────────────────

function SurveyShell({ children }) {
  const isMobile = useIsMobile();
  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        padding: isMobile
          ? "calc(20px + var(--safe-top)) 16px calc(20px + var(--safe-bottom))"
          : "40px 24px",
        fontFamily: FONT,
        color: C.text,
      }}
    >
      <div style={{
        width: "100%",
        maxWidth: 720,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        flex: 1,
      }}>
        <Brand />
        <div style={{ flex: 1 }}>{children}</div>
        <Footer />
      </div>
    </div>
  );
}

function Brand() {
  const isMobile = useIsMobile();
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 10,
      paddingBottom: isMobile ? 16 : 22,
      marginBottom: isMobile ? 18 : 28,
      borderBottom: `1px solid ${C.border}`,
    }}>
      <img
        src={`${import.meta.env.BASE_URL}z5-logo.png`}
        alt="Z5"
        style={{
          width: "100%",
          maxWidth: isMobile ? 120 : 180,
          maxHeight: isMobile ? 80 : 120,
          objectFit: "contain",
        }}
      />
      <div style={{
        color: C.bright,
        fontSize: isMobile ? 16 : 22,
        fontWeight: 800,
        letterSpacing: "4px",
      }}>
        Z5 TERMINAL
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div style={{
      paddingTop: 20,
      textAlign: "center",
      fontFamily: FONT_MONO,
      fontSize: 10,
      color: C.dim,
      letterSpacing: "1.4px",
      textTransform: "uppercase",
    }}>
      INTERNAL USE ONLY · NO TRANSMISSION OUTSIDE OPERATIONAL NET
    </div>
  );
}

function Centered({ children }) {
  return (
    <div style={{
      padding: "40px 0",
      textAlign: "center",
      color: C.dim,
      fontSize: 14,
    }}>{children}</div>
  );
}

function ErrorBlock({ message }) {
  return (
    <div style={{
      padding: "20px 18px",
      background: C.errBg,
      border: `1px solid ${C.errBorder}`,
      borderRadius: 4,
      color: C.error,
      fontSize: 14,
      lineHeight: 1.6,
      textAlign: "center",
      marginTop: 40,
    }}>{message}</div>
  );
}

// ── Intro / first-screen welcome ───────────────────────────────────

function Intro({ survey, onStart }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ padding: isMobile ? "8px 4px" : "20px 4px" }}>
      <h1 style={{
        margin: 0,
        marginBottom: 18,
        color: C.bright,
        fontSize: isMobile ? 20 : 26,
        fontWeight: 700,
        letterSpacing: "1px",
      }}>{T.intro_title}</h1>
      <div style={{ color: C.dim, fontSize: 13, marginBottom: 20 }}>
        {survey.cycle_name}
      </div>
      <div style={{
        whiteSpace: "pre-line",
        fontSize: 15,
        lineHeight: 1.8,
        color: C.text,
        marginBottom: 30,
      }}>
        {T.intro_body}
      </div>
      <div style={{
        fontSize: 12,
        color: C.dim,
        marginBottom: 30,
        fontStyle: "italic",
      }}>
        {T.intro_required_note}
      </div>
      <BigButton onClick={onStart}>{T.start}</BigButton>
    </div>
  );
}

// ── Form (the multi-page survey itself) ────────────────────────────

function SurveyForm({ token, survey, onSubmitted }) {
  const questions = survey.questions || [];
  // Group questions by section, in SECTION_ORDER. Only sections that
  // actually have questions become pages.
  const sections = SECTION_ORDER
    .map((key) => ({
      key,
      title: T[`section_${key}`] || key,
      questions: questions.filter((q) => q.section === key)
        .sort((a, b) => a.ord - b.ord),
    }))
    .filter((s) => s.questions.length > 0);
  const totalPages = sections.length;

  const [pageIdx, setPageIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // questionId -> { text, value }
  const [candidateId, setCandidateId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function setAnswer(qid, patch) {
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));
  }

  // Validate every required question on the given section. Returns true if OK.
  function validateSection(section) {
    for (const q of section.questions) {
      if (!q.required) continue;
      const a = answers[q.id];
      const filled = a && (
        (a.text !== undefined && a.text !== null && String(a.text).trim() !== "") ||
        (a.value !== undefined && a.value !== null)
      );
      if (!filled) return false;
    }
    return true;
  }

  // Identity-page entrypoint: ensure name, team and personal_id are present
  // and call start_candidate_session before saving any answers.
  async function ensureCandidate(section) {
    if (candidateId) return candidateId;
    if (section.key !== "identity") {
      setErr(T.generic_error); // shouldn't happen
      return null;
    }
    const nameQ  = section.questions.find((q) => q.ord === 1);
    const teamQ  = section.questions.find((q) => q.ord === 2);
    const idQ    = section.questions.find((q) => q.ord === 3);
    const fullName = nameQ ? answers[nameQ.id]?.text?.trim() : "";
    const teamStr  = teamQ ? answers[teamQ.id]?.text : "";
    const team = teamStr ? parseInt(teamStr, 10) : null;
    const personalId = idQ ? answers[idQ.id]?.text?.trim() : "";

    if (!fullName)   { setErr(T.invalid_name); return null; }
    if (!team)       { setErr(T.invalid_team); return null; }
    if (!personalId) { setErr(T.invalid_personal_id); return null; }

    const { data, error } = await startCandidate({
      token, fullName, team, personalId,
    });
    if (error) {
      setErr(error.message || T.generic_error);
      return null;
    }
    setCandidateId(data);
    return data;
  }

  // Save every answered question on the current section to the DB.
  async function saveSection(section, cidOverride) {
    const cid = cidOverride || candidateId;
    if (!cid) return false;
    const tasks = section.questions
      .map((q) => {
        const a = answers[q.id];
        if (!a) return null;
        return saveAnswer({
          token,
          candidateId: cid,
          questionId: q.id,
          answerText: a.text ?? null,
          answerValue: a.value ?? null,
        });
      })
      .filter(Boolean);
    const results = await Promise.all(tasks);
    const firstError = results.find((r) => r?.error);
    if (firstError) {
      setErr(firstError.error.message || T.generic_error);
      return false;
    }
    return true;
  }

  async function handleNext() {
    setErr("");
    const section = sections[pageIdx];
    if (!validateSection(section)) {
      setErr(T.required_missing);
      return;
    }
    setBusy(true);
    try {
      let cid = candidateId;
      if (!cid && section.key === "identity") {
        cid = await ensureCandidate(section);
        if (!cid) { setBusy(false); return; }
      }
      const ok = await saveSection(section, cid);
      if (!ok) { setBusy(false); return; }
      if (pageIdx + 1 < totalPages) {
        setPageIdx(pageIdx + 1);
        // scroll to top so the next page starts cleanly
        if (typeof window !== "undefined") window.scrollTo({ top: 0 });
      } else {
        await submitSurvey({ token, candidateId: cid });
        onSubmitted();
      }
    } finally {
      setBusy(false);
    }
  }

  function handlePrev() {
    setErr("");
    if (pageIdx > 0) {
      setPageIdx(pageIdx - 1);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    }
  }

  const section = sections[pageIdx];
  if (!section) return null;
  const isLast = pageIdx + 1 === totalPages;

  return (
    <div style={{ padding: "8px 4px" }}>
      <ProgressBar pageIdx={pageIdx} totalPages={totalPages} />
      <h2 style={{
        margin: "12px 0 24px",
        color: C.bright,
        fontSize: 19,
        fontWeight: 700,
        letterSpacing: "0.5px",
      }}>{section.title}</h2>

      {section.questions.map((q) => (
        <QuestionField
          key={q.id}
          question={q}
          answer={answers[q.id]}
          onChange={(patch) => setAnswer(q.id, patch)}
        />
      ))}

      {err && (
        <div style={{
          padding: "10px 14px",
          background: C.errBg,
          border: `1px solid ${C.errBorder}`,
          borderRadius: 3,
          color: C.error,
          fontSize: 13,
          marginTop: 16,
          marginBottom: 8,
        }}>{err}</div>
      )}

      <div style={{
        display: "flex",
        gap: 10,
        marginTop: 26,
        flexDirection: "row-reverse",
      }}>
        <BigButton onClick={handleNext} disabled={busy} primary>
          {busy ? T.saving : isLast ? T.submit : T.next}
        </BigButton>
        {pageIdx > 0 && (
          <BigButton onClick={handlePrev} disabled={busy}>
            {T.prev}
          </BigButton>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ pageIdx, totalPages }) {
  return (
    <div>
      <div style={{
        fontFamily: FONT_MONO,
        fontSize: 11,
        color: C.dim,
        letterSpacing: "1.2px",
        textTransform: "uppercase",
        marginBottom: 6,
      }}>
        {T.page} {pageIdx + 1} {T.of} {totalPages}
      </div>
      <div style={{
        height: 3,
        background: C.progressTrack,
        borderRadius: 0,
        overflow: "hidden",
      }}>
        <div style={{
          width: `${((pageIdx + 1) / totalPages) * 100}%`,
          height: "100%",
          background: C.bright,
          transition: "width 240ms ease-out",
        }} />
      </div>
    </div>
  );
}

// ── Question rendering ─────────────────────────────────────────────

function QuestionField({ question, answer, onChange }) {
  const text = (question.question_text || "").trim();
  const required = question.required;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontSize: 14,
        fontWeight: 600,
        color: C.text,
        marginBottom: 10,
        lineHeight: 1.5,
      }}>
        {text}
        {required && <span style={{ color: C.error, marginInlineStart: 4 }}>*</span>}
      </div>
      <QuestionInput
        question={question}
        answer={answer || {}}
        onChange={onChange}
      />
    </div>
  );
}

function QuestionInput({ question, answer, onChange }) {
  const t = question.question_type;
  if (t === "textarea") return <TextareaInput answer={answer} onChange={onChange} />;
  if (t === "number")   return <NumberInput   answer={answer} onChange={onChange} />;
  if (t === "radio" || t === "team_radio") return <RadioInput question={question} answer={answer} onChange={onChange} />;
  if (t === "dropdown") return <DropdownInput question={question} answer={answer} onChange={onChange} />;
  if (t === "likert_5") return <LikertInput   answer={answer} onChange={onChange} />;
  if (t === "recommend")      return <TextInput placeholder={T.recommend_ph}       answer={answer} onChange={onChange} />;
  if (t === "dont_recommend") return <TextInput placeholder={T.dont_recommend_ph}  answer={answer} onChange={onChange} />;
  // default 'text'
  return <TextInput answer={answer} onChange={onChange} />;
}

const inputBase = {
  background: C.inputBg,
  color: C.text,
  border: `1px solid ${C.border}`,
  padding: "12px 14px",
  fontFamily: FONT,
  fontSize: 16,
  width: "100%",
  outline: "none",
  boxSizing: "border-box",
  borderRadius: 2,
  minHeight: 46,
  WebkitAppearance: "none",
  appearance: "none",
  direction: "rtl",
};

function TextInput({ answer, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={answer.text || ""}
      onChange={(e) => onChange({ text: e.target.value })}
      placeholder={placeholder}
      style={inputBase}
    />
  );
}

function NumberInput({ answer, onChange }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={answer.text || ""}
      onChange={(e) => {
        const n = e.target.value === "" ? null : parseInt(e.target.value, 10);
        onChange({ text: e.target.value, value: Number.isNaN(n) ? null : n });
      }}
      style={inputBase}
    />
  );
}

function TextareaInput({ answer, onChange }) {
  return (
    <textarea
      value={answer.text || ""}
      onChange={(e) => onChange({ text: e.target.value })}
      style={{ ...inputBase, height: 120, resize: "vertical" }}
    />
  );
}

function DropdownInput({ question, answer, onChange }) {
  const opts = Array.isArray(question.options) ? question.options : [];
  return (
    <select
      value={answer.text || ""}
      onChange={(e) => onChange({ text: e.target.value })}
      style={{ ...inputBase, fontSize: 16 }}
    >
      <option value="">{T.choose}</option>
      {opts.map((o, i) => (
        <option key={i} value={String(o)}>{String(o)}</option>
      ))}
    </select>
  );
}

function RadioInput({ question, answer, onChange }) {
  const opts = Array.isArray(question.options) ? question.options : [];
  const selected = answer.text || "";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {opts.map((o, i) => {
        const val = String(o);
        const active = val === selected;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange({ text: val })}
            style={{
              ...inputBase,
              padding: "12px 14px",
              minHeight: 46,
              textAlign: "start",
              background: active ? C.selectedBg : C.inputBg,
              borderColor: active ? C.bright : C.border,
              color: C.text,
              cursor: "pointer",
              fontWeight: active ? 700 : 400,
              fontSize: 15,
            }}
          >
            <span style={{
              display: "inline-block",
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: `2px solid ${active ? C.bright : C.borderBright}`,
              background: active ? C.bright : "transparent",
              marginInlineEnd: 10,
              verticalAlign: "middle",
            }} />
            {val}
          </button>
        );
      })}
    </div>
  );
}

function LikertInput({ answer, onChange }) {
  const isMobile = useIsMobile();
  const selected = answer.value || null;
  return (
    <div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 6,
        marginBottom: 8,
      }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = selected === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ value: n })}
              style={{
                flex: 1,
                minHeight: isMobile ? 52 : 48,
                background: active ? C.bright : C.inputBg,
                color: active ? C.btnActiveColor : C.text,
                border: `1px solid ${active ? C.bright : C.border}`,
                borderRadius: 2,
                fontFamily: FONT_MONO,
                fontSize: 18,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >{n}</button>
          );
        })}
      </div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 11,
        color: C.dim,
        letterSpacing: "0.3px",
      }}>
        <span>{T.likert_low}</span>
        <span>{T.likert_high}</span>
      </div>
    </div>
  );
}

// ── Big button used for nav + submit ───────────────────────────────

function BigButton({ children, onClick, disabled, primary }) {
  const isMobile = useIsMobile();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: primary ? 1 : "0 0 auto",
        background: primary ? C.bright : "transparent",
        color: primary ? C.btnActiveColor : C.text,
        border: `1px solid ${primary ? C.bright : C.border}`,
        padding: isMobile ? "14px 20px" : "12px 22px",
        fontFamily: FONT,
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: "0.4px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        borderRadius: 2,
        minHeight: isMobile ? 50 : 46,
        transition: "background 160ms ease-out",
      }}
    >
      {children}
    </button>
  );
}

// ── Submitted ──────────────────────────────────────────────────────

function Thanks() {
  return (
    <div style={{
      padding: "60px 20px",
      textAlign: "center",
    }}>
      <div style={{
        fontSize: 56,
        color: C.ok,
        marginBottom: 14,
        lineHeight: 1,
      }}>✓</div>
      <h2 style={{
        margin: "0 0 12px",
        color: C.bright,
        fontSize: 22,
        fontWeight: 700,
      }}>{T.thanks_title}</h2>
      <div style={{
        color: C.dim,
        fontSize: 14,
        lineHeight: 1.7,
        maxWidth: 420,
        margin: "0 auto",
      }}>{T.thanks_body}</div>
    </div>
  );
}
