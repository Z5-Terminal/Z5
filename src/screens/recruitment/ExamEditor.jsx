// Z5 :: Exam editor (admin) — Phase C4.
// Per-cycle CRUD over exam_questions. Each question can have:
//   - prompt_text (always)
//   - prompt_image_url (optional figure shown above the options)
//   - options: array of { key, text?, image_url? }
//   - correct_option: the option key marked as correct
// Reached from the Cycles detail screen via "Edit exam".

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import { useIsMobile } from "../../useIsMobile";
import {
  PageHeader, Panel, Btn, Input, Textarea, Field, Badge, ErrLine, OkLine,
} from "../../ui";
import { C, S, FONT_MONO } from "../../theme";
import {
  listExamQuestions,
  createExamQuestion,
  updateExamQuestion,
  deleteExamQuestion,
  seedDefaultExam,
  uploadExamFigure,
  examFigureUrl,
} from "../../data/examQuestions";

export default function ExamEditor({ cycleId, cycleName, onBack }) {
  const { t } = useI18n();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);

  async function refresh() {
    setLoading(true);
    const { data, error } = await listExamQuestions(cycleId);
    if (error) setErr(error.message);
    else setQuestions(data || []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, [cycleId]);

  function flash(setter, msg, ms = 2200) {
    setter(msg);
    setTimeout(() => setter(""), ms);
  }

  async function handleSeed() {
    setErr(""); setOk("");
    const { data, error } = await seedDefaultExam(cycleId);
    if (error) { setErr(error.message); return; }
    flash(setOk, data > 0
      ? t("rec.exam_editor.seeded", { n: data })
      : t("rec.exam_editor.already_seeded"));
    await refresh();
  }

  async function handleDelete(id) {
    setErr(""); setOk("");
    const { error } = await deleteExamQuestion(id);
    if (error) { setErr(error.message); return; }
    flash(setOk, t("rec.exam_editor.deleted"));
    await refresh();
  }

  async function handleCreate(q) {
    setErr(""); setOk("");
    const { error } = await createExamQuestion(cycleId, q);
    if (error) { setErr(error.message); return; }
    setAdding(false);
    flash(setOk, t("rec.exam_editor.saved"));
    await refresh();
  }

  async function handleUpdate(id, patch) {
    setErr(""); setOk("");
    const { error } = await updateExamQuestion(id, patch);
    if (error) { setErr(error.message); return; }
    setEditingId(null);
    flash(setOk, t("rec.exam_editor.saved"));
    await refresh();
  }

  const missingKey = questions.filter((q) => !q.correct_option).length;
  const missingImages = questions.filter((q) => questionMissingImages(q)).length;

  return (
    <>
      <PageHeader
        title={`${t("rec.exam_editor.title")} — ${cycleName || ""}`}
        subtitle={t("rec.exam_editor.subtitle")}
        action={<Btn small onClick={onBack}>← {t("rec.back")}</Btn>}
      />

      <Panel>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Btn small onClick={handleSeed}>{t("rec.exam_editor.seed")}</Btn>
          <Btn small onClick={() => setAdding(true)}>{t("rec.exam_editor.add")}</Btn>
        </div>
        {(missingKey > 0 || missingImages > 0) && (
          <div style={{
            background: C.warnBg || "rgba(255,204,85,0.08)",
            border: `1px solid ${C.warnBorderFaint}`,
            color: C.warn,
            padding: "10px 14px",
            borderRadius: 3,
            fontSize: 13,
            lineHeight: 1.5,
          }}>
            {missingKey > 0 && <div>· {t("rec.exam_editor.missing_keys", { n: missingKey })}</div>}
            {missingImages > 0 && <div>· {t("rec.exam_editor.missing_images", { n: missingImages })}</div>}
          </div>
        )}
        <ErrLine>{err}</ErrLine>
        <OkLine>{ok}</OkLine>
      </Panel>

      {adding && (
        <Panel title={t("rec.exam_editor.new_question")}>
          <QuestionForm
            cycleId={cycleId}
            initial={defaultNewQuestion(questions)}
            onSave={(q) => handleCreate(q)}
            onCancel={() => setAdding(false)}
          />
        </Panel>
      )}

      {loading && (
        <Panel><div style={{ color: C.dim }}>{t("common.loading")}</div></Panel>
      )}

      {!loading && questions.length === 0 && !adding && (
        <Panel>
          <div style={{ color: C.dim, fontSize: 14, lineHeight: 1.6 }}>
            {t("rec.exam_editor.empty")}
          </div>
        </Panel>
      )}

      {questions.map((q) => (
        editingId === q.id ? (
          <Panel key={q.id} title={`#${q.ord}`}>
            <QuestionForm
              cycleId={cycleId}
              initial={q}
              onSave={(patch) => handleUpdate(q.id, patch)}
              onCancel={() => setEditingId(null)}
            />
          </Panel>
        ) : (
          <Panel key={q.id}>
            <QuestionRow
              q={q}
              onEdit={() => setEditingId(q.id)}
              onDelete={() => handleDelete(q.id)}
            />
          </Panel>
        )
      ))}
    </>
  );
}

