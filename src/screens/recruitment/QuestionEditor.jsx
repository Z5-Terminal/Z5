// Z5 :: Survey question editor (admin) — Phase C2.
// Per-cycle CRUD over the survey_questions table. Reached from the
// Cycles detail screen via "Edit questions".

import { useEffect, useState, useMemo } from "react";
import { useI18n } from "../../i18n";
import { useIsMobile } from "../../useIsMobile";
import {
  PageHeader, Panel, Btn, Input, Textarea, Field, Badge, ErrLine, OkLine,
  BackButton, ConfirmDialog,
} from "../../ui";
import { C, S } from "../../theme";
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

export default function QuestionEditor({ cycleId, cycleName, onBack }) {
  const { t } = useI18n();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
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
    const { data, error } = await seedDefaultTemplate(cycleId);
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

  return (
    <>
      <PageHeader
        title={`${t("rec.editor.title")} — ${cycleName || ""}`}
        subtitle={t("rec.editor.subtitle")}
        action={<BackButton onClick={onBack} />}
      />
      <Panel connectTop>
        {questions.length === 0 && !loading && (
          <div style={{
            color: C.dim, fontSize: 13, lineHeight: 1.6, marginBottom: 12,
          }}>
            {t("rec.editor.empty")}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          <Btn small onClick={handleSeed}>{t("rec.editor.seed")}</Btn>
          <Btn small onClick={() => setAdding(true)}>{t("rec.editor.add")}</Btn>
        </div>
        <ErrLine>{err}</ErrLine>
        <OkLine>{ok}</OkLine>
      </Panel>

      {adding && (
        <Panel title={t("rec.editor.new_question")}>
          <QuestionForm
            initial={defaultNewQuestion(questions)}
            onSave={(q) => handleSave(q, true)}
            onCancel={() => setAdding(false)}
          />
        </Panel>
      )}

      {SECTIONS.map((s) => {
        const list = grouped.get(s) || [];
        if (list.length === 0) return null;
        return (
          <Panel key={s} title={`${t(`rec.section.${s}`)} (${list.length})`}>
            {list.map((q) => (
              editingId === q.id ? (
                <QuestionForm
                  key={q.id}
                  initial={q}
                  onSave={(p) => handleSave({ ...p, id: q.id }, false)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <QuestionRow
                  key={q.id}
                  q={q}
                  onEdit={() => setEditingId(q.id)}
                  onDelete={() => handleDelete(q.id)}
                />
              )
            ))}
          </Panel>
        );
      })}
    </>
  );
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
  const [confirmDel, setConfirmDel] = useState(false);
  const typeLabel = QUESTION_TYPES.includes(q.question_type)
    ? t(`rec.qtype.${q.question_type}`)
    : q.question_type;
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 0",
      borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{
        flex: "0 0 28px",
        color: C.dim,
        fontFamily: "var(--font-mono, monospace)",
        fontSize: 12,
      }}>{q.ord}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: C.bright,
          fontSize: 14,
          marginBottom: 4,
          lineHeight: 1.4,
        }}>{q.question_text}</div>
        <div style={{ display: "flex", gap: 6, fontSize: 11, color: C.dim, flexWrap: "wrap" }}>
          <Badge>{typeLabel}</Badge>
          {q.required && <Badge tone="warn">{t("rec.editor.required_label")}</Badge>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <Btn small onClick={onEdit}>{t("mis.edit")}</Btn>
        <Btn small onClick={() => setConfirmDel(true)}>{t("mis.delete")}</Btn>
      </div>
      <ConfirmDialog
        open={confirmDel}
        title={t("rec.editor.delete_title")}
        message={t("rec.editor.delete_body")}
        confirmLabel={t("mis.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => { setConfirmDel(false); onDelete(); }}
        onCancel={() => setConfirmDel(false)}
      />
    </div>
  );
}

// ── Form (create + edit share this) ────────────────────────────────

function QuestionForm({ initial, onSave, onCancel }) {
  const { t } = useI18n();
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
    <form onSubmit={save} style={{
      padding: "14px",
      background: C.cardBg,
      border: `1px solid ${C.border}`,
      borderRadius: 4,
      marginBottom: 12,
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 80px",
        gap: 10,
      }}>
        <Field label={t("rec.editor.section")}>
          <select value={section} onChange={(e) => setSection(e.target.value)} style={{ ...S.input, fontSize: 14 }}>
            {SECTIONS.map((s) => (
              <option key={s} value={s}>{t(`rec.section.${s}`)}</option>
            ))}
          </select>
        </Field>
        <Field label={t("rec.editor.type")}>
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...S.input, fontSize: 14 }}>
            {QUESTION_TYPES.map((qt) => (
              <option key={qt} value={qt}>{t(`rec.qtype.${qt}`)}</option>
            ))}
          </select>
        </Field>
        <Field label={t("rec.editor.ord")}>
          <Input type="number" value={ord} onChange={(e) => setOrd(e.target.value)} />
        </Field>
      </div>
      <Field label={t("rec.editor.text_label")}>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("rec.editor.text_ph")} />
      </Field>
      {usesOptions && (
        <Field label={t("rec.editor.options_label")}>
          <Textarea
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            placeholder={t("rec.editor.options_ph")}
          />
        </Field>
      )}
      <label style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 16,
        cursor: "pointer",
        fontSize: 13,
        color: C.text,
      }}>
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        {t("rec.editor.required_label")}
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn small primary type="submit" disabled={busy}>
          {busy ? t("rec.saving") : t("rec.editor.save_btn")}
        </Btn>
        <Btn small type="button" onClick={onCancel}>
          {t("rec.editor.cancel_btn")}
        </Btn>
      </div>
      <ErrLine>{err}</ErrLine>
    </form>
  );
}
