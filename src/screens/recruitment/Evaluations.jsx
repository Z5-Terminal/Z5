// Z5 :: Evaluations (Recruitment) — ranked interview results.
// Candidates ordered by average interview score, with their aggregated
// tags and an expandable per-interviewer breakdown. Candidates with no
// scored interview drop into a separate group at the bottom.

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n";
import { useIsMobile } from "../../useIsMobile";
import { PageHeader, Panel, Btn, Field, Badge, ErrLine } from "../../ui";
import { C, S, FONT_MONO } from "../../theme";
import { listCycles, getCycleEvaluations } from "../../data/recruitment";
import { tagLabel, tagTone } from "../../data/recruitmentTags";

const TEAMS = [1, 2, 3, 4];

export default function Evaluations() {
  const { t } = useI18n();
  const [cycles, setCycles] = useState([]);
  const [cycleId, setCycleId] = useState("");
  const [rows, setRows] = useState([]);
  const [team, setTeam] = useState("all");
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

  // Reload evaluation rows when cycle changes
  useEffect(() => {
    if (!cycleId) { setRows([]); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await getCycleEvaluations(cycleId);
      if (cancelled) return;
      if (error) { setErr(error.message); return; }
      setErr("");
      setRows(data || []);
    })();
    return () => { cancelled = true; };
  }, [cycleId]);

  // Apply the team filter, then split into ranked (has a scored
  // interview) and unranked (none yet).
  const { ranked, unranked } = useMemo(() => {
    const filtered = rows.filter((r) =>
      team === "all" ? true : r.candidate.team === Number(team)
    );
    const withScore = filtered.filter((r) => r.avgScore != null);
    const without   = filtered.filter((r) => r.avgScore == null);
    withScore.sort((a, b) => b.avgScore - a.avgScore);
    return { ranked: withScore, unranked: without };
  }, [rows, team]);

  const cycle = cycles.find((c) => c.id === cycleId);

  return (
    <>
      <PageHeader
        title={t("rec.evals.title")}
        subtitle={cycle ? cycle.name : t("rec.evals.subtitle")}
      />

      <Panel>
        <Field label={t("rec.evals.cycle")}>
          <select
            value={cycleId}
            onChange={(e) => setCycleId(e.target.value)}
            style={{ ...S.input, fontSize: 14 }}
          >
            <option value="">—</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>{c.name} · {c.status}</option>
            ))}
          </select>
        </Field>
        <div>
          <div style={{ ...S.label }}>{t("rec.evals.team_filter")}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Btn small active={team === "all"} onClick={() => setTeam("all")}>
              {t("rec.evals.all_teams")}
            </Btn>
            {TEAMS.map((tt) => (
              <Btn key={tt} small active={team === String(tt)} onClick={() => setTeam(String(tt))}>
                {t("rec.evals.team")} {tt}
              </Btn>
            ))}
          </div>
        </div>
        <ErrLine>{err}</ErrLine>
      </Panel>

      {loading && (
        <Panel><div style={{ color: C.dim }}>{t("common.loading")}</div></Panel>
      )}

      {!loading && ranked.length === 0 && unranked.length === 0 && (
        <Panel>
          <div style={{ color: C.dim, fontSize: 14 }}>{t("rec.evals.empty")}</div>
        </Panel>
      )}

      {ranked.length > 0 && (
        <Panel title={`${t("rec.evals.ranked")} (${ranked.length})`}>
          {ranked.map((row, idx) => (
            <EvalRow
              key={row.candidate.id}
              row={row}
              rank={idx + 1}
              expanded={expandedId === row.candidate.id}
              onToggle={() => setExpandedId(
                expandedId === row.candidate.id ? null : row.candidate.id
              )}
            />
          ))}
        </Panel>
      )}

      {unranked.length > 0 && (
        <Panel title={`${t("rec.evals.not_interviewed")} (${unranked.length})`}>
          {unranked.map((row) => (
            <EvalRow
              key={row.candidate.id}
              row={row}
              rank={null}
              expanded={expandedId === row.candidate.id}
              onToggle={() => setExpandedId(
                expandedId === row.candidate.id ? null : row.candidate.id
              )}
            />
          ))}
        </Panel>
      )}
    </>
  );
}

