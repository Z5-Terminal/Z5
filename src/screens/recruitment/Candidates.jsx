// Z5 :: Candidates (Recruitment) — Phase C3.
// Two sub-views: list (cycle + team + status + search filters, grouped
// by team) and detail (full survey responses + interview workflow).

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth";
import { useI18n } from "../../i18n";
import { useIsMobile } from "../../useIsMobile";
import {
  PageHeader, Panel, Btn, Input, Textarea, Field, Badge, ErrLine, OkLine,
} from "../../ui";
import { C, S, FONT_MONO } from "../../theme";
import {
  listCycles, listCandidates, getCandidateWithDetails, updateCandidate,
} from "../../data/recruitment";
import {
  listCandidateInterviews, upsertInterview,
} from "../../data/interviews";

const TEAMS = [1, 2, 3, 4];
const STATUSES = [
  "all",
  "survey_in_progress",
  "survey_done",
  "interviewed",
  "ready_for_exam",
  "exam_done",
  "accepted",
  "rejected",
];
const SECTION_ORDER = ["identity", "self_assessment", "background", "physical"];

export default function Candidates() {
  const [view, setView] = useState("list");
  const [activeId, setActiveId] = useState(null);

  if (view === "detail" && activeId) {
    return (
      <CandidateDetail
        candidateId={activeId}
        onBack={() => { setActiveId(null); setView("list"); }}
      />
    );
  }
  return (
    <CandidatesList
      onPick={(id) => { setActiveId(id); setView("detail"); }}
    />
  );
}

// ── List ───────────────────────────────────────────────────────────

function CandidatesList({ onPick }) {
  const { t } = useI18n();
  const [cycles, setCycles] = useState([]);
  const [cycleId, setCycleId] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [team, setTeam] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Load cycles once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await listCycles();
      if (cancelled) return;
      if (error) { setErr(error.message); setLoading(false); return; }
      const list = data || [];
      setCycles(list);
      // Default: first non-closed cycle, else most recent.
      const active = list.find((c) => c.status !== "draft" && c.status !== "closed");
      const fallback = active || list[0];
      if (fallback) setCycleId(fallback.id);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Reload candidates whenever cycle changes
  useEffect(() => {
    if (!cycleId) { setCandidates([]); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await listCandidates(cycleId);
      if (cancelled) return;
      if (error) { setErr(error.message); return; }
      setCandidates(data || []);
    })();
    return () => { cancelled = true; };
  }, [cycleId]);

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (team !== "all" && c.team !== Number(team)) return false;
      if (status !== "all" && c.status !== status) return false;
      if (search) {
        const q = search.toLowerCase();
        const inName = (c.full_name || "").toLowerCase().includes(q);
        const inId   = (c.personal_id || "").toLowerCase().includes(q);
        if (!inName && !inId) return false;
      }
      return true;
    });
  }, [candidates, team, status, search]);

  const grouped = useMemo(() => {
    const map = new Map(TEAMS.map((tt) => [tt, []]));
    const orphans = [];
    for (const c of filtered) {
      if (c.team && map.has(c.team)) map.get(c.team).push(c);
      else orphans.push(c);
    }
    return { map, orphans };
  }, [filtered]);

  const cycle = cycles.find((c) => c.id === cycleId);

  return (
    <>
      <PageHeader
        title={t("rec.candidates.title")}
        subtitle={cycle
          ? `${cycle.name} — ${filtered.length} / ${candidates.length}`
          : t("rec.candidates.subtitle")}
      />
      <Panel connectTop>
        <Field label={t("rec.candidates.cycle")}>
          <select
            value={cycleId}
            onChange={(e) => setCycleId(e.target.value)}
            style={{ ...S.input, fontSize: 14 }}
          >
            <option value="">—</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.status}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("rec.candidates.search")}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("rec.candidates.search_ph")}
          />
        </Field>

        <div style={{ marginBottom: 12 }}>
          <div style={{ ...S.label }}>{t("rec.candidates.team_filter")}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Btn small active={team === "all"} onClick={() => setTeam("all")}>
              {t("rec.candidates.all_teams")}
            </Btn>
            {TEAMS.map((tt) => (
              <Btn key={tt} small active={team === String(tt)} onClick={() => setTeam(String(tt))}>
                {t("rec.candidates.team")} {tt}
              </Btn>
            ))}
          </div>
        </div>

        <div>
          <div style={{ ...S.label }}>{t("rec.candidates.status_filter")}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {STATUSES.map((s) => (
              <Btn key={s} small active={status === s} onClick={() => setStatus(s)}>
                {s === "all"
                  ? t("rec.candidates.all_status")
                  : t(`rec.candidate_status.${s}`)}
              </Btn>
            ))}
          </div>
        </div>

        <ErrLine>{err}</ErrLine>
      </Panel>

      {loading && (
        <Panel><div style={{ color: C.dim }}>{t("common.loading")}</div></Panel>
      )}

      {!loading && filtered.length === 0 && (
        <Panel>
          <div style={{ color: C.dim, fontSize: 14, lineHeight: 1.6 }}>
            {candidates.length === 0
              ? t("rec.candidates.empty_cycle")
              : t("rec.candidates.empty_filtered")}
          </div>
        </Panel>
      )}

      {[...grouped.map.entries()].map(([teamNum, list]) => {
        if (list.length === 0) return null;
        return (
          <Panel key={teamNum} title={`${t("rec.candidates.team")} ${teamNum} (${list.length})`}>
            {list.map((c) => (
              <CandidateRow key={c.id} candidate={c} onClick={() => onPick(c.id)} />
            ))}
          </Panel>
        );
      })}
      {grouped.orphans.length > 0 && (
        <Panel title={t("rec.candidates.no_team")}>
          {grouped.orphans.map((c) => (
            <CandidateRow key={c.id} candidate={c} onClick={() => onPick(c.id)} />
          ))}
        </Panel>
      )}
    </>
  );
}

