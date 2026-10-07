// Z5 :: Public Survey — anonymous Hebrew RTL form for soldier candidates.
// Reached at #/recruitment/<token>/survey via App.jsx hash routing.
// One page per section (identity, self_assessment, background, physical),
// answers saved on page advance, submission marks candidate as survey_done.

import { useEffect, useState } from "react";
import {
  Page, Panel, Tile, List, Row, Divider, Btn, Input, Textarea, Select,
  Progress, Notice, Num, Icon, Skeleton, ViewTransition,
} from "../ui";
// `T` is the local Hebrew string table below, so the type scale is `TY`.
import { C, S, FONT, NUM, R, T as TY } from "../theme";
import { DURATION, MOTION } from "../motion";
import { useIsMobile } from "../useIsMobile";
import { useTheme } from "../ThemeContext";
import {
  getSurveyForToken, startCandidate, saveAnswer, submitSurvey,
} from "../data/publicSurvey";

// Hebrew strings for the public survey. We don't go through i18n here —
// candidate-facing screens are Hebrew-only per the project decision.
const T = {
  brand: "Z5",
  footer: "Z5 · שימוש פנימי בלבד · אין העברה מחוץ לרשת מבצעית",
  loading: "טוען…",
  invalid: "הקישור אינו תקף או שמחזור הגיוס נסגר.",
  not_open: "מחזור הגיוס אינו פתוח כרגע. נסה שוב מאוחר יותר.",
  generic_error: "אירעה תקלה. נסה שוב.",
  intro_title: "שאלון למועמד לקורס צליפה",
  intro_body: "תפקיד הצלף משלב חדות קוגניטיבית, חתירה למצוינות וקור רוח בתנאי קיצון. השאלון הוא חובה ועל כל לוחם למלא אותו במלוא הכנות והרצינות.\n\nהשאלון אישי — אין לחלוק מידע ותשובות. אי עמידה בדרישות הללו עלולה להוביל לפסילה ממועמדות לצוות צלפים.",
  intro_required_note: "כוכבית (*) מציינת שאלה חובה",
  intro_steps: "{n} שלבים",
  intro_steps_one: "שלב אחד",
  start: "התחל שאלון",
  next: "הלאה",
  prev: "חזרה",
  submit: "שלח שאלון",
  saving: "שומר…",
  required_missing: "יש לענות על כל שאלות החובה לפני המעבר.",
  invalid_personal_id: "מספר אישי הוא שדה חובה.",
  invalid_team: "יש לבחור צוות.",
  invalid_name: "יש למלא שם פרטי ושם משפחה.",
  thanks_title: "השאלון נשלח. תודה.",
  thanks_body: "תשובותיך נשמרו. המשך לחכות לעדכון מהמפקדים.",
  page: "שלב",
  of: "מתוך",
  progress: "התקדמות בשאלון",
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
  hebrew_only: "עברית בלבד",
  other_detail_ph: "פרט כאן…",
  group_recommend: "המלצות חיילים",
  group_dont: "חיילים שאינך ממליץ עליהם",
  group_names_note: "כל שם בשדה נפרד — עברית בלבד",
  name_n: "שם",
};

// Hebrew-only free text: Latin letters are stripped as the user types.
function heOnly(v) {
  return String(v || "").replace(/[A-Za-z]/g, "");
}

const SECTION_ORDER = ["identity", "self_assessment", "background", "physical"];

// Group questions by section, in SECTION_ORDER. Only sections that
// actually have questions become pages.
function buildSections(questions) {
  return SECTION_ORDER
    .map((key) => ({
      key,
      title: T[`section_${key}`] || key,
      questions: questions.filter((q) => q.section === key)
        .sort((a, b) => a.ord - b.ord),
    }))
    .filter((s) => s.questions.length > 0);
}

// A required question that still has no usable answer. Single source for
// both the page validation and the error outline on the offending field.
function isUnanswered(q, a) {
  if (!q.required) return false;
  const filled = a && (
    (a.text !== undefined && a.text !== null && String(a.text).trim() !== "") ||
    (a.value !== undefined && a.value !== null)
  );
  if (!filled) return true;
  // "אחר" requires the manual detail field to be written out.
  if (a.text === "אחר" && !String(a.other || "").trim()) return true;
  return false;
}

// Content column shared by every phase.
const COLUMN = 640;
const RISE = `z5-rise ${DURATION.move}ms var(--z5-spring) backwards`;

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
        <ViewTransition viewKey={phase} kind={phase === "form" ? "push" : "tab"}>
          {phase === "loading" && <Loading />}
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
        </ViewTransition>
      </SurveyShell>
    </Page>
  );
}