function defaultNewQuestion(existing) {
  const maxOrd = existing.reduce((m, q) => Math.max(m, q.ord || 0), 0);
  return {
    ord: maxOrd + 1,
    prompt_text: "",
    prompt_image_url: null,
    options: [
      { key: "1" }, { key: "2" }, { key: "3" }, { key: "4" },
    ],
    correct_option: null,
    points: 1,
  };
}

function questionMissingImages(q) {
  // A question "needs" an image if any of its options have a key but no
  // text and no image_url — the seeded image stubs end up like that.
  return (q.options || []).some((o) => !o.text && !o.image_url);
}

// ── Read-only row view ─────────────────────────────────────────────

function QuestionRow({ q, onEdit, onDelete }) {
  const { t } = useI18n();
  const [confirmDel, setConfirmDel] = useState(false);
  const promptImg = examFigureUrl(q.prompt_image_url);
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        marginBottom: q.options?.length ? 12 : 0,
      }}>
        <div style={{
          flex: "0 0 30px",
          fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: C.dim,
        }}>{q.ord}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: C.text, fontSize: 14, lineHeight: 1.5, marginBottom: 6,
          }}>{q.prompt_text || <em style={{ color: C.dim }}>{t("rec.exam_editor.no_prompt")}</em>}</div>
          {promptImg && (
            <img src={promptImg} alt="" style={{
              maxWidth: 160, display: "block", border: `1px solid ${C.border}`,
              borderRadius: 3, marginBottom: 6,
            }} />
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {q.correct_option
              ? <Badge tone="ok">{t("rec.exam_editor.keyed_to")} {q.correct_option}</Badge>
              : <Badge tone="warn">{t("rec.exam_editor.no_key")}</Badge>}
            <Badge>{(q.options || []).length} {t("rec.exam_editor.options")}</Badge>
            <Badge tone="bright">{q.points ?? 1} {t("rec.exam_editor.points_suffix")}</Badge>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {confirmDel ? (
            <>
              <Btn small onClick={onDelete}>✓</Btn>
              <Btn small onClick={() => setConfirmDel(false)}>✕</Btn>
            </>
          ) : (
            <>
              <Btn small onClick={onEdit}>{t("rec.exam_editor.edit")}</Btn>
              <Btn small onClick={() => setConfirmDel(true)}>{t("rec.exam_editor.del")}</Btn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Edit form (used by create + update) ────────────────────────────

function QuestionForm({ cycleId, initial, onSave, onCancel }) {
  const { t } = useI18n();
  const [ord, setOrd] = useState(initial.ord || 1);
  const [promptText, setPromptText] = useState(initial.prompt_text || "");
  const [promptImagePath, setPromptImagePath] = useState(initial.prompt_image_url || null);
  const [options, setOptions] = useState(
    Array.isArray(initial.options) && initial.options.length > 0
      ? initial.options
      : [{ key: "1" }, { key: "2" }, { key: "3" }, { key: "4" }]
  );
  const [correct, setCorrect] = useState(initial.correct_option || "");
  const [points, setPoints] = useState(initial.points ?? 1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function updateOption(i, patch) {
    setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, ...patch } : o));
  }
  function addOption() {
    setOptions((prev) => [...prev, { key: String(prev.length + 1) }]);
  }
  function removeOption(i) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save(e) {
    e.preventDefault();
    setErr("");
    if (!promptText.trim() && !promptImagePath) {
      setErr(t("rec.exam_editor.prompt_required")); return;
    }
    if (options.length === 0) {
      setErr(t("rec.exam_editor.options_required")); return;
    }
    setBusy(true);
    await onSave({
      ord: parseInt(ord, 10) || 1,
      prompt_text: promptText.trim() || null,
      prompt_image_url: promptImagePath || null,
      options,
      correct_option: correct || null,
      points: Math.max(1, parseInt(points, 10) || 1),
    });
    setBusy(false);
  }

  return (
    <form onSubmit={save}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Field label={t("rec.exam_editor.ord")}>
          <Input type="number" value={ord} onChange={(e) => setOrd(e.target.value)} style={{ width: 110 }} />
        </Field>
        <Field label={t("rec.exam_editor.points")}>
          <Input type="number" min="1" max="100" value={points} onChange={(e) => setPoints(e.target.value)} style={{ width: 110 }} />
        </Field>
      </div>
      <Field label={t("rec.exam_editor.prompt_text")}>
        <Textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder={t("rec.exam_editor.prompt_ph")}
        />
      </Field>
      <Field label={t("rec.exam_editor.prompt_image")}>
        <FigureUpload
          slot="prompt"
          questionId={initial.id}
          path={promptImagePath}
          onUploaded={setPromptImagePath}
          onCleared={() => setPromptImagePath(null)}
        />
      </Field>

      <div style={{ marginTop: 16 }}>
        <div style={{ ...S.label, marginBottom: 8 }}>
          {t("rec.exam_editor.options_label")}
        </div>
        {options.map((opt, i) => (
          <OptionEditor
            key={opt.key + i}
            questionId={initial.id}
            option={opt}
            isCorrect={correct === opt.key}
            onMarkCorrect={() => setCorrect(opt.key)}
            onChange={(patch) => updateOption(i, patch)}
            onRemove={options.length > 2 ? () => removeOption(i) : null}
          />
        ))}
        <Btn small onClick={(e) => { e.preventDefault(); addOption(); }}>
          {t("rec.exam_editor.add_option")}
        </Btn>
      </div>

      <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
        <Btn small primary type="submit" disabled={busy}>
          {busy ? t("rec.saving") : t("rec.exam_editor.save_btn")}
        </Btn>
        <Btn small type="button" onClick={onCancel}>
          {t("rec.exam_editor.cancel_btn")}
        </Btn>
      </div>
      <ErrLine>{err}</ErrLine>
    </form>
  );
}

function OptionEditor({ questionId, option, isCorrect, onMarkCorrect, onChange, onRemove }) {
  const { t } = useI18n();
  return (
    <div style={{
      border: `1px solid ${isCorrect ? C.ok : C.border}`,
      borderRadius: 3,
      padding: "10px 12px",
      marginBottom: 10,
      background: isCorrect ? C.okBg : "transparent",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 8,
      }}>
        <span style={{
          fontFamily: FONT_MONO, fontWeight: 700, color: C.bright,
          fontSize: 13, minWidth: 28,
        }}>{option.key}</span>
        <Input
          mono
          value={option.key}
          onChange={(e) => onChange({ key: e.target.value })}
          style={{ maxWidth: 80 }}
        />
        <Btn small
          active={isCorrect}
          onClick={(e) => { e.preventDefault(); onMarkCorrect(); }}
          type="button"
        >
          {isCorrect ? `✓ ${t("rec.exam_editor.correct")}` : t("rec.exam_editor.mark_correct")}
        </Btn>
        {onRemove && (
          <Btn small type="button" onClick={(e) => { e.preventDefault(); onRemove(); }}>✕</Btn>
        )}
      </div>
      <Field label={t("rec.exam_editor.option_text")}>
        <Input
          value={option.text || ""}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder={t("rec.exam_editor.option_text_ph")}
        />
      </Field>
      <Field label={t("rec.exam_editor.option_image")}>
        <FigureUpload
          slot={option.key}
          questionId={questionId}
          path={option.image_url}
          onUploaded={(path) => onChange({ image_url: path })}
          onCleared={() => onChange({ image_url: null })}
        />
      </Field>
    </div>
  );
}

function FigureUpload({ questionId, slot, path, onUploaded, onCleared }) {
  const { t } = useI18n();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const url = examFigureUrl(path);

  async function handleFile(file) {
    if (!file) return;
    if (!questionId) {
      setErr(t("rec.exam_editor.save_first"));
      return;
    }
    setBusy(true); setErr("");
    const { path: newPath, error } = await uploadExamFigure(questionId, slot, file);
    setBusy(false);
    if (error) { setErr(error.message || String(error)); return; }
    onUploaded(newPath);
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) handleFile(f);
        }}
      />
      {url && (
        <img src={url} alt="" style={{
          maxWidth: 200, display: "block", marginBottom: 8,
          border: `1px solid ${C.border}`, borderRadius: 3,
        }} />
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Btn small type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? t("rec.exam_editor.uploading")
                : (url ? t("rec.exam_editor.replace_image") : t("rec.exam_editor.upload_image"))}
        </Btn>
        {url && onCleared && (
          <Btn small type="button" onClick={onCleared}>{t("rec.exam_editor.clear_image")}</Btn>
        )}
      </div>
      <ErrLine>{err}</ErrLine>
    </div>
  );
}