function CandidateRow({ candidate, onClick }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "12px 14px",
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        background: "transparent",
        marginBottom: 8,
        textAlign: "start",
        cursor: "pointer",
        color: C.text,
        fontFamily: "inherit",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: C.bright, fontSize: 14, fontWeight: 600,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{candidate.full_name || "—"}</div>
        <div style={{ fontSize: 12, color: C.dim, fontFamily: FONT_MONO, marginTop: 3 }}>
          {candidate.personal_id || "—"}
        </div>
      </div>
      <Badge tone={statusTone(candidate.status)}>
        {t(`rec.candidate_status.${candidate.status}`)}
      </Badge>
    </button>
  );
}

// ── Detail ────────────────────────────────────────────────────────

function CandidateDetail({ candidateId, onBack }) {
  const { t } = useI18n();
  const { profile } = useAuth();
  const [data, setData] = useState(null); // { candidate, questions, responses }
  const [interviews, setInterviews] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function refresh() {
    const [{ data: details, error: dErr }, { data: ivs, error: iErr }] = await Promise.all([
      getCandidateWithDetails(candidateId),
      listCandidateInterviews(candidateId),
    ]);
    if (dErr) { setErr(dErr.message || String(dErr)); return; }
    setData(details);
    if (iErr) setErr(iErr.message);
    else setInterviews(ivs || []);
  }

  useEffect(() => { refresh(); }, [candidateId]);

  function flash(setter, msg, ms = 2000) {
    setter(msg);
    setTimeout(() => setter(""), ms);
  }

  async function handleStatus(next, finalStatus) {
    setBusy(true); setErr(""); setOk("");
    const patch = { status: next };
    if (finalStatus !== undefined) patch.final_status = finalStatus;
    const { error } = await updateCandidate(candidateId, patch);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    flash(setOk, t("rec.candidate.status_updated"));
    await refresh();
  }

  if (!data) {
    return (
      <>
        <PageHeader title={t("common.loading")} action={<Btn small onClick={onBack}>← {t("rec.back")}</Btn>} />
        <Panel connectTop><div style={{ color: C.dim }}>{t("common.loading")}</div></Panel>
      </>
    );
  }

  const { candidate, questions, responses } = data;
  const responsesByQ = new Map(responses.map((r) => [r.question_id, r]));

  return (
    <>
      <PageHeader
        title={candidate.full_name || "—"}
        subtitle={`${t(`rec.candidate_status.${candidate.status}`)}`}
        action={<Btn small onClick={onBack}>← {t("rec.back")}</Btn>}
      />

      <Panel connectTop title={t("rec.candidate.summary")}>
        <SummaryRow label={t("rec.candidate.personal_id")}
          value={<span style={{ fontFamily: FONT_MONO }}>{candidate.personal_id || "—"}</span>} />
        <SummaryRow label={t("rec.candidate.team")}  value={candidate.team || "—"} />
        <SummaryRow label={t("rec.candidate.status")}
          value={<Badge tone={statusTone(candidate.status)}>{t(`rec.candidate_status.${candidate.status}`)}</Badge>} />
        {candidate.final_status && (
          <SummaryRow label={t("rec.candidate.final_status")}
            value={<Badge tone={candidate.final_status === "accepted" ? "ok" : "error"}>
              {t(`rec.final_status.${candidate.final_status}`)}
            </Badge>} />
        )}
        <ErrLine>{err}</ErrLine>
        <OkLine>{ok}</OkLine>
      </Panel>

      <SurveyResponses questions={questions} responsesByQ={responsesByQ} />

      <InterviewPanel
        candidateId={candidateId}
        interviews={interviews}
        currentUserId={profile?.id}
        currentUserCallsign={profile?.callsign}
        onSaved={refresh}
      />

      <Panel title={t("rec.candidate.actions")}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {candidate.status === "survey_done" && (
            <Btn small onClick={() => handleStatus("interviewed")} disabled={busy}>
              → {t("rec.candidate_status.interviewed")}
            </Btn>
          )}
          {candidate.status === "interviewed" && (
            <Btn small onClick={() => handleStatus("ready_for_exam")} disabled={busy}>
              → {t("rec.candidate_status.ready_for_exam")}
            </Btn>
          )}
          {(candidate.status === "exam_done" || candidate.status === "interviewed" || candidate.status === "ready_for_exam") && (
            <>
              <Btn small onClick={() => handleStatus("accepted", "accepted")} disabled={busy}>
                {t("rec.candidate.mark_accepted")}
              </Btn>
              <Btn small onClick={() => handleStatus("rejected", "rejected")} disabled={busy}>
                {t("rec.candidate.mark_rejected")}
              </Btn>
            </>
          )}
        </div>
      </Panel>
    </>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      padding: "8px 0",
      borderBottom: `1px solid ${C.border}`,
      fontSize: 14,
    }}>
      <div style={{
        color: C.dim, fontSize: 11, letterSpacing: "0.8px",
        textTransform: "uppercase", fontWeight: 600, flexShrink: 0,
      }}>{label}</div>
      <div style={{ color: C.text, textAlign: "end" }}>{value}</div>
    </div>
  );
}

