// Z5 :: Exam editor (admin) — Phase C4.
// Per-cycle CRUD over exam_questions. Each question can have:
//   - prompt_text (always)
//   - prompt_image_url (optional figure shown above the options)
//   - options: array of { key, text?, image_url? }
//   - correct_option: the option key marked as correct
// Reached from the Cycles detail screen via "Edit exam".
// Shares its scaffold with QuestionEditor — keep the two visually identical.

import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import { useIsMobile } from "../../useIsMobile";
import {
  PageHeader, Panel, Tile, List, Row, Btn, IconButton, Input, Textarea, Field,
  Checkbox, Badge, Num, Notice, ErrLine, OkLine, EmptyState, SkeletonRows,
  ConfirmDialog, Lightbox, ELLIPSIS,
} from "../../ui";
import { C, S, R, T, FONT } from "../../theme";
import { DURATION } from "../../motion";
import {
  listExamQuestions,
  createExamQuestion,
  updateExamQuestion,
  deleteExamQuestion,
  seedDefaultExam,
  uploadExamFigure,
  examFigureUrl,
} from "../../data/examQuestions";

// New content appearing in place rises in.
const RISE = `z5-rise ${DURATION.move}ms var(--z5-spring) backwards`;

export default function ExamEditor({ cycleId, cycleName, onBack }) {
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
    setSeeding(true);
    const { data, error } = await seedDefaultExam(cycleId);
    setSeeding(false);
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

  // First load only — later refreshes keep the list on screen.
  const firstLoad = loading && questions.length === 0;
  const seedBtn = (
    <Btn small type="button" onClick={handleSeed} disabled={seeding} busy={seeding}>
      {t("rec.exam_editor.seed")}
    </Btn>
  );

  return (
    <>
      <PageHeader
        back={{ onClick: onBack, label: cycleName ? <BackLabel>{cycleName}</BackLabel> : undefined }}
        title={t("rec.exam_editor.title")}
        subtitle={t("rec.exam_editor.subtitle")}
        action={(
          <>
            {seedBtn}
            <Btn small primary type="button" icon="plus" onClick={() => setAdding(true)}>
              {t("rec.exam_editor.add")}
            </Btn>
          </>
        )}
      />
      {(missingKey > 0 || missingImages > 0) && (
        <Notice tone="warn" style={{ marginTop: 12 }}>
          {missingKey > 0 && <div>{withNum(t("rec.exam_editor.missing_keys"), "n", missingKey)}</div>}
          {missingImages > 0 && <div>{withNum(t("rec.exam_editor.missing_images"), "n", missingImages)}</div>}
        </Notice>
      )}
      <ErrLine>{err}</ErrLine>
      <OkLine>{ok}</OkLine>

      {adding && (
        <Panel title={t("rec.exam_editor.new_question")} style={{ animation: RISE }}>
          <QuestionForm
            cycleId={cycleId}
            initial={defaultNewQuestion(questions)}
            onSave={(q) => handleCreate(q)}
            onCancel={() => setAdding(false)}
          />
        </Panel>
      )}

      {firstLoad && (
        <Panel><SkeletonRows rows={5} /></Panel>
      )}

      {!loading && questions.length === 0 && !adding && (
        <Panel>
          <EmptyState icon="graduation" title={t("rec.exam_editor.empty_title")} action={seedBtn}>
            {t("rec.exam_editor.empty_hint")}
          </EmptyState>
        </Panel>
      )}

      {questions.length > 0 && (
        <Panel>
          <List>
            {questions.map((q) => (
              editingId === q.id ? (
                <Tile key={q.id} style={{ marginBlock: 8, animation: RISE }}>
                  <QuestionForm
                    cycleId={cycleId}
                    initial={q}
                    inTile
                    onSave={(patch) => handleUpdate(q.id, patch)}
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
      )}
    </>
  );
}

// Renders an i18n template with its `{token}` number going through <Num>
// (tabular figures, bidi-isolated).
function withNum(template, token, value) {
  const i = String(template).indexOf(`{${token}}`);
  if (i < 0) return template;
  return [
    template.slice(0, i),
    <Num key="n">{value}</Num>,
    template.slice(i + token.length + 2),
  ];
}

// Back control label: the cycle we return to, cut short when it is long.
function BackLabel({ children }) {
  return <span style={{ ...ELLIPSIS, maxWidth: 220 }}>{children}</span>;
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

// Figures are line art made for a white page; they keep a paper backdrop
// in both themes so they stay legible at night.
function figureStyle(size) {
  return {
    display: "block",
    boxSizing: "border-box",
    height: size,
    width: "auto",
    maxWidth: "100%",
    padding: 4,
    objectFit: "contain",
    borderRadius: R.sm,
    background: C.posterPaper,
  };
}

// ── Read-only row view ─────────────────────────────────────────────

function QuestionRow({ q, onEdit, onDelete }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [confirmDel, setConfirmDel] = useState(false);
  const [zoom, setZoom] = useState(false);
  const promptImg = examFigureUrl(q.prompt_image_url);
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
        <div style={{
          ...T.body,
          fontWeight: 500,
          color: q.prompt_text ? C.bright : C.dim,
          overflowWrap: "anywhere",
        }}>
          {/* Prompt text is content, not chrome: it keeps its own direction. */}
          {q.prompt_text ? <span dir="auto">{q.prompt_text}</span> : t("rec.exam_editor.no_prompt")}
        </div>
        {promptImg && (
          <button
            type="button"
            data-press="scale"
            data-press-depth="soft"
            aria-label={t("rec.exam_editor.view_figure")}
            onClick={() => setZoom(true)}
            style={{
              all: "unset",
              display: "block",
              maxWidth: "100%",
              marginTop: 8,
              borderRadius: R.sm,
              cursor: "zoom-in",
            }}
          >
            <img src={promptImg} alt="" style={figureStyle(84)} />
          </button>
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {q.correct_option
            ? <Badge tone="ok">{t("rec.exam_editor.keyed_to")} <Num>{q.correct_option}</Num></Badge>
            : <Badge tone="warn">{t("rec.exam_editor.no_key")}</Badge>}
          <Badge><Num>{(q.options || []).length}</Num> {t("rec.exam_editor.options")}</Badge>
          <Badge tone="bright"><Num>{q.points ?? 1}</Num> {t("rec.exam_editor.points_suffix")}</Badge>
        </div>
      </Row>
      {zoom && (
        <Lightbox
          src={promptImg}
          alt={q.prompt_text || ""}
          closeLabel={t("common.close")}
          onClose={() => setZoom(false)}
        />
      )}
      <ConfirmDialog
        open={confirmDel}
        title={t("rec.exam_editor.delete_title")}
        message={t("rec.exam_editor.delete_body")}
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

// ── Edit form (used by create + update) ────────────────────────────

function QuestionForm({ cycleId, initial, inTile, onSave, onCancel }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
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
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "120px 120px",
        columnGap: 12,
      }}>
        <Field label={t("rec.exam_editor.ord")}>
          <Input type="number" value={ord} onChange={(e) => setOrd(e.target.value)} />
        </Field>
        <Field label={t("rec.exam_editor.points")}>
          <Input type="number" min="1" max="100" value={points} onChange={(e) => setPoints(e.target.value)} />
        </Field>
      </div>
      <Field label={t("rec.exam_editor.prompt_text")}>
        <Textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder={t("rec.exam_editor.prompt_ph")}
          style={{ height: 88 }}
        />
      </Field>
      <Field label={t("rec.exam_editor.prompt_image")}>
        <FigureUpload
          slot="prompt"
          questionId={initial.id}
          path={promptImagePath}
          previewSize={112}
          onUploaded={setPromptImagePath}
          onCleared={() => setPromptImagePath(null)}
        />
      </Field>

      <div style={S.label}>{t("rec.exam_editor.options_label")}</div>
      <div
        role="radiogroup"
        aria-label={t("rec.exam_editor.correct")}
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        {/* Keyed by position: the key text is editable, so keying by it
            would remount the row (and drop focus) on every keystroke. */}
        {options.map((opt, i) => (
          <OptionEditor
            key={i}
            questionId={initial.id}
            option={opt}
            inTile={inTile}
            isCorrect={correct === opt.key}
            onMarkCorrect={() => setCorrect(opt.key)}
            onChange={(patch) => updateOption(i, patch)}
            onRemove={options.length > 2 ? () => removeOption(i) : null}
          />
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        <Btn small plain type="button" icon="plus" onClick={addOption}>
          {t("rec.exam_editor.add_option")}
        </Btn>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn small={!isMobile} primary type="submit" disabled={busy} busy={busy}>
          {busy ? t("rec.saving") : t("rec.exam_editor.save_btn")}
        </Btn>
        <Btn small={!isMobile} type="button" onClick={onCancel}>
          {t("rec.exam_editor.cancel_btn")}
        </Btn>
      </div>
      <ErrLine>{err}</ErrLine>
    </form>
  );
}

// One answer option: key, text, optional figure, and the "correct
// answer" radio. `inTile` — the form itself sits on a Tile, so the option
// uses the card surface to stay one distinct level.
function OptionEditor({ questionId, option, inTile, isCorrect, onMarkCorrect, onChange, onRemove }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  return (
    <Tile
      padding={isMobile ? "10px 10px" : "12px 12px"}
      style={isCorrect
        ? { background: C.selectedBg }
        : (inTile ? { background: C.panel } : null)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Input
          mono
          aria-label={t("rec.exam_editor.option_key")}
          value={option.key}
          onChange={(e) => onChange({ key: e.target.value })}
          style={{ width: 60, flexShrink: 0, textAlign: "center", paddingInline: 6 }}
        />
        <Input
          aria-label={t("rec.exam_editor.option_text")}
          value={option.text || ""}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder={t("rec.exam_editor.option_text_ph")}
          style={{ flex: 1, minWidth: 0 }}
        />
        {onRemove && (
          <IconButton
            icon="xmark"
            label={t("rec.exam_editor.remove_option")}
            size={isMobile ? 38 : 32}
            onClick={onRemove}
          />
        )}
      </div>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 10,
      }}>
        <FigureUpload
          slot={option.key}
          questionId={questionId}
          path={option.image_url}
          onUploaded={(path) => onChange({ image_url: path })}
          onCleared={() => onChange({ image_url: null })}
        />
        <CorrectRadio checked={isCorrect} onSelect={onMarkCorrect} />
      </div>
    </Tile>
  );
}

// "Correct answer" control — a radio across the options of one question.
function CorrectRadio({ checked, onSelect }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={!!checked}
      data-press="scale"
      onClick={onSelect}
      style={{
        all: "unset",
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        flexShrink: 0,
        minHeight: isMobile ? 34 : 30,
        paddingInline: "5px 12px",
        borderRadius: R.pill,
        cursor: "pointer",
        fontFamily: FONT,
        ...T.footnote,
        fontWeight: 600,
        background: checked ? C.badgeOk : C.fill,
        color: checked ? C.ok : C.dim,
      }}
    >
      <Checkbox checked={checked} tone="ok" size={20} />
      {checked ? t("rec.exam_editor.correct") : t("rec.exam_editor.mark_correct")}
    </button>
  );
}

function FigureUpload({ questionId, slot, path, previewSize = 64, onUploaded, onCleared }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
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
    <div style={{ minWidth: 0 }}>
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
      {/* Phones: the preview gets its own line so figures of any shape
          leave the buttons in one predictable row. */}
      <div style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        alignItems: isMobile ? "flex-start" : "center",
        flexWrap: isMobile ? "nowrap" : "wrap",
        gap: 8,
      }}>
        {url && <img src={url} alt="" style={figureStyle(previewSize)} />}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Btn small type="button" icon="upload" onClick={() => fileRef.current?.click()} disabled={busy} busy={busy}>
            {busy ? t("rec.exam_editor.uploading")
                  : (url ? t("rec.exam_editor.replace_image") : t("rec.exam_editor.upload_image"))}
          </Btn>
          {url && onCleared && (
            <Btn small plain type="button" onClick={onCleared}>{t("rec.exam_editor.clear_image")}</Btn>
          )}
        </div>
      </div>
      <ErrLine>{err}</ErrLine>
    </div>
  );
}