// ── Shell kit (kept in step with PublicExam.jsx) ───────────────────

// Width + gutters of the content column.
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

function SurveyShell({ bar, children }) {
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

// ── Intro / first-screen welcome ───────────────────────────────────

function Intro({ survey, onStart }) {
  const isMobile = useIsMobile();
  const steps = buildSections(survey.questions || []).length;
  return (
    <Panel>
      <h1 style={{ margin: 0, ...TY.title1, color: C.bright }}>{T.intro_title}</h1>
      <div style={{ ...TY.footnote, color: C.dim, marginTop: 6 }}>
        {survey.cycle_name}
      </div>
      <div style={{
        whiteSpace: "pre-line",
        ...TY.body,
        fontSize: isMobile ? 16 : 15,
        lineHeight: 1.6,
        color: C.text,
        marginTop: isMobile ? 16 : 18,
      }}>
        {T.intro_body}
      </div>
      <Tile padding="2px 14px" style={{ marginTop: isMobile ? 18 : 20 }}>
        <List>
          {steps > 0 && (
            <Fact icon="list">
              {steps === 1 ? T.intro_steps_one : withNum(T.intro_steps, steps)}
            </Fact>
          )}
          <Fact icon="info">{T.intro_required_note}</Fact>
        </List>
      </Tile>
      <BigButton primary fullWidth onClick={onStart} style={{ marginTop: isMobile ? 18 : 20 }}>
        {T.start}
      </BigButton>
    </Panel>
  );
}

// ── Form (the multi-page survey itself) ────────────────────────────

function SurveyForm({ token, survey, onSubmitted }) {
  const isMobile = useIsMobile();
  const questions = survey.questions || [];
  const sections = buildSections(questions);
  const totalPages = sections.length;

  const [pageIdx, setPageIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // questionId -> { text, value }
  const [candidateId, setCandidateId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Presentation only: outline unanswered required fields after a failed
  // "next", and remember which way the page is travelling.
  const [showMissing, setShowMissing] = useState(false);
  const [travel, setTravel] = useState("push");

  function setAnswer(qid, patch) {
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));
  }

  // Validate every required question on the given section. Returns true if OK.
  function validateSection(section) {
    for (const q of section.questions) {
      if (isUnanswered(q, answers[q.id])) return false;
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
    const trim = (q) => (q ? String(answers[q.id]?.text || "").trim() : "");
    const byText = (needle) => section.questions.find(
      (q) => (q.question_text || "").trim() === needle);
    // New template: separate first/last name questions. Falls back to a
    // single ord-1 "full name" question for pre-v22 cycles.
    const firstQ = byText("שם פרטי");
    const lastQ  = byText("שם משפחה");
    const legacyNameQ = !firstQ ? section.questions.find((q) => q.ord === 1) : null;
    const teamQ = section.questions.find((q) => q.question_type === "team_radio");
    const idQ   = section.questions.find(
      (q) => (q.question_text || "").includes("מספר אישי"));
    const fullName = firstQ
      ? [trim(firstQ), trim(lastQ)].filter(Boolean).join(" ")
      : trim(legacyNameQ);
    const teamStr  = teamQ ? answers[teamQ.id]?.text : "";
    const team = teamStr ? parseInt(teamStr, 10) : null;
    const personalId = idQ ? String(answers[idQ.id]?.text || "").trim() : "";

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
        // Compose "אחר: <detail>" so the manual answer travels with it.
        const composedText = a.text === "אחר" && String(a.other || "").trim()
          ? `אחר: ${String(a.other).trim()}`
          : (a.text ?? null);
        return saveAnswer({
          token,
          candidateId: cid,
          questionId: q.id,
          answerText: composedText,
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
      setShowMissing(true);
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
        setShowMissing(false);
        setTravel("push");
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
      setShowMissing(false);
      setTravel("pop");
      setPageIdx(pageIdx - 1);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    }
  }

  const section = sections[pageIdx];
  if (!section) return null;
  const isLast = pageIdx + 1 === totalPages;
  // The "required missing" notice steps aside once nothing is missing
  // any more (the outlines it points at are already gone by then).
  const notice = err === T.required_missing && validateSection(section) ? "" : err;

  return (
    <div>
      <StepProgress pageIdx={pageIdx} totalPages={totalPages} />

      <ViewTransition viewKey={section.key} kind={travel}>
        <h2 style={{
          margin: isMobile ? "10px 2px 2px" : "14px 2px 0",
          ...(isMobile ? TY.title2 : TY.title1),
          color: C.bright,
        }}>{section.title}</h2>

        {buildBlocks(section.questions).map((block, bi) => (
          <QuestionBlock
            key={bi}
            block={block}
            answers={answers}
            setAnswer={setAnswer}
            showMissing={showMissing}
          />
        ))}
      </ViewTransition>

      {notice && (
        <Notice tone="error" style={{ marginTop: isMobile ? 12 : 16, animation: RISE }}>
          {notice}
        </Notice>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: isMobile ? 12 : 16 }}>
        {pageIdx > 0 && (
          <BigButton onClick={handlePrev} disabled={busy} icon="chevronBack" iconFlip>
            {T.prev}
          </BigButton>
        )}
        <BigButton
          primary
          onClick={handleNext}
          disabled={busy}
          busy={busy}
          iconEnd={busy || isLast ? undefined : "chevronForward"}
          iconFlip
          style={{ flex: 1 }}
        >
          {busy ? T.saving : isLast ? T.submit : T.next}
        </BigButton>
      </div>
    </div>
  );
}

// Group related questions into visual blocks:
//   namerow — שם פרטי + שם משפחה side by side
//   group   — the 3-name recommendation blocks in one rounded tile
function buildBlocks(qs) {
  const blocks = [];
  let i = 0;
  const txt = (q) => (q.question_text || "").trim();
  while (i < qs.length) {
    const q = qs[i];
    if (txt(q) === "שם פרטי" && qs[i + 1] && txt(qs[i + 1]) === "שם משפחה") {
      blocks.push({ type: "namerow", qs: [q, qs[i + 1]] });
      i += 2;
      continue;
    }
    if (txt(q).startsWith("חייל שאתה ממליץ")) {
      const grp = [];
      while (i < qs.length && txt(qs[i]).startsWith("חייל שאתה ממליץ")) grp.push(qs[i++]);
      blocks.push({ type: "group", title: T.group_recommend, qs: grp });
      continue;
    }
    if (txt(q).startsWith("חייל שלדעתך אינו")) {
      const grp = [];
      while (i < qs.length && txt(qs[i]).startsWith("חייל שלדעתך אינו")) grp.push(qs[i++]);
      blocks.push({ type: "group", title: T.group_dont, qs: grp });
      continue;
    }
    blocks.push({ type: "single", qs: [q] });
    i += 1;
  }
  return blocks;
}

function QuestionBlock({ block, answers, setAnswer, showMissing }) {
  const isMobile = useIsMobile();
  const missing = (q) => showMissing && isUnanswered(q, answers[q.id]);

  if (block.type === "namerow") {
    return (
      <Panel>
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: isMobile ? 18 : 14,
        }}>
          {block.qs.map((q) => (
            <QuestionField
              key={q.id}
              question={q}
              answer={answers[q.id]}
              onChange={(patch) => setAnswer(q.id, patch)}
              invalid={missing(q)}
            />
          ))}
        </div>
      </Panel>
    );
  }

  if (block.type === "group") {
    return (
      <Panel>
        <FieldLabel required={block.qs.some((q) => q.required)} style={{ marginBottom: 2 }}>
          {block.title}
        </FieldLabel>
        <div style={{ ...TY.footnote, color: C.dim, marginBottom: 14 }}>
          {T.group_names_note}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {block.qs.map((q, i) => (
            <div key={q.id}>
              <label htmlFor={fieldId(q)} style={{ ...S.label, display: "block" }}>
                {T.name_n} <Num>{i + 1}</Num>
              </label>
              <QuestionInput
                question={{ ...q, question_type: "text" }}
                answer={answers[q.id] || {}}
                onChange={(patch) => setAnswer(q.id, patch)}
                id={fieldId(q)}
                invalid={missing(q)}
              />
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  const q = block.qs[0];
  return (
    <Panel>
      <QuestionField
        question={q}
        answer={answers[q.id]}
        onChange={(patch) => setAnswer(q.id, patch)}
        invalid={missing(q)}
      />
    </Panel>
  );
}

// "Step n of N" beside a slim bar. The bar shows the step being filled
// in (page n of N shows n/N), so it is never empty and ends full.
function StepProgress({ pageIdx, totalPages }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "8px 2px 0",
    }}>
      <span style={{ ...TY.footnote, color: C.dim, flexShrink: 0 }}>
        {T.page} <Num>{pageIdx + 1}</Num> {T.of} <Num>{totalPages}</Num>
      </span>
      <Progress
        value={totalPages > 0 ? ((pageIdx + 1) / totalPages) * 100 : 0}
        tone="ink"
        height={4}
        label={T.progress}
        style={{ flex: 1 }}
      />
    </div>
  );
}

// ── Question rendering ─────────────────────────────────────────────

const fieldId = (q) => `q-${q.id}`;

// Choice controls are groups of buttons, not a single labelable field.
function isChoiceGroup(question) {
  if ((question.question_text || "").includes("מספר אישי")) return false;
  const t = question.question_type;
  return t === "radio" || t === "team_radio" || t === "likert_5";
}

function FieldLabel({ id, htmlFor, required, children, style }) {
  const Tag = htmlFor ? "label" : "div";
  return (
    <Tag
      id={id}
      htmlFor={htmlFor}
      style={{
        display: "block",
        ...TY.headline,
        color: C.bright,
        marginBottom: 10,
        overflowWrap: "anywhere",
        ...style,
      }}
    >
      {children}
      {required && <span aria-hidden style={{ color: C.error, marginInlineStart: 4 }}>*</span>}
    </Tag>
  );
}

function QuestionField({ question, answer, onChange, invalid }) {
  const text = (question.question_text || "").trim();
  const required = question.required;
  const id = fieldId(question);
  const labelId = `${id}-label`;
  const choice = isChoiceGroup(question);
  return (
    <div style={{ minWidth: 0 }}>
      <FieldLabel
        id={labelId}
        htmlFor={choice ? undefined : id}
        required={required}
        style={question.question_type === "likert_5" || !choice ? undefined : { marginBottom: 4 }}
      >
        {text}
      </FieldLabel>
      <QuestionInput
        question={question}
        answer={answer || {}}
        onChange={onChange}
        id={id}
        labelId={labelId}
        invalid={invalid}
      />
    </div>
  );
}

function QuestionInput({ question, answer, onChange, id, labelId, invalid }) {
  const t = question.question_type;
  const common = { answer, onChange, id, invalid };
  // מספר אישי is stored as a text question but is digits-only — give it
  // the numeric keyboard and digit filtering instead of Hebrew rules.
  if ((question.question_text || "").includes("מספר אישי")) {
    return <PersonalIdInput {...common} />;
  }
  if (t === "textarea") return <TextareaInput {...common} />;
  if (t === "number")   return <NumberInput   {...common} />;
  if (t === "radio" || t === "team_radio") return <RadioInput question={question} labelId={labelId} {...common} />;
  if (t === "dropdown") return <DropdownInput question={question} {...common} />;
  if (t === "likert_5") return <LikertInput   labelId={labelId} {...common} />;
  if (t === "recommend")      return <TextInput placeholder={T.recommend_ph}       {...common} />;
  if (t === "dont_recommend") return <TextInput placeholder={T.dont_recommend_ph}  {...common} />;
  // default 'text'
  return <TextInput {...common} />;
}

// Error outline for a field (replaces the whole border shorthand so the
// style never mixes shorthand and longhand between renders).
const errorOutline = (invalid) => (invalid ? { border: `1px solid ${C.error}` } : null);

function TextInput({ answer, onChange, placeholder, id, invalid }) {
  return (
    <Input
      id={id}
      type="text"
      value={answer.text || ""}
      onChange={(e) => onChange({ text: heOnly(e.target.value) })}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      style={errorOutline(invalid)}
    />
  );
}

function PersonalIdInput({ answer, onChange, id, invalid }) {
  return (
    <Input
      id={id}
      mono
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={answer.text || ""}
      onChange={(e) => onChange({ text: e.target.value.replace(/[^0-9]/g, "") })}
      aria-invalid={invalid || undefined}
      style={{ direction: "ltr", textAlign: "end", ...errorOutline(invalid) }}
    />
  );
}

function NumberInput({ answer, onChange, id, invalid }) {
  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      value={answer.text || ""}
      onChange={(e) => {
        const n = e.target.value === "" ? null : parseInt(e.target.value, 10);
        onChange({ text: e.target.value, value: Number.isNaN(n) ? null : n });
      }}
      aria-invalid={invalid || undefined}
      style={errorOutline(invalid)}
    />
  );
}

function TextareaInput({ answer, onChange, id, invalid }) {
  return (
    <Textarea
      id={id}
      value={answer.text || ""}
      onChange={(e) => onChange({ text: heOnly(e.target.value) })}
      aria-invalid={invalid || undefined}
      style={{ display: "block", ...errorOutline(invalid) }}
    />
  );
}

function DropdownInput({ question, answer, onChange, id, invalid }) {
  const opts = Array.isArray(question.options) ? question.options : [];
  const other = answer.text === "אחר";
  return (
    <div>
      <Select
        id={id}
        value={answer.text || ""}
        onChange={(e) => onChange({ text: e.target.value })}
        aria-invalid={(invalid && !other) || undefined}
        style={errorOutline(invalid && !other)}
      >
        <option value="">{T.choose}</option>
        {opts.map((o, i) => (
          <option key={i} value={String(o)}>{String(o)}</option>
        ))}
      </Select>
      {other && <OtherDetail answer={answer} onChange={onChange} invalid={invalid} />}
    </div>
  );
}

// Manual free-text detail that rises in when "אחר" is picked.
function OtherDetail({ answer, onChange, invalid }) {
  return (
    <div style={{ marginTop: 10, animation: RISE }}>
      <Input
        type="text"
        autoFocus
        value={answer.other || ""}
        onChange={(e) => onChange({ other: heOnly(e.target.value) })}
        placeholder={T.other_detail_ph}
        aria-label={T.other_detail_ph}
        aria-invalid={invalid || undefined}
        style={errorOutline(invalid)}
      />
    </div>
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
function RadioMark({ checked, invalid }) {
  return (
    <span aria-hidden style={{
      width: 22,
      height: 22,
      flexShrink: 0,
      boxSizing: "border-box",
      borderRadius: R.pill,
      border: `1.5px solid ${checked ? C.tint : invalid ? C.error : C.borderBright}`,
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

// One full-width option of a single-choice question.
function ChoiceRow({ label, active, invalid, onPick }) {
  const isMobile = useIsMobile();
  const focus = useFocusRing();
  return (
    <Row
      onClick={onPick}
      selected={active}
      aria-pressed={active}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      leading={<RadioMark checked={active} invalid={invalid} />}
      style={{ minHeight: isMobile ? 50 : 48, ...focus.ring }}
    >
      <span style={{
        display: "block",
        ...TY.body,
        fontSize: 16,
        lineHeight: 1.35,
        color: active ? C.bright : C.text,
        overflowWrap: "anywhere",
      }}>{label}</span>
    </Row>
  );
}

function RadioInput({ question, answer, onChange, labelId, invalid }) {
  const opts = Array.isArray(question.options) ? question.options : [];
  const selected = answer.text || "";
  const other = selected === "אחר";
  return (
    <div role="group" aria-labelledby={labelId}>
      {/* Rows carry their own padding: pull the list in so the card's
          bottom inset matches its sides. Hairlines step aside around
          the selected row so its fill reads as one clean shape. */}
      <div style={{ marginBottom: other ? 0 : -8 }}>
        {opts.map((o, i) => {
          const val = String(o);
          const active = val === selected;
          const afterActive = i > 0 && String(opts[i - 1]) === selected;
          return (
            <div key={i}>
              {i > 0 && (
                <Divider style={{
                  opacity: active || afterActive ? 0 : 1,
                  transition: `opacity ${MOTION.fade}`,
                }} />
              )}
              <ChoiceRow
                label={val}
                active={active}
                invalid={invalid && !other}
                onPick={() => onChange({ text: val })}
              />
            </div>
          );
        })}
      </div>
      {other && <OtherDetail answer={answer} onChange={onChange} invalid={invalid} />}
    </div>
  );
}

function LikertInput({ answer, onChange, labelId, invalid }) {
  const isMobile = useIsMobile();
  const selected = answer.value || null;
  const size = isMobile ? 52 : 48;
  return (
    <div role="group" aria-labelledby={labelId} style={{ maxWidth: 400 }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 6,
      }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = selected === n;
          return (
            <button
              key={n}
              type="button"
              data-press="scale"
              aria-pressed={active}
              onClick={() => onChange({ value: n })}
              style={{
                appearance: "none",
                WebkitAppearance: "none",
                margin: 0,
                padding: 0,
                boxSizing: "border-box",
                width: size,
                minWidth: 0,
                flexShrink: 1,
                aspectRatio: "1 / 1",
                borderRadius: R.pill,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                background: active ? C.tint : C.fill,
                color: active ? C.onTint : C.bright,
                border: `1.5px solid ${active ? C.tint : invalid ? C.error : "transparent"}`,
                fontFamily: FONT,
                ...NUM,
                fontSize: 17,
                lineHeight: 1,
                fontWeight: 600,
              }}
            >{n}</button>
          );
        })}
      </div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        marginTop: 8,
        ...TY.caption,
        color: C.dim,
      }}>
        <span>{T.likert_low}</span>
        <span style={{ textAlign: "end" }}>{T.likert_high}</span>
      </div>
    </div>
  );
}

// ── Submitted ──────────────────────────────────────────────────────

function Thanks() {
  return <Done title={T.thanks_title}>{T.thanks_body}</Done>;
}