// ── Survey responses (collapsible per section) ─────────────────────

function SurveyResponses({ questions, responsesByQ }) {
  const { t } = useI18n();
  const sections = SECTION_ORDER
    .map((key) => ({
      key,
      title: t(`rec.section.${key}`),
      questions: questions.filter((q) => q.section === key).sort((a, b) => a.ord - b.ord),
    }))
    .filter((s) => s.questions.length > 0);

  return (
    <>
      {sections.map((s) => (
        <SurveySection key={s.key} section={s} responsesByQ={responsesByQ} />
      ))}
    </>
  );
}

function SurveySection({ section, responsesByQ }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const answeredCount = section.questions.filter((q) => responsesByQ.has(q.id)).length;

  return (
    <Panel>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          all: "unset",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          cursor: "pointer",
          marginBottom: open ? 14 : 0,
        }}
      >
        <span style={{
          color: C.dimmer, fontSize: 12, width: 12, flexShrink: 0,
          transform: open ? "rotate(90deg)" : "none",
          transition: "transform 120ms",
        }}>▶</span>
        <span style={{
          color: C.bright, fontSize: 13, fontWeight: 600,
          letterSpacing: "1.2px", textTransform: "uppercase", flex: 1,
        }}>{section.title}</span>
        <span style={{ color: C.dim, fontSize: 12 }}>
          {answeredCount} / {section.questions.length}
        </span>
      </button>
      {open && section.questions.map((q) => (
        <ResponseRow key={q.id} question={q} response={responsesByQ.get(q.id)} />
      ))}
    </Panel>
  );
}

