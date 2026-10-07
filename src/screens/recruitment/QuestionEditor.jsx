// Z5 :: Survey question editor (admin) — Phase C2.
// Per-cycle CRUD over the survey_questions table. Reached from the
// Cycles detail screen via "Edit questions".
// Shares its scaffold with ExamEditor — keep the two visually identical.

import { useEffect, useState, useMemo } from "react";
import { useI18n } from "../../i18n";
import { useIsMobile } from "../../useIsMobile";
import {
  PageHeader, Panel, Tile, List, Row, Btn, IconButton, Input, Textarea, Select,
  Field, Switch, Badge, Num, ErrLine, OkLine, EmptyState, SkeletonRows,
  ConfirmDialog, ELLIPSIS,
} from "../../ui";
import { C, T } from "../../theme";
import { DURATION } from "../../motion";
import {
  listSurveyQuestions,
  createSurveyQuestion,
  updateSurveyQuestion,
  deleteSurveyQuestion,
  seedDefaultTemplate,
} from "../../data/recruitment";

// Labels resolve at render time via t(`rec.section.${key}`) — the same
// keys the Candidates response viewer uses — and t(`rec.qtype.${key}`).
const SECTIONS = ["identity", "self_assessment", "background", "physical"];

const QUESTION_TYPES = [
  "text", "textarea", "number", "radio", "dropdown",
  "likert_5", "team_radio", "recommend", "dont_recommend",
];

// New content appearing in place rises in.
const RISE = `z5-rise ${DURATION.move}ms var(--z5-spring) backwards`;

export default function QuestionEditor({ cycleId, cycleName, onBack }) {
  const { t } = useI18n();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);

  async function refresh() {
    setLoading(true);
    const { data, error } = await listSurveyQuestions(cycleId);
    if (error) setErr(error.message);
    else setQuestions(data || []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, [cycleId]);

  const grouped = useMemo(() => {
    const map = new Map(SECTIONS.map((s) => [s, []]));
    for (const q of questions) {
      const list = map.get(q.section) || map.set(q.section, []).get(q.section);
      list.push(q);
    }
    for (const list of map.values()) list.sort((a, b) => a.ord - b.ord);
    return map;
  }, [questions]);

  function flash(setter, msg, ms = 2200) {
    setter(msg);
    setTimeout(() => setter(""), ms);
  }

  async function handleSeed() {
    setErr(""); setOk("");
    setSeeding(true);
    const { data, error } = await seedDefaultTemplate(cycleId);
    setSeeding(false);
    if (error) { setErr(error.message); return; }
    flash(setOk, data > 0
      ? t("rec.editor.seeded", { n: data })
      : t("rec.editor.already_seeded"));
    await refresh();
  }

  async function handleDelete(id) {
    setErr(""); setOk("");
    const { error } = await deleteSurveyQuestion(id);
    if (error) { setErr(error.message); return; }
    flash(setOk, t("rec.editor.deleted"));
    await refresh();
  }

  async function handleSave(q, isNew) {
    setErr(""); setOk("");
    if (isNew) {
      const { error } = await createSurveyQuestion(cycleId, q);
      if (error) { setErr(error.message); return; }
      setAdding(false);
    } else {
      const { id, ...patch } = q;
      const { error } = await updateSurveyQuestion(id, patch);
      if (error) { setErr(error.message); return; }
      setEditingId(null);
    }
    flash(setOk, t("rec.editor.saved"));
    await refresh();
  }

  // First load only — later refreshes keep the list on screen.
  const firstLoad = loading && questions.length === 0;
  const seedBtn = (
    <Btn small type="button" onClick={handleSeed} disabled={seeding} busy={seeding}>
      {t("rec.editor.seed")}
    </Btn>
  );

  return (
    <>
      <PageHeader
        back={{ onClick: onBack, label: cycleName ? <BackLabel>{cycleName}</BackLabel> : undefined }}
        title={t("rec.editor.title")}
        subtitle={t("rec.editor.subtitle")}
        action={(
          <>
            {seedBtn}
            <Btn small primary type="button" icon="plus" onClick={() => setAdding(true)}>
              {t("rec.editor.add")}
            </Btn>
          </>
        )}
      />
      <ErrLine>{err}</ErrLine>
      <OkLine>{ok}</OkLine>

      {adding && (
        <Panel title={t("rec.editor.new_question")} style={{ animation: RISE }}>
          <QuestionForm
            initial={defaultNewQuestion(questions)}
            onSave={(q) => handleSave(q, true)}
            onCancel={() => setAdding(false)}
          />
        </Panel>
      )}

      {firstLoad && (
        <Panel><SkeletonRows rows={5} /></Panel>
      )}

      {!loading && questions.length === 0 && !adding && (
        <Panel>
          <EmptyState icon="list" title={t("rec.editor.empty_title")} action={seedBtn}>
            {t("rec.editor.empty_hint")}
          </EmptyState>
        </Panel>
      )}

      {SECTIONS.map((s) => {
        const list = grouped.get(s) || [];
        if (list.length === 0) return null;
        return (
          <Panel
            key={s}
            title={t(`rec.section.${s}`)}
            action={<Badge><Num>{list.length}</Num></Badge>}
          >
            <List>
              {list.map((q) => (
                editingId === q.id ? (
                  <Tile key={q.id} style={{ marginBlock: 8, animation: RISE }}>
                    <QuestionForm
                      initial={q}
                      onSave={(p) => handleSave({ ...p, id: q.id }, false)}
                      onCancel={() => setEditingId(null)}
                    />
                  </Tile>
                ) : (
                  <QuestionRow
                    key={q.id}
                    q={q}
                    onEdit={() => setEditingId(q.id)}
                    onDelete={() => handleDelete(q.id)}
                  />
                )
              ))}
            </List>
          </Panel>
        );
      })}
    </>
  );
}