// ── Row ────────────────────────────────────────────────────────────

function EvalRow({ row, rank, expanded, onToggle }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const { candidate, avgScore, interviewCount, scoredCount, minScore, maxScore, tags } = row;

  const initials = (candidate.full_name || "?")
    .trim().split(/\s+/).slice(0, 2)
    .map((s) => s[0] || "").join("").toUpperCase() || "?";

  const hasRange = minScore != null && maxScore != null && minScore !== maxScore;

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
        {/* Rank */}
        <div style={{
          flexShrink: 0,
          width: isMobile ? 30 : 36,
          textAlign: "center",
          fontFamily: FONT_MONO,
          fontSize: isMobile ? 13 : 15,
          fontWeight: 700,
          color: rank == null ? C.dimmer : (rank <= 4 ? C.bright : C.dim),
        }}>
          {rank == null ? "—" : `#${rank}`}
        </div>

        {/* Initials avatar */}
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

        {/* Identity + tags */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: C.bright, fontSize: isMobile ? 14 : 15, fontWeight: 600,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{candidate.full_name || "—"}</div>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
            <span style={{ fontFamily: FONT_MONO }}>{candidate.personal_id || "—"}</span>
            {candidate.team ? ` · ${t("rec.evals.team")} ${candidate.team}` : ""}
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

        {/* Score */}
        <div style={{ flexShrink: 0, textAlign: "center", minWidth: isMobile ? 48 : 64 }}>
          <div style={{
            fontFamily: FONT_MONO,
            fontSize: isMobile ? 20 : 26,
            fontWeight: 700,
            color: scoreColor(avgScore),
            lineHeight: 1,
          }}>
            {avgScore == null ? "—" : avgScore.toFixed(1)}
          </div>
          <div style={{
            fontSize: 10, color: C.dim, marginTop: 4,
            letterSpacing: "0.5px", textTransform: "uppercase",
          }}>
            {avgScore == null ? t("rec.evals.no_score") : t("rec.evals.avg_score")}
          </div>
          {hasRange && (
            <div style={{ fontSize: 10, color: C.dimmer, marginTop: 2, fontFamily: FONT_MONO }}>
              {minScore}–{maxScore}
            </div>
          )}
        </div>

        {/* Expand chevron */}
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
          <div style={{
            ...S.label, marginBottom: 10,
          }}>
            {interviewCount === 1
              ? t("rec.evals.one_interview")
              : t("rec.evals.n_interviews", { n: interviewCount })}
            {scoredCount < interviewCount && (
              <span style={{ color: C.dimmer, fontWeight: 400 }}>
                {" "}· {t("rec.evals.unscored", { n: interviewCount - scoredCount })}
              </span>
            )}
          </div>
          {row.interviews.length === 0 && (
            <div style={{ color: C.dim, fontSize: 13 }}>
              {t("rec.evals.no_interviews_yet")}
            </div>
          )}
          {row.interviews.map((iv) => (
            <InterviewBreakdown key={iv.id} interview={iv} />
          ))}
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
          <Badge tone={scoreTone(interview.score)}>
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

// ── Helpers ────────────────────────────────────────────────────────

// Numeric colour for the big average-score readout.
function scoreColor(score) {
  if (score == null) return C.dim;
  if (score >= 8) return C.ok;
  if (score >= 5) return C.bright;
  return C.warn;
}

// Badge tone for an individual interview score.
function scoreTone(score) {
  if (score == null) return "default";
  if (score >= 8) return "ok";
  if (score >= 5) return "bright";
  return "warn";
}