function ResponseRow({ question, response }) {
  let answer = "—";
  if (response) {
    if (question.question_type === "likert_5" && response.answer_value != null) {
      answer = `${response.answer_value} / 5`;
    } else if (response.answer_text) {
      answer = response.answer_text;
    } else if (response.answer_value != null) {
      answer = String(response.answer_value);
    }
  }
  return (
    <div style={{
      padding: "10px 0",
      borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{
        color: C.dim, fontSize: 12, lineHeight: 1.4, marginBottom: 4,
      }}>{question.question_text}</div>
      <div style={{
        color: response ? C.text : C.dim,
        fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap",
        fontStyle: response ? "normal" : "italic",
      }}>{answer}</div>
    </div>
  );
}

// ── Interview panel ────────────────────────────────────────────────

function InterviewPanel({ candidateId, interviews, currentUserId, currentUserCallsign, onSaved }) {
  const { t } = useI18n();
  const mine = interviews.find((i) => i.interviewer_id === currentUserId);
  const others = interviews.filter((i) => i.interviewer_id !== currentUserId);

  const [score, setScore] = useState(mine?.score ?? "");
  const [tagsText, setTagsText] = useState((mine?.tags || []).join(", "));
  const [notes, setNotes] = useState(mine?.notes || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // Sync local form state when refresh brings new data
  useEffect(() => {
    setScore(mine?.score ?? "");
    setTagsText((mine?.tags || []).join(", "));
    setNotes(mine?.notes || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine?.id]);

  async function save() {
    setBusy(true); setErr(""); setOk("");
    const tags = tagsText.split(",").map((s) => s.trim()).filter(Boolean);
    const { error } = await upsertInterview({
      candidateId,
      interviewerId: currentUserId,
      score: score === "" ? null : Number(score),
      tags,
      notes,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOk(t("rec.interview.saved"));
    setTimeout(() => setOk(""), 2000);
    onSaved && onSaved();
  }

  return (
    <Panel title={t("rec.interview.title")}>
      <div style={{ color: C.dim, fontSize: 12, marginBottom: 16, lineHeight: 1.6 }}>
        {t("rec.interview.subtitle")}
      </div>

      <Field label={`${t("rec.interview.your_interview")} · ${currentUserCallsign || ""}`}>
        <ScorePicker value={score} onChange={setScore} />
      </Field>
      <Field label={t("rec.interview.tags")}>
        <Input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder={t("rec.interview.tags_ph")}
        />
      </Field>
      <Field label={t("rec.interview.notes")}>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("rec.interview.notes_ph")}
        />
      </Field>
      <Btn primary onClick={save} disabled={busy}>
        {busy ? t("rec.saving") : t("rec.interview.save_btn")}
      </Btn>
      <ErrLine>{err}</ErrLine>
      <OkLine>{ok}</OkLine>

      {others.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ ...S.label, marginBottom: 10 }}>
            {t("rec.interview.others")}
          </div>
          {others.map((iv) => <OtherInterviewCard key={iv.id} interview={iv} />)}
        </div>
      )}
    </Panel>
  );
}

function ScorePicker({ value, onChange }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
        const active = Number(value) === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            style={{
              flex: isMobile ? "1 1 18%" : "0 0 auto",
              minWidth: 36,
              minHeight: 40,
              padding: "8px 10px",
              background: active ? C.bright : "transparent",
              color: active ? C.btnActiveColor : C.text,
              border: `1px solid ${active ? C.bright : C.border}`,
              borderRadius: 2,
              fontFamily: FONT_MONO,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >{n}</button>
        );
      })}
    </div>
  );
}

function OtherInterviewCard({ interview }) {
  const { t } = useI18n();
  const interviewer = interview.interviewer;
  return (
    <div style={{
      padding: "14px",
      border: `1px solid ${C.border}`,
      borderRadius: 4,
      marginBottom: 10,
      background: C.cardBg,
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 10, gap: 10, flexWrap: "wrap",
      }}>
        <div style={{
          fontFamily: FONT_MONO, fontSize: 13, color: C.bright,
          fontWeight: 600, letterSpacing: "0.5px",
        }}>
          {interviewer?.callsign || "—"}
          <span style={{ color: C.dim, fontWeight: 400, marginInlineStart: 8 }}>
            {interviewer?.full_name || ""}
          </span>
        </div>
        {interview.score != null && (
          <Badge tone="bright">
            {t("rec.interview.score")}: {interview.score} / 10
          </Badge>
        )}
      </div>
      {interview.tags && interview.tags.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {interview.tags.map((tag, i) => <Badge key={i}>{tag}</Badge>)}
        </div>
      )}
      {interview.notes && (
        <div style={{
          fontSize: 13, color: C.text, lineHeight: 1.6,
          whiteSpace: "pre-wrap",
        }}>{interview.notes}</div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function statusTone(s) {
  if (s === "accepted") return "ok";
  if (s === "rejected") return "error";
  if (s === "exam_done" || s === "interviewed" || s === "ready_for_exam") return "bright";
  if (s === "survey_done") return "warn";
  return "default";
}
