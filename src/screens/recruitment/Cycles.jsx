// Z5 :: Recruitment Cycles (admin) — Phase C1.
// Three sub-views (list / create / detail) selected by local state.
// Detail surfaces the candidate-facing URL once the cycle is opened.

import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import { useIsMobile } from "../../useIsMobile";
import {
  PageHeader, Panel, Btn, Input, Textarea, Field, Badge, ErrLine, OkLine,
} from "../../ui";
import { C, FONT_MONO } from "../../theme";
import {
  listCycles, getCycle, createCycle, updateCycle, deleteCycle,
  beginCycle, regenerateToken, setCycleStatus, surveyUrlForCycle,
} from "../../data/recruitment";
import QuestionEditor from "./QuestionEditor";

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
  if (view === "detail" && activeId) {
    return (
      <CycleDetail
        cycleId={activeId}
        onBack={() => setView("list")}
        onEditQuestions={(name) => { setActiveName(name); setView("questions"); }}
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
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await listCycles();
      if (cancelled) return;
      if (error) setErr(error.message);
      else setCycles(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <PageHeader
        title={t("rec.cycles.title")}
        subtitle={t("rec.cycles.subtitle")}
        action={<Btn onClick={onNew}>{t("rec.cycles.new")}</Btn>}
      />
      <Panel connectTop>
        {loading && <div style={{ color: C.dim, fontSize: 14 }}>{t("common.loading")}</div>}
        {!loading && cycles.length === 0 && (
          <div style={{ color: C.dim, fontSize: 14 }}>{t("rec.cycles.empty")}</div>
        )}
        {!loading && cycles.map((c) => (
          <CycleRow key={c.id} cycle={c} onClick={() => onPick(c.id)} />
        ))}
        <ErrLine>{err}</ErrLine>
      </Panel>
    </>
  );
}

function CycleRow({ cycle, onClick }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        padding: "14px 16px",
        background: "transparent",
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        marginBottom: 10,
        textAlign: "start",
        cursor: "pointer",
        color: C.text,
        fontFamily: "inherit",
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          color: C.bright, fontWeight: 600, fontSize: 15, letterSpacing: "0.3px",
          marginBottom: 4,
        }}>{cycle.name}</div>
        <div style={{ fontSize: 12, color: C.dim }}>
          {cycle.starts_on || "—"}{cycle.ends_on ? ` → ${cycle.ends_on}` : ""}
        </div>
      </div>
      <Badge tone={statusTone(cycle.status)}>
        {t(`rec.cycle_status.${cycle.status}`)}
      </Badge>
    </button>
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
      <Panel connectTop>
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

function CycleDetail({ cycleId, onBack, onEditQuestions }) {
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
        <PageHeader title={t("common.loading")} />
        <Panel connectTop>
          <div style={{ color: C.dim, fontSize: 14 }}>{t("common.loading")}</div>
        </Panel>
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

      <Panel connectTop title={t("rec.cycles.access")}>
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

      {!isClosed && !isDraft && (
        <Panel title={t("rec.cycles.lifecycle")}>
          <div style={{ color: C.dim, fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
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
        </Panel>
      )}

      <Panel title={t("rec.cycles.questions")}>
        <div style={{ color: C.dim, fontSize: 13, marginBottom: 12, lineHeight: 1.6 }}>
          {t("rec.cycles.questions_help")}
        </div>
        <Btn small onClick={() => onEditQuestions(cycle.name)}>
          {t("rec.cycles.edit_questions")}
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

// ── Helpers ────────────────────────────────────────────────────────

function statusTone(s) {
  if (s === "open") return "ok";
  if (s === "draft") return "warn";
  if (s === "closed") return "default";
  return "bright"; // interviewing / exam
}