// Back control label: the cycle we return to, cut short when it is long.
function BackLabel({ children }) {
  return <span style={{ ...ELLIPSIS, maxWidth: 220 }}>{children}</span>;
}

function defaultNewQuestion(existing) {
  const maxOrd = existing.reduce((m, q) => Math.max(m, q.ord || 0), 0);
  return {
    ord: maxOrd + 1,
    section: "identity",
    question_text: "",
    question_type: "text",
    options: null,
    required: true,
  };
}

// ── Row (collapsed view) ──────────────────────────────────────────

function QuestionRow({ q, onEdit, onDelete }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [confirmDel, setConfirmDel] = useState(false);
  const typeLabel = QUESTION_TYPES.includes(q.question_type)
    ? t(`rec.qtype.${q.question_type}`)
    : q.question_type;
  const btnSize = isMobile ? 36 : 32;
  return (
    <>
      <Row
        as="div"
        align="flex-start"
        leading={<OrdMark>{q.ord}</OrdMark>}
        trailing={(
          <div style={{ display: "flex", gap: 6 }}>
            <IconButton icon="pencil" label={t("common.edit")} size={btnSize} onClick={onEdit} />
            <IconButton icon="trash" label={t("common.delete")} size={btnSize} onClick={() => setConfirmDel(true)} />
          </div>
        )}
      >
        <div style={{ ...T.body, fontWeight: 500, color: C.bright, overflowWrap: "anywhere" }}>
          {/* Question text is content, not chrome: it keeps its own direction. */}
          <span dir="auto">{q.question_text}</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          <Badge>{typeLabel}</Badge>
          {q.required && <Badge tone="bright">{t("rec.editor.required_label")}</Badge>}
        </div>
      </Row>
      <ConfirmDialog
        open={confirmDel}
        title={t("rec.editor.delete_title")}
        message={t("rec.editor.delete_body")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => { setConfirmDel(false); onDelete(); }}
        onCancel={() => setConfirmDel(false)}
      />
    </>
  );
}

// Quiet order number, sitting on the first text line of its row.
function OrdMark({ children }) {
  return (
    <span style={{ ...T.body, minWidth: 22, textAlign: "center", color: C.dimmer }}>
      <Num>{children}</Num>
    </span>
  );
}

// ── Form (create + edit share this) ────────────────────────────────

function QuestionForm({ initial, onSave, onCancel }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [ord, setOrd] = useState(initial.ord || 1);
  const [section, setSection] = useState(initial.section || "identity");
  const [text, setText] = useState(initial.question_text || "");
  const [type, setType] = useState(initial.question_type || "text");
  const [optionsText, setOptionsText] = useState(
    Array.isArray(initial.options) ? initial.options.join("\n") : ""
  );
  const [required, setRequired] = useState(initial.required !== false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const usesOptions = type === "radio" || type === "dropdown";

  async function save(e) {
    e.preventDefault();
    setErr("");
    if (!text.trim()) { setErr(t("rec.editor.text_required")); return; }
    let options = null;
    if (usesOptions) {
      const opts = optionsText.split("\n").map((s) => s.trim()).filter(Boolean);
      if (opts.length === 0) { setErr(t("rec.editor.options_required")); return; }
      options = opts;
    }
    setBusy(true);
    await onSave({
      ord: parseInt(ord, 10) || 1,
      section,
      question_text: text.trim(),
      question_type: type,
      options,
      required,
    });
    setBusy(false);
  }

  return (
    <form onSubmit={save}>
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr) 96px",
        columnGap: 12,
      }}>
        <Field label={t("rec.editor.section")}>
          <Select value={section} onChange={(e) => setSection(e.target.value)}>
            {SECTIONS.map((s) => (
              <option key={s} value={s}>{t(`rec.section.${s}`)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("rec.editor.type")}>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {QUESTION_TYPES.map((qt) => (
              <option key={qt} value={qt}>{t(`rec.qtype.${qt}`)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("rec.editor.ord")}>
          <Input type="number" value={ord} onChange={(e) => setOrd(e.target.value)} />
        </Field>
      </div>
      <Field label={t("rec.editor.text_label")}>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("rec.editor.text_ph")}
          style={{ height: 88 }}
        />
      </Field>
      {usesOptions && (
        <Field label={t("rec.editor.options_label")}>
          <Textarea
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            placeholder={t("rec.editor.options_ph")}
            style={{ height: 110 }}
          />
        </Field>
      )}
      <div style={{ marginBottom: 16 }}>
        <Switch
          checked={required}
          onChange={setRequired}
          label={t("rec.editor.required_label")}
        />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn small={!isMobile} primary type="submit" disabled={busy} busy={busy}>
          {busy ? t("rec.saving") : t("rec.editor.save_btn")}
        </Btn>
        <Btn small={!isMobile} type="button" onClick={onCancel}>
          {t("rec.editor.cancel_btn")}
        </Btn>
      </div>
      <ErrLine>{err}</ErrLine>
    </form>
  );
}
