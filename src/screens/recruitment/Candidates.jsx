// Z5 :: Candidates (Recruitment).
// Two sub-views: list (cycle + team + status + search filters + sort
// dropdown — switches between team-grouped layout and ranked leaderboard
// layout depending on sort) and detail (survey responses + interview +
// exam + cycle links).

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth";
import { useI18n } from "../../i18n";
import { useIsMobile } from "../../useIsMobile";
import {
  PageHeader, Panel, Btn, Input, Textarea, Field, Badge, ErrLine, OkLine,
} from "../../ui";
import { C, S, FONT_MONO } from "../../theme";
import {
  listCycles, getCandidatesEnriched, getCandidateWithDetails, updateCandidate,
  getCandidateExam, examUrlFor, surveyUrlForCycle,
} from "../../data/recruitment";
import {
  listCandidateInterviews, upsertInterview,
} from "../../data/interviews";
import {
  uploadCandidatePhoto, candidatePhotoSignedUrl,
} from "../../data/avatars";
import {
  PREDEFINED_TAGS, tagLabel, tagTone,
} from "../../data/recruitmentTags";

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
const SORTS = ["newest", "name", "personal_id", "interview_score", "exam_score"];
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
  const [rows, setRows] = useState([]);          // enriched: { candidate, interviews, avgScore, examAttempt, ... }
  const [team, setTeam] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  // Load cycles once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await listCycles();
      if (cancelled) return;
      if (error) { setErr(error.message); setLoading(false); return; }
      const list = data || [];
      setCycles(list);
      const active = list.find((c) => c.status !== "draft" && c.status !== "closed");
      const fallback = active || list[0];
      if (fallback) setCycleId(fallback.id);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Reload enriched rows whenever cycle changes
  useEffect(() => {
    if (!cycleId) { setRows([]); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await getCandidatesEnriched(cycleId);
      if (cancelled) return;
      if (error) { setErr(error.message); return; }
      setErr("");
      setRows(data || []);
    })();
    return () => { cancelled = true; };
  }, [cycleId]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const c = r.candidate;
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
  }, [rows, team, status, search]);

  const sorted = useMemo(() => {
    const arr = filtered.slice();
    switch (sort) {
      case "name":
        arr.sort((a, b) =>
          (a.candidate.full_name || "").localeCompare(b.candidate.full_name || ""));
        break;
      case "personal_id":
        arr.sort((a, b) =>
          (a.candidate.personal_id || "").localeCompare(b.candidate.personal_id || ""));
        break;
      case "interview_score":
        arr.sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));
        break;
      case "exam_score":
        arr.sort((a, b) => (b.examAttempt?.score ?? -1) - (a.examAttempt?.score ?? -1));
        break;
      case "newest":
      default:
        arr.sort((a, b) =>
          new Date(b.candidate.created_at).getTime() -
          new Date(a.candidate.created_at).getTime());
    }
    return arr;
  }, [filtered, sort]);

  const isScoreSort = sort === "interview_score" || sort === "exam_score";

  // Team-grouped layout (for non-score sorts).
  const grouped = useMemo(() => {
    const map = new Map(TEAMS.map((tt) => [tt, []]));
    const orphans = [];
    for (const r of sorted) {
      const tn = r.candidate.team;
      if (tn && map.has(tn)) map.get(tn).push(r);
      else orphans.push(r);
    }
    return { map, orphans };
  }, [sorted]);

  const cycle = cycles.find((c) => c.id === cycleId);

  return (
    <>
      <PageHeader
        title={t("rec.candidates.title")}
        subtitle={cycle
          ? `${cycle.name} — ${filtered.length} / ${rows.length}`
          : t("rec.candidates.subtitle")}
      />
      <AcceptedCohortPanel rows={rows} onPick={onPick} />
      <Panel>
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

        <Field label={t("rec.candidates.sort")}>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={{ ...S.input, fontSize: 14 }}
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>{t(`rec.candidates.sort.${s}`)}</option>
            ))}
          </select>
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
            {rows.length === 0
              ? t("rec.candidates.empty_cycle")
              : t("rec.candidates.empty_filtered")}
          </div>
        </Panel>
      )}

      {isScoreSort && sorted.length > 0 && (
        <Panel title={t(`rec.candidates.sort.${sort}`)}>
          {sorted.map((row, idx) => (
            <LeaderboardRow
              key={row.candidate.id}
              row={row}
              rank={idx + 1}
              sortKey={sort}
              expanded={expandedId === row.candidate.id}
              onToggle={() => setExpandedId(
                expandedId === row.candidate.id ? null : row.candidate.id
              )}
              onOpen={() => onPick(row.candidate.id)}
            />
          ))}
        </Panel>
      )}

      {!isScoreSort && [...grouped.map.entries()].map(([teamNum, list]) => {
        if (list.length === 0) return null;
        return (
          <Panel key={teamNum} title={`${t("rec.candidates.team")} ${teamNum} (${list.length})`}>
            {list.map((r) => (
              <CandidateRow key={r.candidate.id} candidate={r.candidate} onClick={() => onPick(r.candidate.id)} />
            ))}
          </Panel>
        );
      })}
      {!isScoreSort && grouped.orphans.length > 0 && (
        <Panel title={t("rec.candidates.no_team")}>
          {grouped.orphans.map((r) => (
            <CandidateRow key={r.candidate.id} candidate={r.candidate} onClick={() => onPick(r.candidate.id)} />
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

// ── Accepted cohort panel ──────────────────────────────────────────
// Renders at the top of the Candidates list when one or more
// candidates have status='accepted'. A celebratory summary of the
// final pick — photo, name, personal_id + team, interview + exam
// score chips. Hidden when nobody's accepted yet.

function AcceptedCohortPanel({ rows, onPick }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const accepted = useMemo(
    () => rows.filter((r) => r.candidate.status === "accepted"),
    [rows]
  );
  if (accepted.length === 0) return null;
  return (
    <Panel title={`${t("rec.candidates.accepted_cohort")} (${accepted.length})`}>
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))",
        gap: isMobile ? 10 : 14,
      }}>
        {accepted.map((row) => (
          <AcceptedCard
            key={row.candidate.id}
            row={row}
            onClick={() => onPick(row.candidate.id)}
          />
        ))}
      </div>
    </Panel>
  );
}

function AcceptedCard({ row, onClick }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const { candidate, avgScore, examAttempt } = row;
  const [photoSrc, setPhotoSrc] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!candidate.photo_url) { setPhotoSrc(null); return; }
    candidatePhotoSignedUrl(candidate.photo_url).then((url) => {
      if (!cancelled) setPhotoSrc(url);
    });
    return () => { cancelled = true; };
  }, [candidate.photo_url]);

  const initials = (candidate.full_name || "?")
    .trim().split(/\s+/).slice(0, 2)
    .map((s) => s[0] || "").join("").toUpperCase() || "?";

  const avatarSize = isMobile ? 72 : 88;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: "unset",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: isMobile ? "14px 10px" : "18px 14px",
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        cursor: "pointer",
        textAlign: "center",
        minWidth: 0,
      }}
    >
      <div style={{
        width: avatarSize,
        height: avatarSize,
        borderRadius: "50%",
        background: C.inputBg,
        border: `1px solid ${C.borderBright}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        {photoSrc ? (
          <img src={photoSrc} alt="" style={{
            width: "100%", height: "100%", objectFit: "cover",
          }} />
        ) : (
          <div style={{
            fontSize: avatarSize * 0.36,
            color: C.dim,
            fontFamily: FONT_MONO,
            fontWeight: 700,
            letterSpacing: "1.5px",
          }}>{initials}</div>
        )}
      </div>

      <div style={{ width: "100%", minWidth: 0 }}>
        <div style={{
          color: C.bright,
          fontSize: isMobile ? 13 : 14,
          fontWeight: 700,
          letterSpacing: "0.3px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          marginBottom: 3,
        }}>{candidate.full_name || "—"}</div>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          color: C.dim,
          letterSpacing: "0.5px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {candidate.personal_id || "—"}
          {candidate.team ? ` · T${candidate.team}` : ""}
        </div>
      </div>

      <div style={{
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        justifyContent: "center",
        width: "100%",
      }}>
        <ScoreChip
          label={t("rec.candidates.avg_label")}
          value={avgScore != null ? avgScore.toFixed(1) : "—"}
          tone={scoreToneFromPct(avgScore, 10)}
        />
        <ScoreChip
          label={t("rec.candidates.exam_label")}
          value={examAttempt?.score != null && examAttempt?.total
            ? `${examAttempt.score}/${examAttempt.total}`
            : "—"}
          tone={examAttempt?.score != null && examAttempt?.total
            ? scoreToneFromPct(examAttempt.score, examAttempt.total)
            : "default"}
        />
      </div>
    </button>
  );
}

function ScoreChip({ label, value, tone }) {
  const tones = {
    ok:      { fg: C.ok,    border: C.badgeOkBorder,    bg: C.badgeOk },
    bright:  { fg: C.bright, border: C.borderBright,     bg: C.badgeBright },
    warn:    { fg: C.warn,  border: C.badgeWarnBorder,  bg: C.badgeWarn },
    default: { fg: C.dim,   border: C.border,           bg: "transparent" },
  };
  const c = tones[tone] || tones.default;
  return (
    <div style={{
      display: "inline-flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 1,
      padding: "5px 9px",
      border: `1px solid ${c.border}`,
      borderRadius: 2,
      background: c.bg,
      minWidth: 56,
    }}>
      <div style={{
        fontFamily: FONT_MONO,
        fontSize: 14,
        fontWeight: 700,
        color: c.fg,
        letterSpacing: "0.3px",
        lineHeight: 1,
      }}>{value}</div>
      <div style={{
        fontSize: 9,
        color: C.dim,
        letterSpacing: "0.8px",
        textTransform: "uppercase",
      }}>{label}</div>
    </div>
  );
}

function scoreToneFromPct(score, max) {
  if (score == null || !max) return "default";
  const pct = score / max;
  if (pct >= 0.8) return "ok";
  if (pct >= 0.5) return "bright";
  return "warn";
}

// ── Leaderboard row (used when sorted by interview / exam score) ────

function LeaderboardRow({ row, rank, sortKey, expanded, onToggle, onOpen }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const { candidate, avgScore, interviewCount, scoredCount, minScore, maxScore, tags, examAttempt } = row;

  const initials = (candidate.full_name || "?")
    .trim().split(/\s+/).slice(0, 2)
    .map((s) => s[0] || "").join("").toUpperCase() || "?";

  // Pick which score this sort cares about.
  const isExamSort = sortKey === "exam_score";
  const score = isExamSort ? (examAttempt?.score ?? null) : avgScore;
  const scoreMax = isExamSort ? (examAttempt?.total ?? null) : 10;
  const hasScore = score != null;
  const hasRange = !isExamSort && minScore != null && maxScore != null && minScore !== maxScore;

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 4,
      marginBottom: 10,
      background: C.cardBg,
      overflow: "hidden",
    }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          all: "unset",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 10 : 14,
          width: "100%",
          padding: isMobile ? "12px 12px" : "14px 16px",
          cursor: "pointer",
        }}
      >
        <div style={{
          flexShrink: 0,
          width: isMobile ? 30 : 36,
          textAlign: "center",
          fontFamily: FONT_MONO,
          fontSize: isMobile ? 13 : 15,
          fontWeight: 700,
          color: !hasScore ? C.dimmer : (rank <= 4 ? C.bright : C.dim),
        }}>
          {hasScore ? `#${rank}` : "—"}
        </div>

        <div style={{
          flexShrink: 0,
          width: isMobile ? 36 : 42,
          height: isMobile ? 36 : 42,
          borderRadius: "50%",
          background: C.inputBg,
          border: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT_MONO,
          fontSize: isMobile ? 12 : 13,
          fontWeight: 700,
          color: C.dim,
        }}>{initials}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: C.bright, fontSize: isMobile ? 14 : 15, fontWeight: 600,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{candidate.full_name || "—"}</div>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
            <span style={{ fontFamily: FONT_MONO }}>{candidate.personal_id || "—"}</span>
            {candidate.team ? ` · ${t("rec.candidates.team")} ${candidate.team}` : ""}
          </div>
          {tags.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
              {tags.slice(0, isMobile ? 2 : 4).map((tg) => (
                <Badge key={tg} tone={tagTone(tg)}>{tagLabel(tg, t)}</Badge>
              ))}
              {tags.length > (isMobile ? 2 : 4) && (
                <Badge>+{tags.length - (isMobile ? 2 : 4)}</Badge>
              )}
            </div>
          )}
        </div>

        <div style={{ flexShrink: 0, textAlign: "center", minWidth: isMobile ? 56 : 72 }}>
          <div style={{
            fontFamily: FONT_MONO,
            fontSize: isMobile ? 20 : 26,
            fontWeight: 700,
            color: scoreColor(score, scoreMax),
            lineHeight: 1,
          }}>
            {!hasScore ? "—"
              : isExamSort ? `${score} / ${scoreMax}`
              : score.toFixed(1)}
          </div>
          <div style={{
            fontSize: 10, color: C.dim, marginTop: 4,
            letterSpacing: "0.5px", textTransform: "uppercase",
          }}>
            {!hasScore ? t("rec.candidates.no_score_short")
              : isExamSort ? t("rec.candidates.exam_label")
              : t("rec.candidates.avg_label")}
          </div>
          {hasRange && (
            <div style={{ fontSize: 10, color: C.dimmer, marginTop: 2, fontFamily: FONT_MONO }}>
              {minScore}–{maxScore}
            </div>
          )}
        </div>

        <div style={{
          flexShrink: 0,
          color: C.dim,
          fontSize: 12,
          transform: expanded ? "rotate(90deg)" : "none",
          transition: "transform 120ms",
        }}>▶</div>
      </button>

      {expanded && (
        <div style={{
          borderTop: `1px solid ${C.border}`,
          padding: isMobile ? "12px" : "14px 16px",
        }}>
          <div style={{ ...S.label, marginBottom: 10 }}>
            {interviewCount === 1
              ? t("rec.candidates.one_interview")
              : t("rec.candidates.n_interviews", { n: interviewCount })}
            {scoredCount < interviewCount && (
              <span style={{ color: C.dimmer, fontWeight: 400 }}>
                {" "}· {t("rec.candidates.unscored", { n: interviewCount - scoredCount })}
              </span>
            )}
          </div>
          {row.interviews.length === 0 && (
            <div style={{ color: C.dim, fontSize: 13 }}>
              {t("rec.candidates.no_interviews_yet")}
            </div>
          )}
          {row.interviews.map((iv) => (
            <InterviewBreakdown key={iv.id} interview={iv} />
          ))}
          <div style={{ marginTop: 14 }}>
            <Btn small onClick={onOpen}>{t("rec.candidates.open_detail")} →</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function InterviewBreakdown({ interview }) {
  const { t } = useI18n();
  const interviewer = interview.interviewer;
  return (
    <div style={{
      padding: "10px 0",
      borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        marginBottom: interview.tags?.length || interview.notes ? 8 : 0,
        flexWrap: "wrap",
      }}>
        <span style={{
          fontFamily: FONT_MONO, fontSize: 13, color: C.bright,
          fontWeight: 600, letterSpacing: "0.5px",
        }}>
          {interviewer?.callsign || "—"}
        </span>
        {interviewer?.full_name && (
          <span style={{ fontSize: 12, color: C.dim }}>{interviewer.full_name}</span>
        )}
        <div style={{ flex: 1 }} />
        {interview.score != null && (
          <Badge tone={scoreToneBadge(interview.score)}>
            {interview.score} / 10
          </Badge>
        )}
      </div>
      {interview.tags && interview.tags.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
          {interview.tags.map((tg, i) => (
            <Badge key={i} tone={tagTone(tg)}>{tagLabel(tg, t)}</Badge>
          ))}
        </div>
      )}
      {interview.notes && (
        <div style={{
          fontSize: 13, color: C.text, lineHeight: 1.6, whiteSpace: "pre-wrap",
        }}>{interview.notes}</div>
      )}
    </div>
  );
}

// Score-to-colour mapping. `max` is the score scale (10 for interviews,
// total for exam) — we colour by percentage so an 8/17 exam reads "low"
// the same way a 2/10 interview does.
function scoreColor(score, max) {
  if (score == null) return C.dim;
  const pct = max ? score / max : score / 10;
  if (pct >= 0.8) return C.ok;
  if (pct >= 0.5) return C.bright;
  return C.warn;
}

function scoreToneBadge(score) {
  if (score == null) return "default";
  if (score >= 8) return "ok";
  if (score >= 5) return "bright";
  return "warn";
}

function CandidateDetail({ candidateId, onBack }) {
  const { t } = useI18n();
  const { profile } = useAuth();
  const [data, setData] = useState(null); // { candidate, cycle, questions, responses }
  const [interviews, setInterviews] = useState([]);
  const [examAttempt, setExamAttempt] = useState(null);
  const [photoSrc, setPhotoSrc] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function refresh() {
    const [
      { data: details, error: dErr },
      { data: ivs, error: iErr },
      { data: attempt },
    ] = await Promise.all([
      getCandidateWithDetails(candidateId),
      listCandidateInterviews(candidateId),
      getCandidateExam(candidateId),
    ]);
    if (dErr) { setErr(dErr.message || String(dErr)); return; }
    setData(details);
    if (iErr) setErr(iErr.message);
    else setInterviews(ivs || []);
    setExamAttempt(attempt || null);
    // Resolve a 24h signed URL for the candidate photo (private bucket)
    if (details?.candidate?.photo_url) {
      const url = await candidatePhotoSignedUrl(details.candidate.photo_url);
      setPhotoSrc(url);
    } else {
      setPhotoSrc(null);
    }
  }

  useEffect(() => { refresh(); }, [candidateId]);

  async function handlePhotoUpload(file) {
    setErr("");
    const { path, error } = await uploadCandidatePhoto(candidateId, file);
    if (error) { setErr(error.message || String(error)); return; }
    const { error: updErr } = await updateCandidate(candidateId, { photo_url: path });
    if (updErr) { setErr(updErr.message); return; }
    await refresh();
  }

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

  const { candidate, cycle, questions, responses } = data;
  const responsesByQ = new Map(responses.map((r) => [r.question_id, r]));

  async function handleToggleExamUnlock() {
    setBusy(true); setErr(""); setOk("");
    const { error } = await updateCandidate(candidateId, {
      exam_unlocked: !candidate.exam_unlocked,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    flash(setOk, t("rec.candidate.exam_unlock_updated"));
    await refresh();
  }

  async function copyExamUrl(url) {
    try {
      await navigator.clipboard.writeText(url);
      flash(setOk, t("rec.cycles.url_copied"));
    } catch {
      setErr(t("rec.cycles.url_copy_failed"));
    }
  }

  return (
    <>
      <PageHeader
        title={candidate.full_name || "—"}
        subtitle={`${t(`rec.candidate_status.${candidate.status}`)}`}
        action={<Btn small onClick={onBack}>← {t("rec.back")}</Btn>}
      />

      <CandidateHero
        candidate={candidate}
        photoSrc={photoSrc}
        onUpload={handlePhotoUpload}
      />

      {(err || ok) && (
        <Panel>
          <ErrLine>{err}</ErrLine>
          <OkLine>{ok}</OkLine>
        </Panel>
      )}

      <SurveyResponses questions={questions} responsesByQ={responsesByQ} />

      <InterviewPanel
        candidateId={candidateId}
        interviews={interviews}
        currentUserId={profile?.id}
        currentUserCallsign={profile?.callsign}
        onSaved={refresh}
      />

      <CycleLinksPanel
        cycle={cycle}
        onCopy={(url) => copyExamUrl(url)}
      />

      <ExamPanel
        candidate={candidate}
        cycle={cycle}
        attempt={examAttempt}
        busy={busy}
        onToggleUnlock={handleToggleExamUnlock}
        onCopyUrl={copyExamUrl}
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

// ── Candidate hero (profile-card style) ────────────────────────────

function CandidateHero({ candidate, photoSrc, onUpload }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const initials = (candidate.full_name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0] || "")
    .join("")
    .toUpperCase() || "?";

  async function handleFile(file) {
    if (!file) return;
    setUploading(true); setErr("");
    try {
      await onUpload(file);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setUploading(false);
    }
  }

  const photoSize = isMobile ? 96 : 112;

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      background: C.cardBg,
      padding: isMobile ? "20px 16px" : "24px",
      marginBottom: isMobile ? 14 : 18,
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      alignItems: "center",
      gap: isMobile ? 14 : 22,
    }}>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        title={t("rec.candidate.upload_photo")}
        style={{
          all: "unset",
          width: photoSize,
          height: photoSize,
          borderRadius: "50%",
          background: C.inputBg,
          border: `1px solid ${C.borderBright}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          flexShrink: 0,
          cursor: uploading ? "wait" : "pointer",
          position: "relative",
        }}
      >
        {photoSrc ? (
          <img
            src={photoSrc}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{
            fontSize: photoSize * 0.34,
            color: C.dim,
            fontFamily: FONT_MONO,
            fontWeight: 700,
            letterSpacing: "1.5px",
          }}>{initials}</div>
        )}
        {uploading && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 11, letterSpacing: "1px", textTransform: "uppercase",
          }}>{t("rec.candidate.uploading")}</div>
        )}
      </button>

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

      <div style={{
        flex: 1,
        minWidth: 0,
        textAlign: isMobile ? "center" : "start",
        width: "100%",
      }}>
        <div style={{
          fontSize: isMobile ? 18 : 22,
          color: C.bright,
          fontWeight: 700,
          letterSpacing: "0.5px",
          marginBottom: 6,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>{candidate.full_name || "—"}</div>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: 13,
          color: C.dim,
          marginBottom: 12,
          letterSpacing: "0.5px",
        }}>{candidate.personal_id || "—"}</div>
        <div style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          justifyContent: isMobile ? "center" : "flex-start",
          marginBottom: 14,
        }}>
          {candidate.team && (
            <Badge tone="bright">{t("rec.candidates.team")} {candidate.team}</Badge>
          )}
          <Badge tone={statusTone(candidate.status)}>
            {t(`rec.candidate_status.${candidate.status}`)}
          </Badge>
          {candidate.final_status && (
            <Badge tone={candidate.final_status === "accepted" ? "ok" : "error"}>
              {t(`rec.final_status.${candidate.final_status}`)}
            </Badge>
          )}
        </div>
        <Btn small onClick={() => fileRef.current?.click()} disabled={uploading}>
          {photoSrc ? t("rec.candidate.replace_photo") : t("rec.candidate.upload_photo")}
        </Btn>
        <ErrLine>{err}</ErrLine>
      </div>
    </div>
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

// ── Exam panel ─────────────────────────────────────────────────────

// ── Cycle links panel — surfaces the shared survey URL on this
// candidate's page so admins don't have to navigate back to Cycles. ─

function CycleLinksPanel({ cycle, onCopy }) {
  const { t } = useI18n();
  const surveyUrl = surveyUrlForCycle(cycle);
  if (!surveyUrl) {
    return (
      <Panel title={t("rec.candidate.cycle_links")}>
        <div style={{ color: C.dim, fontSize: 13, lineHeight: 1.6 }}>
          {t("rec.candidate.no_survey_url")}
        </div>
      </Panel>
    );
  }
  return (
    <Panel title={t("rec.candidate.cycle_links")}>
      <div style={{
        color: C.dim, fontSize: 12, marginBottom: 6,
        letterSpacing: "0.5px", textTransform: "uppercase",
      }}>
        {t("rec.candidate.shared_survey_url")}
      </div>
      <div style={{
        fontFamily: FONT_MONO, fontSize: 12,
        padding: "10px 12px", background: C.cardBg,
        border: `1px solid ${C.border}`, borderRadius: 3,
        wordBreak: "break-all", color: C.text, lineHeight: 1.5,
        marginBottom: 12,
      }}>{surveyUrl}</div>
      <Btn small onClick={() => onCopy(surveyUrl)}>
        {t("rec.candidate.copy_survey_url")}
      </Btn>
    </Panel>
  );
}

function ExamPanel({ candidate, cycle, attempt, busy, onToggleUnlock, onCopyUrl }) {
  const { t } = useI18n();
  const url = examUrlFor(cycle, candidate);
  const finished = attempt?.finished_at;
  const inProgress = attempt && !finished;

  return (
    <Panel title={t("rec.candidate.exam")}>
      {/* Score display first — most important info when present */}
      {finished && (
        <div style={{
          display: "flex", alignItems: "center", gap: 14, marginBottom: 14,
          padding: "14px 16px", border: `1px solid ${C.border}`,
          background: C.cardBg, borderRadius: 4,
        }}>
          <div style={{
            fontFamily: FONT_MONO, fontSize: 28, fontWeight: 700, color: C.bright,
          }}>{attempt.score} / {attempt.total}</div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 11, color: C.dim, letterSpacing: "0.8px",
              textTransform: "uppercase", fontWeight: 600,
            }}>{t("rec.candidate.exam_score")}</div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
              {new Date(attempt.finished_at).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {inProgress && (
        <div style={{
          padding: "10px 14px", background: C.warnBg || "rgba(255,204,85,0.08)",
          border: `1px solid ${C.warnBorderFaint}`, color: C.warn,
          borderRadius: 3, fontSize: 13, marginBottom: 14,
        }}>
          {t("rec.candidate.exam_in_progress_note")}
        </div>
      )}

      {!attempt && (
        <div style={{ color: C.dim, fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>
          {candidate.exam_unlocked
            ? t("rec.candidate.exam_unlocked_explainer")
            : t("rec.candidate.exam_locked_explainer")}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <Btn small onClick={onToggleUnlock} disabled={busy}>
          {candidate.exam_unlocked
            ? t("rec.candidate.lock_exam")
            : t("rec.candidate.unlock_exam")}
        </Btn>
        {candidate.exam_unlocked && url && (
          <Btn small onClick={() => onCopyUrl(url)}>{t("rec.candidate.copy_exam_url")}</Btn>
        )}
      </div>

      {candidate.exam_unlocked && url && (
        <div style={{
          fontFamily: FONT_MONO, fontSize: 12,
          padding: "10px 12px", background: C.cardBg,
          border: `1px solid ${C.border}`, borderRadius: 3,
          wordBreak: "break-all", color: C.text, lineHeight: 1.5,
        }}>{url}</div>
      )}

      {candidate.exam_unlocked && !url && (
        <div style={{ color: C.warn, fontSize: 12 }}>
          {t("rec.candidate.no_exam_url")}
        </div>
      )}
    </Panel>
  );
}

// ── Interview panel ────────────────────────────────────────────────

function InterviewPanel({ candidateId, interviews, currentUserId, currentUserCallsign, onSaved }) {
  const { t } = useI18n();
  const mine = interviews.find((i) => i.interviewer_id === currentUserId);
  const others = interviews.filter((i) => i.interviewer_id !== currentUserId);

  const [score, setScore] = useState(mine?.score ?? "");
  const [tags, setTags] = useState(Array.isArray(mine?.tags) ? mine.tags : []);
  const [notes, setNotes] = useState(mine?.notes || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // Sync local form state when refresh brings new data
  useEffect(() => {
    setScore(mine?.score ?? "");
    setTags(Array.isArray(mine?.tags) ? mine.tags : []);
    setNotes(mine?.notes || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine?.id]);

  async function save() {
    setBusy(true); setErr(""); setOk("");
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
        <TagPicker selected={tags} onChange={setTags} />
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
          {interview.tags.map((tag, i) => (
            <Badge key={i} tone={tagTone(tag)}>{tagLabel(tag, t)}</Badge>
          ))}
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

// ── Tag picker (predefined chips) ──────────────────────────────────

function TagPicker({ selected, onChange }) {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {PREDEFINED_TAGS.map((tag) => {
        const active = selected.includes(tag.key);
        const colors = chipColors(tag.tone, active);
        return (
          <button
            key={tag.key}
            type="button"
            onClick={() => {
              if (active) onChange(selected.filter((s) => s !== tag.key));
              else onChange([...selected, tag.key]);
            }}
            style={{
              padding: "7px 12px",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.4px",
              textTransform: "uppercase",
              background: colors.bg,
              color: colors.fg,
              border: `1px solid ${colors.border}`,
              borderRadius: 2,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "background 140ms ease-out, border-color 140ms ease-out",
            }}
          >
            {tagLabel(tag.key, t)}
          </button>
        );
      })}
    </div>
  );
}

function chipColors(tone, active) {
  if (!active) {
    return { bg: "transparent", fg: C.dim, border: C.border };
  }
  if (tone === "ok")   return { bg: C.badgeOk,   fg: C.ok,   border: C.badgeOkBorder };
  if (tone === "warn") return { bg: C.badgeWarn, fg: C.warn, border: C.badgeWarnBorder };
  return { bg: C.badgeBright, fg: C.bright, border: C.borderBright };
}

// ── Helpers ───────────────────────────────────────────────────────

function statusTone(s) {
  if (s === "accepted") return "ok";
  if (s === "rejected") return "error";
  if (s === "exam_done" || s === "interviewed" || s === "ready_for_exam") return "bright";
  if (s === "survey_done") return "warn";
  return "default";
}
