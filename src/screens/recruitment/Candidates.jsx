// Z5 :: Candidates (Recruitment).
// Two sub-views: list (cycle + team + status + search filters + sort
// dropdown — switches between team-grouped layout and ranked leaderboard
// layout depending on sort) and detail (survey responses + interview +
// exam + cycle links).

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth";
import { useI18n, fmtWhen } from "../../i18n";
import { useIsMobile } from "../../useIsMobile";
import {
  PageHeader, Panel, Tile, Divider, List, Row, Disclosure,
  Btn, IconButton, Input, Textarea, Select, Field, Chip, ChipRow, Switch, Checkbox,
  Badge, Mono, Num, Stat, Avatar, CopyField, Notice, ErrLine, OkLine,
  EmptyState, Skeleton, SkeletonRows, Spinner, ConfirmDialog, Menu, Lightbox,
  ViewTransition, Icon, ELLIPSIS, ABOVE_TABBAR, SIDEBAR_WIDTH,
} from "../../ui";
import { C, S, T, R, Z, FONT, MATERIAL, NUM } from "../../theme";
import { MOTION, DURATION } from "../../motion";
import {
  listCycles, getCandidatesEnriched, getCandidateWithDetails, updateCandidate,
  getCandidateExam, examUrlFor, surveyUrlForCycle, getRecommendationContext,
  combinedScore, listBootcampSquads, promoteCandidate,
  archiveCandidate, restoreCandidate, deleteCandidate,
  bulkUpdateCandidates, bulkArchiveCandidates, bulkDeleteCandidates,
} from "../../data/recruitment";
import { inviteErrorText } from "../../data/invites";
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
const SORTS = ["newest", "name", "personal_id", "interview_score", "exam_score", "combined_score", "recommendations"];
const SECTION_ORDER = ["identity", "self_assessment", "background", "physical"];
// Statuses offered by the bulk "change status" dropdown.
const BULK_STATUSES = ["interviewed", "ready_for_exam", "exam_done", "accepted", "rejected"];
// Every stage a candidate can be moved to from the detail screen. Unlike
// the quick-action buttons this is not one-directional — it's how a
// rejected (or accepted) candidate gets put back into the pipeline.
const ALL_STATUSES = [
  "survey_in_progress", "survey_done", "interviewed",
  "ready_for_exam", "exam_done", "accepted", "rejected",
];
// accepted/rejected are the only stages that carry a final decision;
// moving anywhere else clears it.
function finalStatusFor(status) {
  return status === "accepted" || status === "rejected" ? status : null;
}

// New content that appears in place rises in.
const RISE = `z5-rise ${DURATION.move}ms var(--z5-spring) backwards`;

// ── Score-to-tone helpers ───────────────────────────────────────────
// Tones are "ok" | "bright" | "warn" | "dim" and feed <Stat tone> and
// <Badge tone> ("bright"/"dim" fall back to the neutral ink / default).

// `max` is the score scale (10 for interviews, total for exam) — we tone
// by percentage so an 8/17 exam reads "low" the same way a 2/10 interview
// does.
function scoreTone(score, max) {
  if (score == null) return "dim";
  const pct = max ? score / max : score / 10;
  if (pct >= 0.8) return "ok";
  if (pct >= 0.5) return "bright";
  return "warn";
}

function scoreToneFromPct(score, max) {
  if (score == null || !max) return "dim";
  const pct = score / max;
  if (pct >= 0.8) return "ok";
  if (pct >= 0.5) return "bright";
  return "warn";
}

function scoreToneBadge(score) {
  if (score == null) return "default";
  if (score >= 8) return "ok";
  if (score >= 5) return "bright";
  return "warn";
}

// Recommendation counts have no ceiling to scale against, so they get
// their own absolute thresholds rather than going through scoreTone.
function recTone(n) {
  if (!n) return "dim";
  if (n >= 3) return "ok";
  return "bright";
}

function toneColor(tone) {
  if (tone === "ok") return C.ok;
  if (tone === "warn") return C.warn;
  if (tone === "dim") return C.dim;
  return C.bright;
}

function statusTone(s) {
  if (s === "accepted") return "ok";
  if (s === "rejected") return "error";
  if (s === "exam_done" || s === "interviewed" || s === "ready_for_exam") return "bright";
  if (s === "survey_done") return "warn";
  return "default";
}

// ── Small shared atoms ─────────────────────────────────────────────

// Quiet micro-label above a group of controls or chips.
function Label({ children, style }) {
  return <div style={{ ...S.label, ...style }}>{children}</div>;
}

// A labelled control; the <label> gives the field its accessible name.
function LabeledControl({ label, children }) {
  return (
    <label style={{ display: "block", minWidth: 0 }}>
      <div style={S.label}>{label}</div>
      {children}
    </label>
  );
}

// Panel title followed by a count capsule ("Team 1 (4)" without the
// parentheses; the capsule also keeps the two numbers apart in RTL).
function TitleCount({ label, n }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, maxWidth: "100%" }}>
      <span style={{ minWidth: 0, ...ELLIPSIS }}>{label}</span>
      <Badge><Num>{n}</Num></Badge>
    </span>
  );
}

// Free text someone typed (notes, survey answers). It may be in the other
// language, so it is isolated with its own detected direction: its
// punctuation lands on the right side while the block keeps the page's
// alignment.
function UserText({ children }) {
  return <span dir="auto" style={{ unicodeBidi: "isolate" }}>{children}</span>;
}

// Disclosure chevron for hand-built expandable rows: points along the
// reading direction when closed, down when open (same as <Disclosure>).
function ExpandChevron({ open }) {
  const { isRTL } = useI18n();
  return (
    <Icon
      name="chevronForward"
      size={14}
      strokeWidth={2.4}
      style={{
        flexShrink: 0,
        color: C.dimmer,
        transform: `rotate(${open ? 90 : (isRTL ? 180 : 0)}deg)`,
        transition: `transform ${MOTION.snap}`,
      }}
    />
  );
}

// Floating confirmation / error capsule. Sits where the bulk bar sits
// (above the tab bar on phones) so feedback is visible wherever the
// page happens to be scrolled.
function Toast({ tone = "ok", children, onDismiss }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  if (!children) return null;
  const isError = tone === "error";
  return (
    <div style={{
      position: "fixed",
      insetInlineStart: isMobile ? 12 : SIDEBAR_WIDTH,
      insetInlineEnd: isMobile ? 12 : 0,
      bottom: isMobile ? ABOVE_TABBAR : 24,
      zIndex: Z.toast,
      display: "flex",
      justifyContent: "center",
      paddingInline: isMobile ? 0 : 40,
      boxSizing: "border-box",
      pointerEvents: "none",
    }}>
      <div
        role={isError ? "alert" : "status"}
        data-material=""
        style={{
          pointerEvents: "auto",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 10,
          maxWidth: "min(100%, 520px)",
          minHeight: 44,
          paddingBlock: 8,
          paddingInline: onDismiss ? "14px 8px" : "14px 18px",
          borderRadius: R.xl,
          background: C.materialThick,
          ...MATERIAL.thick,
          border: `1px solid ${C.materialBorder}`,
          boxShadow: C.shadowLg,
          color: C.bright,
          ...T.callout,
          fontWeight: 600,
          animation: RISE,
        }}
      >
        <Icon
          name={isError ? "xCircle" : "checkCircle"}
          size={18}
          strokeWidth={2}
          style={{ flexShrink: 0, color: isError ? C.error : C.ok }}
        />
        <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{children}</span>
        {onDismiss && (
          <IconButton icon="xmark" label={t("common.close")} size={28} onClick={onDismiss} />
        )}
      </div>
    </div>
  );
}

// ── Photo avatar (signed URL) ──────────────────────────────────────
// Round thumbnail resolving the private-bucket photo via a signed URL
// (one cancellable effect per avatar). Falls back to initials. When a
// photo exists and onOpenPhoto is provided, tapping the avatar opens the
// lightbox instead of triggering the surrounding row.
function CandidateAvatar({ photoUrl, name, size = 40, onOpenPhoto }) {
  const { t } = useI18n();
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!photoUrl) { setSrc(null); return; }
    candidatePhotoSignedUrl(photoUrl).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => { cancelled = true; };
  }, [photoUrl]);

  const clickable = !!src && !!onOpenPhoto;
  if (!clickable) return <Avatar src={src} name={name} size={size} />;
  return (
    <button
      type="button"
      data-press="scale"
      aria-label={t("rec.candidate.view_photo")}
      title={t("rec.candidate.view_photo")}
      onClick={(e) => { e.stopPropagation(); onOpenPhoto(src); }}
      style={{
        all: "unset",
        display: "flex",
        flexShrink: 0,
        borderRadius: R.pill,
        cursor: "zoom-in",
      }}
    >
      <Avatar src={src} name={name} size={size} />
    </button>
  );
}

export default function Candidates() {
  const [view, setView] = useState("list");
  const [activeId, setActiveId] = useState(null);
  // Direction of the last navigation: deeper = push, back = pop. Null
  // until the first one so the screen doesn't animate on top of the
  // shell's own tab transition.
  const [kind, setKind] = useState(null);

  const inDetail = view === "detail" && !!activeId;
  return (
    <ViewTransition
      viewKey={inDetail ? `detail:${activeId}` : "list"}
      kind={kind || "tab"}
      style={kind ? undefined : { animation: "none" }}
    >
      {inDetail ? (
        <CandidateDetail
          candidateId={activeId}
          onBack={() => { setKind("pop"); setActiveId(null); setView("list"); }}
          onOpenCandidate={(id) => { setKind("push"); setActiveId(id); }}
        />
      ) : (
        <CandidatesList
          onPick={(id) => { setKind("push"); setActiveId(id); setView("detail"); }}
        />
      )}
    </ViewTransition>
  );
}

// ── List ───────────────────────────────────────────────────────────

function CandidatesList({ onPick }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [cycles, setCycles] = useState([]);
  const [cycleId, setCycleId] = useState("");
  const [rows, setRows] = useState([]);          // enriched: { candidate, interviews, avgScore, examAttempt, ... }
  // Cycle whose rows have arrived — lets the first load of a cycle show a
  // skeleton instead of a flash of "no candidates".
  const [loadedCycleId, setLoadedCycleId] = useState("");
  const [team, setTeam] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [minCombined, setMinCombined] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  // Archived filter + multi-select + bulk-action state
  const [showArchived, setShowArchived] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkBusy, setBulkBusy] = useState("");
  const [bulkErr, setBulkErr] = useState("");
  const [bulkOk, setBulkOk] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [lightboxSrc, setLightboxSrc] = useState(null);

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

  // Reload enriched rows whenever cycle / archived filter changes, or a
  // bulk action bumps refreshTick.
  useEffect(() => {
    if (!cycleId) { setRows([]); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await getCandidatesEnriched(cycleId, { includeArchived: showArchived });
      if (cancelled) return;
      setLoadedCycleId(cycleId);
      if (error) { setErr(error.message); return; }
      setErr("");
      const list = data || [];
      setRows(list);
      // Prune selection down to ids that still exist in the fresh list.
      setSelectedIds((prev) => {
        if (prev.size === 0) return prev;
        const alive = new Set(list.map((r) => r.candidate.id));
        return new Set([...prev].filter((id) => alive.has(id)));
      });
    })();
    return () => { cancelled = true; };
  }, [cycleId, showArchived, refreshTick]);

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
      // Combined-score threshold filter (only active on the combined sort).
      if (sort === "combined_score" && minCombined !== "") {
        const cs = combinedScore(r);
        if (cs == null || cs < Number(minCombined)) return false;
      }
      return true;
    });
  }, [rows, team, status, search, sort, minCombined]);

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
      case "combined_score":
        arr.sort((a, b) => (combinedScore(b) ?? -1) - (combinedScore(a) ?? -1));
        break;
      case "recommendations":
        // Most-recommended first; interview average breaks ties so the
        // ordering inside a tier still means something.
        arr.sort((a, b) =>
          (b.recommendationCount ?? 0) - (a.recommendationCount ?? 0) ||
          (b.avgScore ?? -1) - (a.avgScore ?? -1));
        break;
      case "newest":
      default:
        arr.sort((a, b) =>
          new Date(b.candidate.created_at).getTime() -
          new Date(a.candidate.created_at).getTime());
    }
    return arr;
  }, [filtered, sort]);

  const isScoreSort = sort === "interview_score" || sort === "exam_score"
    || sort === "combined_score" || sort === "recommendations";

  // Per-status counts within the current cycle + team + search scope
  // (the status filter itself is ignored so every chip stays informative).
  const statusCounts = useMemo(() => {
    const counts = { all: 0 };
    for (const r of rows) {
      const c = r.candidate;
      if (team !== "all" && c.team !== Number(team)) continue;
      if (search) {
        const q = search.toLowerCase();
        const inName = (c.full_name || "").toLowerCase().includes(q);
        const inId   = (c.personal_id || "").toLowerCase().includes(q);
        if (!inName && !inId) continue;
      }
      counts.all++;
      counts[c.status] = (counts[c.status] || 0) + 1;
    }
    return counts;
  }, [rows, team, search]);

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

  // ── Multi-select + bulk actions ──────────────────────────────────
  const [confirmBulk, setConfirmBulk] = useState(null); // "archive" | "delete" | null
  const selectedCount = selectedIds.size;

  function toggleSelectMode() {
    setSelectMode((m) => {
      if (m) setSelectedIds(new Set());
      return !m;
    });
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Toggle-select every row in `list` (a panel's rows, or all sorted
  // rows): select them all, or clear them if all are already selected.
  function selectAllIn(list) {
    setSelectedIds((prev) => {
      const ids = list.map((r) => r.candidate.id);
      const allIn = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      ids.forEach((id) => (allIn ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  async function runBulk(fn, okMsg) {
    const ids = [...selectedIds];
    if (ids.length === 0 || bulkBusy) return;
    setBulkBusy(true); setBulkErr(""); setBulkOk("");
    const { error } = await fn(ids);
    setBulkBusy(false);
    setConfirmBulk(null);
    if (error) { setBulkErr(error.message || String(error)); return; }
    setBulkOk(okMsg);
    setTimeout(() => setBulkOk(""), 2500);
    setSelectedIds(new Set());
    setRefreshTick((n) => n + 1);
  }

  function applyBulkStatus() {
    if (!bulkStatus) return;
    runBulk(
      (ids) => bulkUpdateCandidates(ids, { status: bulkStatus }),
      t("rec.candidates.bulk_done_ok", { ok: selectedCount })
    ).then(() => setBulkStatus(""));
  }

  function bulkExamLock(unlocked) {
    runBulk(
      (ids) => bulkUpdateCandidates(ids, { exam_unlocked: unlocked }),
      t("rec.candidates.bulk_done_ok", { ok: selectedCount })
    );
  }

  async function handleRestore(id) {
    setBulkErr(""); setBulkOk("");
    const { error } = await restoreCandidate(id);
    if (error) { setBulkErr(error.message || String(error)); return; }
    setBulkOk(t("rec.candidates.restored"));
    setTimeout(() => setBulkOk(""), 2500);
    setRefreshTick((n) => n + 1);
  }

  function clearFilters() {
    setTeam("all"); setStatus("all"); setSearch(""); setMinCombined("");
  }

  const rowProps = (r) => ({
    candidate: r.candidate,
    recommendationCount: r.recommendationCount || 0,
    onClick: () => onPick(r.candidate.id),
    selectMode,
    selected: selectedIds.has(r.candidate.id),
    onToggleSelect: () => toggleSelected(r.candidate.id),
    onOpenPhoto: (src) => setLightboxSrc(src),
    onRestore: () => handleRestore(r.candidate.id),
  });

  const bulkBarVisible = selectMode && selectedCount > 0;

  // The bar is fixed, so the page reserves exactly its height below the
  // last rows (it grows when its buttons wrap on a narrow window).
  const barRef = useRef(null);
  const [barHeight, setBarHeight] = useState(60);
  useEffect(() => {
    if (!bulkBarVisible) return;
    const el = barRef.current;
    if (!el) return;
    const measure = () => setBarHeight(el.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [bulkBarVisible]);

  const rowsPending = !!cycleId && loadedCycleId !== cycleId;
  const showSkeleton = loading || (rowsPending && rows.length === 0);
  const showEmpty = !loading && !rowsPending && filtered.length === 0;
  const showMinCombined = sort === "combined_score";

  const selectAllAction = (list) => (selectMode ? (
    <Btn small type="button" onClick={() => selectAllIn(list)}>
      {t("rec.candidates.select_all")}
    </Btn>
  ) : undefined);

  return (
    <>
      <PageHeader
        title={t("rec.candidates.title")}
        subtitle={cycle ? (
          <>
            <UserText>{cycle.name}</UserText>
            {!rowsPending && (
              <>
                <span aria-hidden style={{ color: C.dimmer, margin: "0 6px" }}>·</span>
                <Num>{`${filtered.length} / ${rows.length}`}</Num>
              </>
            )}
          </>
        ) : t("rec.candidates.subtitle")}
        action={cycles.length > 0 && (
          // Cycle = context switcher for the whole screen, so it lives in
          // the header rather than among the filters.
          <Select
            small={!isMobile}
            value={cycleId}
            onChange={(e) => setCycleId(e.target.value)}
            aria-label={t("rec.candidates.cycle")}
            wrapStyle={{ width: "auto", maxWidth: isMobile ? "calc(100vw - 36px)" : 280 }}
            style={{ width: "auto", maxWidth: "100%" }}
          >
            <option value="">—</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {t(`rec.cycle_status.${c.status}`)}
              </option>
            ))}
          </Select>
        )}
      />
      <AcceptedCohortPanel rows={rows} onPick={onPick} />

      {/* Filters: search + sort on one line, chip rows below, then the
          selection / archive toggles. */}
      <Panel>
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile
            ? "minmax(0, 1fr)"
            : `minmax(0, 1fr) 220px${showMinCombined ? " 220px" : ""}`,
          gap: isMobile ? 12 : 14,
          alignItems: "end",
        }}>
          <LabeledControl label={t("rec.candidates.search")}>
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("rec.candidates.search_ph")}
            />
          </LabeledControl>
          <LabeledControl label={t("rec.candidates.sort")}>
            <Select value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map((s) => (
                <option key={s} value={s}>{t(`rec.candidates.sort.${s}`)}</option>
              ))}
            </Select>
          </LabeledControl>
          {showMinCombined && (
            <LabeledControl label={t("rec.candidates.min_combined")}>
              <Input
                type="number"
                min="0"
                max="100"
                value={minCombined}
                onChange={(e) => setMinCombined(e.target.value)}
                placeholder={t("rec.candidates.min_combined_ph")}
                style={NUM}
              />
            </LabeledControl>
          )}
        </div>

        <ChipRow label={t("rec.candidates.team_filter")} style={{ marginTop: 16 }}>
          <Chip active={team === "all"} onClick={() => setTeam("all")}>
            {t("rec.candidates.all_teams")}
          </Chip>
          {TEAMS.map((tt) => (
            <Chip key={tt} active={team === String(tt)} onClick={() => setTeam(String(tt))}>
              {t("rec.candidates.team")} {tt}
            </Chip>
          ))}
        </ChipRow>

        <ChipRow label={t("rec.candidates.status_filter")} style={{ marginTop: 14 }}>
          {STATUSES.map((s) => {
            const n = s === "all" ? (statusCounts.all || 0) : (statusCounts[s] || 0);
            const empty = s !== "all" && n === 0;
            return (
              <Chip
                key={s}
                active={status === s}
                onClick={() => setStatus(s)}
                count={n}
                style={empty && status !== s ? { opacity: 0.45 } : undefined}
              >
                {s === "all"
                  ? t("rec.candidates.all_status")
                  : t(`rec.candidate_status.${s}`)}
              </Chip>
            );
          })}
        </ChipRow>

        <Divider style={{ margin: "16px 0 12px" }} />

        {/* Selection + archive controls */}
        <div style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}>
          <Chip
            active={selectMode}
            icon={selectMode ? "check" : "checkCircle"}
            onClick={toggleSelectMode}
          >
            {selectMode ? t("rec.candidates.select_done") : t("rec.candidates.select_mode")}
          </Chip>
          {selectMode && (
            <>
              <Btn small type="button" onClick={() => selectAllIn(sorted)}>
                {t("rec.candidates.select_all")}
              </Btn>
              {selectedCount > 0 && (
                <Btn small plain type="button" onClick={() => setSelectedIds(new Set())}>
                  {t("rec.candidates.clear_selection")}
                </Btn>
              )}
              <span style={{
                ...T.footnote,
                fontWeight: 600,
                color: selectedCount > 0 ? C.bright : C.dim,
                whiteSpace: "nowrap",
              }}>
                <Num>{t("rec.candidates.n_selected", { n: selectedCount })}</Num>
              </span>
            </>
          )}
          <span style={{ flex: 1 }} />
          <Switch
            checked={showArchived}
            onChange={(v) => setShowArchived(v)}
            label={t("rec.candidates.show_archived")}
          />
        </div>

        <ErrLine>{err || bulkErr}</ErrLine>
      </Panel>

      {showSkeleton && (
        <Panel><SkeletonRows rows={4} /></Panel>
      )}

      {showEmpty && (
        <Panel>
          {rows.length === 0 ? (
            <EmptyState icon="people" title={t("rec.candidates.empty_cycle")} />
          ) : (
            <EmptyState
              icon="filter"
              title={t("rec.candidates.empty_filtered")}
              action={
                <Btn small type="button" onClick={clearFilters}>
                  {t("rec.candidates.clear_filters")}
                </Btn>
              }
            />
          )}
        </Panel>
      )}

      {isScoreSort && sorted.length > 0 && (
        <Panel
          title={t(`rec.candidates.sort.${sort}`)}
          action={selectAllAction(sorted)}
        >
          <List>
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
                selectMode={selectMode}
                selected={selectedIds.has(row.candidate.id)}
                onToggleSelect={() => toggleSelected(row.candidate.id)}
                onOpenPhoto={(src) => setLightboxSrc(src)}
              />
            ))}
          </List>
        </Panel>
      )}

      {!isScoreSort && [...grouped.map.entries()].map(([teamNum, list]) => {
        if (list.length === 0) return null;
        return (
          <Panel
            key={teamNum}
            title={<TitleCount label={`${t("rec.candidates.team")} ${teamNum}`} n={list.length} />}
            action={selectAllAction(list)}
          >
            <List>
              {list.map((r) => (
                <CandidateRow key={r.candidate.id} {...rowProps(r)} />
              ))}
            </List>
          </Panel>
        );
      })}
      {!isScoreSort && grouped.orphans.length > 0 && (
        <Panel
          title={<TitleCount label={t("rec.candidates.no_team")} n={grouped.orphans.length} />}
          action={selectAllAction(grouped.orphans)}
        >
          <List>
            {grouped.orphans.map((r) => (
              <CandidateRow key={r.candidate.id} {...rowProps(r)} />
            ))}
          </List>
        </Panel>
      )}

      {/* Spacer so the fixed bulk bar never covers the last rows */}
      {bulkBarVisible && <div aria-hidden style={{ height: barHeight }} />}

      {/* Bulk action bar: a floating capsule over the list (above the
          tab bar on phones, clear of the sidebar on desktop). */}
      {bulkBarVisible && (
        <div style={{
          position: "fixed",
          insetInlineStart: isMobile ? 12 : SIDEBAR_WIDTH,
          insetInlineEnd: isMobile ? 12 : 0,
          bottom: isMobile ? ABOVE_TABBAR : 20,
          zIndex: Z.floating,
          display: "flex",
          justifyContent: "center",
          paddingInline: isMobile ? 0 : 40,
          boxSizing: "border-box",
          pointerEvents: "none",
        }}>
          <div
            ref={barRef}
            role="toolbar"
            aria-label={t("rec.candidates.n_selected", { n: selectedCount })}
            data-material=""
            style={{
              pointerEvents: "auto",
              boxSizing: "border-box",
              width: isMobile ? "100%" : "auto",
              maxWidth: "100%",
              padding: isMobile ? 8 : "10px 12px",
              background: C.materialThick,
              ...MATERIAL.thick,
              border: `1px solid ${C.materialBorder}`,
              borderRadius: R.xl,
              boxShadow: C.shadowLg,
              animation: RISE,
            }}
          >
            {bulkErr && (
              <Notice tone="error" style={{ marginBottom: 8 }}>{bulkErr}</Notice>
            )}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: isMobile ? "nowrap" : "wrap",
              justifyContent: "center",
            }}>
              <span style={{
                ...T.callout,
                fontWeight: 600,
                color: C.bright,
                whiteSpace: "nowrap",
                paddingInline: isMobile ? 6 : 8,
              }}>
                <Num>{t("rec.candidates.n_selected", { n: selectedCount })}</Num>
              </span>
              <Select
                small
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                aria-label={t("rec.candidates.bulk_status")}
                wrapStyle={isMobile ? { flex: 1, minWidth: 0 } : undefined}
                style={isMobile ? { minHeight: 44, width: "100%" } : { width: "auto", minWidth: 150 }}
              >
                <option value="">{t("rec.candidates.bulk_status_ph")}</option>
                {BULK_STATUSES.map((s) => (
                  <option key={s} value={s}>{t(`rec.candidate_status.${s}`)}</option>
                ))}
              </Select>
              <Btn
                small={!isMobile}
                compact
                type="button"
                onClick={applyBulkStatus}
                disabled={!!bulkBusy || !bulkStatus}
                style={isMobile ? { minHeight: 44, paddingInline: 14, flexShrink: 0 } : undefined}
              >
                {t("rec.candidates.bulk_apply")}
              </Btn>
              {isMobile ? (
                // 390px has room for one row only: the rest go in a menu.
                <Menu
                  items={[
                    { key: "unlock", label: t("rec.candidate.unlock_exam"), icon: "unlock", disabled: !!bulkBusy, onSelect: () => bulkExamLock(true) },
                    { key: "lock", label: t("rec.candidate.lock_exam"), icon: "lock", disabled: !!bulkBusy, onSelect: () => bulkExamLock(false) },
                    { key: "archive", label: t("rec.candidates.bulk_archive"), icon: "folder", disabled: !!bulkBusy, onSelect: () => setConfirmBulk("archive") },
                    { key: "delete", label: t("rec.candidates.bulk_delete"), icon: "trash", danger: true, disabled: !!bulkBusy, onSelect: () => setConfirmBulk("delete") },
                    "divider",
                    { key: "clear", label: t("rec.candidates.clear_selection"), icon: "xmark", onSelect: () => setSelectedIds(new Set()) },
                  ]}
                  trigger={(p) => <IconButton icon="ellipsis" label={t("common.more")} size={44} {...p} />}
                />
              ) : (
                <>
                  <span aria-hidden style={{ width: 1, height: 20, background: C.separator, marginInline: 4 }} />
                  <Btn small type="button" icon="unlock" onClick={() => bulkExamLock(true)} disabled={!!bulkBusy}>
                    {t("rec.candidate.unlock_exam")}
                  </Btn>
                  <Btn small type="button" icon="lock" onClick={() => bulkExamLock(false)} disabled={!!bulkBusy}>
                    {t("rec.candidate.lock_exam")}
                  </Btn>
                  <Btn small type="button" icon="folder" onClick={() => setConfirmBulk("archive")} disabled={!!bulkBusy}>
                    {t("rec.candidates.bulk_archive")}
                  </Btn>
                  <Btn small danger type="button" icon="trash" onClick={() => setConfirmBulk("delete")} disabled={!!bulkBusy}>
                    {t("rec.candidates.bulk_delete")}
                  </Btn>
                  <IconButton
                    icon="xmark"
                    label={t("rec.candidates.clear_selection")}
                    size={30}
                    onClick={() => setSelectedIds(new Set())}
                    style={{ marginInlineStart: 4 }}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <Toast>{bulkOk}</Toast>

      <ConfirmDialog
        open={confirmBulk === "archive"}
        title={t("rec.candidates.bulk_archive_title", { n: selectedCount })}
        message={t("rec.candidates.bulk_archive_body")}
        confirmLabel={t("rec.candidates.bulk_archive")}
        cancelLabel={t("common.cancel")}
        danger={false}
        busy={!!bulkBusy}
        onConfirm={() => runBulk(
          bulkArchiveCandidates,
          t("rec.candidates.bulk_archived", { n: selectedCount })
        )}
        onCancel={() => setConfirmBulk(null)}
      />
      <ConfirmDialog
        open={confirmBulk === "delete"}
        title={t("rec.candidates.bulk_delete_confirm", { n: selectedCount })}
        message={t("rec.candidates.bulk_delete_body")}
        confirmLabel={t("rec.candidates.bulk_delete")}
        cancelLabel={t("common.cancel")}
        busy={!!bulkBusy}
        onConfirm={() => runBulk(
          bulkDeleteCandidates,
          t("rec.candidates.bulk_deleted", { n: selectedCount })
        )}
        onCancel={() => setConfirmBulk(null)}
      />

      <Lightbox
        src={lightboxSrc}
        onClose={() => setLightboxSrc(null)}
        closeLabel={t("rec.candidate.close_photo")}
      />
    </>
  );
}

// Text field with a leading magnifier.
function SearchInput(props) {
  return (
    <div style={{ position: "relative" }}>
      <Icon
        name="search"
        size={16}
        strokeWidth={2}
        style={{
          position: "absolute",
          insetInlineStart: 12,
          top: "50%",
          marginTop: -8,
          color: C.dim,
          pointerEvents: "none",
        }}
      />
      <Input {...props} style={{ paddingInlineStart: 36, ...(props.style || {}) }} />
    </div>
  );
}

// List row. In select mode the whole row toggles selection; otherwise
// it opens the detail view. Rendered as a div[role=button] (not a
// <button>) because it nests interactive children (avatar, restore).
function CandidateRow({
  candidate, onClick, recommendationCount = 0,
  selectMode, selected, onToggleSelect, onOpenPhoto, onRestore,
}) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const archived = !!candidate.archived_at;
  const activate = selectMode ? onToggleSelect : onClick;
  const fade = archived ? 0.55 : 1;

  const statusBadge = (
    <Badge tone={statusTone(candidate.status)}>
      {t(`rec.candidate_status.${candidate.status}`)}
    </Badge>
  );
  const archivedBadge = archived
    ? <Badge tone="warn">{t("rec.candidates.archived")}</Badge>
    : null;
  const restoreBtn = archived && !selectMode && onRestore ? (
    <Btn
      small
      type="button"
      icon="undo"
      iconFlip
      onClick={(e) => { e.stopPropagation(); onRestore(); }}
    >
      {t("rec.candidates.restore")}
    </Btn>
  ) : null;
  const recChip = recommendationCount > 0
    ? <RecCountChip n={recommendationCount} compact={isMobile} />
    : null;

  // Desktop keeps every badge at the trailing edge; on phones the status
  // moves under the name (like mission rows) so the name keeps its room.
  const trailing = isMobile
    ? (recChip || restoreBtn ? <>{recChip}{restoreBtn}</> : null)
    : <>{archivedBadge}{restoreBtn}{recChip}{statusBadge}</>;

  return (
    <Row
      as="div"
      onClick={activate}
      selected={selected}
      aria-pressed={selectMode ? !!selected : undefined}
      chevron={!selectMode}
      leading={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {selectMode && <Checkbox checked={selected} />}
          <span style={{ display: "flex", opacity: fade }}>
            <CandidateAvatar
              photoUrl={candidate.photo_url}
              name={candidate.full_name}
              size={40}
              onOpenPhoto={selectMode ? undefined : onOpenPhoto}
            />
          </span>
        </div>
      }
      trailing={trailing}
    >
      <div style={{ ...T.body, fontWeight: 600, color: C.bright, opacity: fade, ...ELLIPSIS }}>
        {candidate.full_name || "—"}
      </div>
      {/* Wraps only when a phone row carries two badges (archived): the
          ID then drops to its own line instead of being squeezed out. */}
      <div style={{
        display: "flex", alignItems: "center", flexWrap: "wrap",
        columnGap: 8, rowGap: 3, marginTop: 2, minWidth: 0,
      }}>
        {isMobile && statusBadge}
        {isMobile && archivedBadge}
        <Mono style={{ fontSize: 13, color: C.dim, opacity: fade, minWidth: 0, ...ELLIPSIS }}>
          {candidate.personal_id || "—"}
        </Mono>
      </div>
    </Row>
  );
}

// ── Accepted cohort panel ──────────────────────────────────────────
// Renders at the top of the Candidates list when one or more
// candidates have status='accepted'. A summary of the final pick —
// photo, name, personal_id + team, interview + exam scores. Hidden when
// nobody's accepted yet.

function AcceptedCohortPanel({ rows, onPick }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const accepted = useMemo(
    () => rows.filter((r) => r.candidate.status === "accepted"),
    [rows]
  );
  if (accepted.length === 0) return null;
  return (
    <Panel title={<TitleCount label={t("rec.candidates.accepted_cohort")} n={accepted.length} />}>
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile
          ? "repeat(2, minmax(0, 1fr))"
          : "repeat(auto-fill, minmax(200px, 1fr))",
        gap: isMobile ? 10 : 12,
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
  const hasExam = examAttempt?.score != null && !!examAttempt?.total;

  return (
    <Tile
      onClick={onClick}
      padding={isMobile ? "16px 10px 14px" : "18px 14px 16px"}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        minWidth: 0,
        fontFamily: FONT,
      }}
    >
      <CandidateAvatar
        photoUrl={candidate.photo_url}
        name={candidate.full_name}
        size={isMobile ? 60 : 68}
      />
      <div style={{ width: "100%", minWidth: 0, marginTop: 10 }}>
        <div style={{ ...T.callout, fontWeight: 600, color: C.bright, ...ELLIPSIS }}>
          {candidate.full_name || "—"}
        </div>
        <div style={{ ...T.caption, color: C.dim, marginTop: 2, ...ELLIPSIS }}>
          <Mono>{candidate.personal_id || "—"}</Mono>
          {candidate.team ? (
            <>
              <span aria-hidden style={{ color: C.dimmer, margin: "0 5px" }}>·</span>
              {t("rec.candidates.team")} {candidate.team}
            </>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", width: "100%", marginTop: 12 }}>
        <Stat
          size="sm"
          align="center"
          value={avgScore != null ? avgScore.toFixed(1) : "—"}
          label={t("rec.candidates.avg_label")}
          tone={scoreToneFromPct(avgScore, 10)}
          style={{ flex: 1 }}
        />
        <span aria-hidden style={{ width: 1, background: C.separator, marginBlock: 4 }} />
        <Stat
          size="sm"
          align="center"
          value={hasExam ? `${examAttempt.score}/${examAttempt.total}` : "—"}
          label={t("rec.candidates.exam_label")}
          tone={hasExam ? scoreToneFromPct(examAttempt.score, examAttempt.total) : "dim"}
          style={{ flex: 1 }}
        />
      </div>
    </Tile>
  );
}

// Compact "how many people named this candidate" marker. Used in list
// rows and the hero. `compact` drops the word and keeps icon + number.
function RecCountChip({ n, compact }) {
  const { t } = useI18n();
  const title = t("rec.candidates.recs_title", { n });
  return (
    <span role="img" aria-label={title} title={title} style={{ display: "inline-flex", flexShrink: 0 }}>
      <Badge tone={n >= 3 ? "ok" : "bright"}>
        <Icon name="star" size={11} strokeWidth={2.2} />
        <Num>{n}</Num>
        {!compact && t("rec.candidates.recs_label")}
      </Badge>
    </span>
  );
}

// Tappable name capsule that jumps to that candidate's profile.
function NameChip({ label, onClick }) {
  const isMobile = useIsMobile();
  return (
    <button
      type="button"
      data-press="scale"
      onClick={onClick}
      style={{
        all: "unset",
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        maxWidth: "100%",
        minHeight: isMobile ? 34 : 28,
        paddingInline: "12px 8px",
        borderRadius: R.pill,
        background: C.fill,
        color: C.bright,
        fontFamily: FONT,
        ...T.footnote,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      <span style={{ minWidth: 0, ...ELLIPSIS }}>{label}</span>
      <Icon name="chevronForward" size={12} strokeWidth={2.4} flip style={{ flexShrink: 0, color: C.dimmer }} />
    </button>
  );
}

// Name chips for a set of candidates, optionally tappable so the reader
// can jump straight to the profile that was named.
function RecNameList({ people, emptyLabel, onOpen }) {
  if (!people || people.length === 0) {
    return <div style={{ ...T.footnote, color: C.dim }}>{emptyLabel}</div>;
  }
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {people.map((person) => {
        const label = person.full_name || "—";
        if (!onOpen) {
          return (
            <Badge key={person.id} tone="bright" style={{ maxWidth: "100%" }}>
              <span style={{ minWidth: 0, ...ELLIPSIS }}>{label}</span>
            </Badge>
          );
        }
        return <NameChip key={person.id} label={label} onClick={() => onOpen(person.id)} />;
      })}
    </div>
  );
}

// ── Leaderboard row (used when sorted by interview / exam score) ────

function LeaderboardRow({
  row, rank, sortKey, expanded, onToggle, onOpen,
  selectMode, selected, onToggleSelect, onOpenPhoto,
}) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const { candidate, avgScore, interviewCount, scoredCount, minScore, maxScore, tags, examAttempt } = row;
  const archived = !!candidate.archived_at;
  const activate = selectMode ? onToggleSelect : onToggle;

  // Pick which score this sort cares about.
  const isExamSort = sortKey === "exam_score";
  const isCombinedSort = sortKey === "combined_score";
  const isRecSort = sortKey === "recommendations";
  const combined = isCombinedSort ? combinedScore(row) : null;
  const recCount = row.recommendationCount || 0;
  const score = isRecSort ? recCount
    : isCombinedSort ? combined
    : isExamSort ? (examAttempt?.score ?? null)
    : avgScore;
  const scoreMax = isCombinedSort ? 100 : isExamSort ? (examAttempt?.total ?? null) : 10;
  const hasScore = score != null;
  // A zero recommendation count is a real value, but it shouldn't earn a
  // rank — nobody has named them, so they sit below the ranked set.
  const ranked = hasScore && (!isRecSort || recCount > 0);
  const hasRange = !isExamSort && !isCombinedSort && !isRecSort
    && minScore != null && maxScore != null && minScore !== maxScore;
  const maxTags = isMobile ? 2 : 4;

  const scoreLabel = !hasScore ? t("rec.candidates.no_score_short")
    : isRecSort ? t("rec.candidates.recs_label")
    : isCombinedSort ? t("rec.candidates.combined_label")
    : isExamSort ? t("rec.candidates.exam_label")
    : t("rec.candidates.avg_label");

  return (
    <div style={{ opacity: archived && !selected ? 0.55 : 1 }}>
      <Row
        as="div"
        onClick={activate}
        selected={selected}
        aria-expanded={selectMode ? undefined : expanded}
        aria-pressed={selectMode ? !!selected : undefined}
        style={{ paddingBlock: 12 }}
        leading={
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 12 }}>
            {selectMode && <Checkbox checked={selected} />}
            <span style={{
              width: isMobile ? 20 : 26,
              textAlign: "center",
              ...(isMobile ? T.callout : T.body),
              fontWeight: ranked && rank <= 4 ? 700 : 500,
              color: !ranked ? C.dimmer : (rank <= 4 ? C.bright : C.dim),
            }}>
              <Num>{ranked ? rank : "—"}</Num>
            </span>
            <CandidateAvatar
              photoUrl={candidate.photo_url}
              name={candidate.full_name}
              size={isMobile ? 36 : 42}
              onOpenPhoto={selectMode ? undefined : onOpenPhoto}
            />
          </div>
        }
        trailing={
          <>
            <Stat
              size={isMobile ? "sm" : "md"}
              align="end"
              tone={isRecSort ? recTone(recCount) : scoreTone(score, scoreMax)}
              value={!hasScore ? "—"
                : isRecSort || isCombinedSort ? String(score)
                : isExamSort ? `${score} / ${scoreMax}`
                : score.toFixed(1)}
              label={
                <>
                  {scoreLabel}
                  {hasRange && (
                    <>
                      <span aria-hidden style={{ color: C.dimmer, margin: "0 4px" }}>·</span>
                      <Num>{`${minScore}–${maxScore}`}</Num>
                    </>
                  )}
                </>
              }
              style={{ minWidth: isMobile ? 56 : 84 }}
            />
            {!selectMode && <ExpandChevron open={expanded} />}
          </>
        }
      >
        <div style={{ ...T.body, fontWeight: 600, color: C.bright, ...ELLIPSIS }}>
          {candidate.full_name || "—"}
        </div>
        <div style={{ ...T.footnote, color: C.dim, marginTop: 1, ...ELLIPSIS }}>
          <Mono>{candidate.personal_id || "—"}</Mono>
          {candidate.team ? (
            <>
              <span aria-hidden style={{ color: C.dimmer, margin: "0 6px" }}>·</span>
              {t("rec.candidates.team")} {candidate.team}
            </>
          ) : null}
        </div>
        {tags.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
            {tags.slice(0, maxTags).map((tg) => (
              <Badge key={tg} tone={tagTone(tg)}>{tagLabel(tg, t)}</Badge>
            ))}
            {tags.length > maxTags && (
              <Badge><Num>{`+${tags.length - maxTags}`}</Num></Badge>
            )}
          </div>
        )}
      </Row>

      {expanded && (
        <Tile style={{ marginTop: 2, marginBottom: 12, animation: RISE }}>
          <Label>
            {t("rec.candidate.recommended_by")}
            <Num style={{ margin: "0 6px", fontWeight: 600, color: toneColor(recTone(recCount)) }}>
              {recCount}
            </Num>
          </Label>
          <RecNameList
            people={row.recommendedBy}
            emptyLabel={t("rec.candidate.no_recommendations")}
          />
          {row.recommends?.length > 0 && (
            <>
              <Label style={{ marginTop: 12 }}>{t("rec.candidate.recommends")}</Label>
              <RecNameList people={row.recommends} emptyLabel="" />
            </>
          )}

          <Divider style={{ margin: "14px 0 12px" }} />

          <Label style={{ marginBottom: 2 }}>
            {interviewCount === 1
              ? t("rec.candidates.one_interview")
              : t("rec.candidates.n_interviews", { n: interviewCount })}
            {scoredCount < interviewCount && (
              <span style={{ color: C.dimmer, fontWeight: 400 }}>
                {" "}· {t("rec.candidates.unscored", { n: interviewCount - scoredCount })}
              </span>
            )}
          </Label>
          {row.interviews.length === 0 && (
            <div style={{ ...T.footnote, color: C.dim, marginTop: 6 }}>
              {t("rec.candidates.no_interviews_yet")}
            </div>
          )}
          <List>
            {row.interviews.map((iv) => (
              <div key={iv.id} style={{ padding: "10px 0" }}>
                <InterviewSummary interview={iv} />
              </div>
            ))}
          </List>
          <div style={{ marginTop: 10 }}>
            <Btn small type="button" onClick={onOpen} iconEnd="chevronForward" iconFlip>
              {t("rec.candidates.open_detail")}
            </Btn>
          </div>
        </Tile>
      )}
    </div>
  );
}

// One interviewer's record, read-only: who, score, tags, the names they
// recorded (when a name lookup is supplied) and their notes. Shown in the
// leaderboard drill-down and on the "other interviews" tiles.
function InterviewSummary({ interview, namesById }) {
  const { t } = useI18n();
  const interviewer = interview.interviewer;
  const hasTags = interview.tags && interview.tags.length > 0;
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0, ...ELLIPSIS }}>
          <Mono style={{ fontSize: T.callout.fontSize, fontWeight: 600, color: C.bright }}>
            {interviewer?.callsign || "—"}
          </Mono>
          {interviewer?.full_name && (
            <span style={{ ...T.footnote, color: C.dim, marginInlineStart: 8 }}>
              {interviewer.full_name}
            </span>
          )}
        </div>
        {interview.score != null && (
          <span title={t("rec.interview.score")} style={{ display: "inline-flex", flexShrink: 0 }}>
            <Badge tone={scoreToneBadge(interview.score)}>
              <Num>{`${interview.score} / 10`}</Num>
            </Badge>
          </span>
        )}
      </div>
      {hasTags && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
          {interview.tags.map((tg, i) => (
            <Badge key={i} tone={tagTone(tg)}>{tagLabel(tg, t)}</Badge>
          ))}
        </div>
      )}
      {namesById && <RecommendedNames ids={interview.recommended_ids} namesById={namesById} />}
      {interview.notes && (
        <div style={{
          ...T.callout, color: C.text, lineHeight: 1.55, marginTop: 8,
          whiteSpace: "pre-wrap", overflowWrap: "anywhere",
        }}><UserText>{interview.notes}</UserText></div>
      )}
    </>
  );
}

// ── Detail ────────────────────────────────────────────────────────

function CandidateDetail({ candidateId, onBack, onOpenCandidate }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const { profile } = useAuth();
  const [data, setData] = useState(null); // { candidate, cycle, questions, responses }
  const [interviews, setInterviews] = useState([]);
  const [examAttempt, setExamAttempt] = useState(null);
  const [recs, setRecs] = useState({ roster: [], incoming: [] });
  const [photoSrc, setPhotoSrc] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);

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
    // Recommendations are cycle-scoped, and the cycle id only arrives with
    // the candidate row — so this is a second hop, not part of the batch.
    const { data: recCtx } = await getRecommendationContext(
      candidateId, details?.candidate?.cycle_id
    );
    setRecs(recCtx || { roster: [], incoming: [] });
    // Resolve a 24h signed URL for the candidate photo (private bucket)
    if (details?.candidate?.photo_url) {
      const url = await candidatePhotoSignedUrl(details.candidate.photo_url);
      setPhotoSrc(url);
    } else {
      setPhotoSrc(null);
    }
  }

  // Jumping from profile to profile (via a recommendation chip) lands here with
  // a new id, so clear the previous candidate's state instead of showing
  // it under the new name while the fetch is in flight.
  useEffect(() => {
    setData(null);
    setInterviews([]);
    setExamAttempt(null);
    setRecs({ roster: [], incoming: [] });
    setPhotoSrc(null);
    setStatusDraft("");
    setErr(""); setOk("");
    if (typeof window !== "undefined") window.scrollTo(0, 0);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId]);

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

  // final_status is derived from the target stage rather than passed in,
  // so moving a rejected candidate back into the pipeline can't leave the
  // old decision badge stuck on their profile.
  async function handleStatus(next) {
    setBusy(true); setErr(""); setOk("");
    const { error } = await updateCandidate(candidateId, {
      status: next,
      final_status: finalStatusFor(next),
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setStatusDraft("");
    flash(setOk, t("rec.candidate.status_updated"));
    await refresh();
  }

  if (!data) {
    return (
      <>
        <PageHeader
          back={{ onClick: onBack }}
          title={<Skeleton width={isMobile ? 180 : 240} height={isMobile ? 28 : 34} />}
        />
        {err
          ? <Panel><Notice tone="error">{err}</Notice></Panel>
          : <DetailSkeleton />}
      </>
    );
  }

  const { candidate, cycle, questions, responses } = data;
  const responsesByQ = new Map(responses.map((r) => [r.question_id, r]));

  // Roster minus the candidate themselves — nobody recommends themselves.
  const pickableRoster = (recs.roster || []).filter((c) => c.id !== candidateId);
  const namesById = new Map((recs.roster || []).map((c) => [c.id, c.full_name]));
  // Union of every interviewer's picks for this candidate, deduped.
  const outgoingIds = [...new Set(
    interviews.flatMap((iv) => iv.recommended_ids || [])
  )].filter((id) => id !== candidateId);
  const outgoing = outgoingIds.map((id) => ({ id, full_name: namesById.get(id) || null }));

  const selectedStatus = statusDraft || candidate.status;
  const decided = candidate.status === "accepted" || candidate.status === "rejected";
  // Reopening drops a candidate back where they actually got to, so an
  // un-rejected candidate doesn't reappear as if they never sat the exam.
  const reopenTarget = examAttempt?.finished_at ? "exam_done" : "interviewed";
  const canDecide = candidate.status === "exam_done" || candidate.status === "interviewed"
    || candidate.status === "ready_for_exam";
  const hasQuickActions = candidate.status === "survey_done" || canDecide || decided;

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

  // Archive (soft) or restore, depending on the current state.
  async function handleArchiveToggle() {
    setBusy(true); setErr(""); setOk("");
    const wasArchived = !!candidate.archived_at;
    const { error } = wasArchived
      ? await restoreCandidate(candidateId)
      : await archiveCandidate(candidateId);
    setBusy(false);
    setConfirmArchive(false);
    if (error) { setErr(error.message || String(error)); return; }
    flash(setOk, wasArchived
      ? t("rec.candidates.restored")
      : t("rec.candidate.archived"));
    await refresh();
  }

  // PERMANENT delete (incl. survey responses, interviews, exam
  // attempts) — guarded by ConfirmDialog. Navigates back on success.
  async function handleDelete() {
    setBusy(true); setErr("");
    const { error } = await deleteCandidate(candidateId);
    setBusy(false);
    if (error) {
      setConfirmDelete(false);
      setErr(error.message || String(error));
      return;
    }
    onBack();
  }

  return (
    <>
      {/* The name is the page title (and the nav-bar title once it
          scrolls away); the hero card below carries photo and state. */}
      <PageHeader
        back={{ onClick: onBack }}
        title={candidate.full_name || "—"}
        subtitle={
          <>
            <Mono>{candidate.personal_id || "—"}</Mono>
            {cycle?.name ? (
              <>
                <span aria-hidden style={{ color: C.dimmer, margin: "0 6px" }}>·</span>
                <UserText>{cycle.name}</UserText>
              </>
            ) : null}
          </>
        }
      />

      <CandidateHero
        candidate={candidate}
        recommendationCount={recs.incoming?.length || 0}
        photoSrc={photoSrc}
        onUpload={handlePhotoUpload}
        onOpenPhoto={(src) => setLightboxSrc(src)}
      />

      <SurveyResponses questions={questions} responsesByQ={responsesByQ} />

      <InterviewPanel
        candidateId={candidateId}
        interviews={interviews}
        currentUserId={profile?.id}
        currentUserCallsign={profile?.callsign}
        roster={pickableRoster}
        namesById={namesById}
        onSaved={refresh}
      />

      <RecommendationsPanel
        incoming={recs.incoming}
        outgoing={outgoing}
        onOpenCandidate={onOpenCandidate}
      />

      <CycleLinksPanel cycle={cycle} />

      <ExamPanel
        candidate={candidate}
        cycle={cycle}
        attempt={examAttempt}
        busy={busy}
        onToggleUnlock={handleToggleExamUnlock}
      />

      <PromotePanel candidate={candidate} onPromoted={refresh} />

      <Panel title={t("rec.candidate.actions")}>
        {hasQuickActions && (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {candidate.status === "survey_done" && (
                <Btn type="button" iconEnd="arrowForward" iconFlip onClick={() => handleStatus("interviewed")} disabled={busy}>
                  {t("rec.candidate_status.interviewed")}
                </Btn>
              )}
              {candidate.status === "interviewed" && (
                <Btn type="button" iconEnd="arrowForward" iconFlip onClick={() => handleStatus("ready_for_exam")} disabled={busy}>
                  {t("rec.candidate_status.ready_for_exam")}
                </Btn>
              )}
              {canDecide && (
                <>
                  <Btn type="button" icon="checkCircle" onClick={() => handleStatus("accepted")} disabled={busy}>
                    {t("rec.candidate.mark_accepted")}
                  </Btn>
                  <Btn type="button" icon="xCircle" onClick={() => handleStatus("rejected")} disabled={busy}>
                    {t("rec.candidate.mark_rejected")}
                  </Btn>
                </>
              )}
              {/* One-click undo for a decided candidate — back to whichever
                  stage they actually reached, decision cleared. */}
              {decided && (
                <Btn type="button" icon="undo" iconFlip onClick={() => handleStatus(reopenTarget)} disabled={busy}>
                  {t("rec.candidate.reopen")}
                  <Icon name="arrowForward" size={14} strokeWidth={2} flip style={{ opacity: 0.55 }} />
                  {t(`rec.candidate_status.${reopenTarget}`)}
                </Btn>
              )}
            </div>
            <Divider style={{ margin: "16px 0" }} />
          </>
        )}

        {/* Free-form status control. The quick buttons above only move
            forward; this is how a candidate goes back to any stage. */}
        <Label>{t("rec.candidate.change_status")}</Label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Select
            value={selectedStatus}
            onChange={(e) => setStatusDraft(e.target.value)}
            aria-label={t("rec.candidate.change_status")}
            wrapStyle={{ flex: isMobile ? 1 : "0 1 260px", minWidth: 0 }}
          >
            {ALL_STATUSES.map((st) => (
              <option key={st} value={st}>{t(`rec.candidate_status.${st}`)}</option>
            ))}
          </Select>
          <Btn
            type="button"
            onClick={() => handleStatus(selectedStatus)}
            disabled={busy || selectedStatus === candidate.status}
            style={{ flexShrink: 0 }}
          >
            {t("rec.candidate.apply_status")}
          </Btn>
        </div>
        <div style={{ ...T.footnote, color: C.dim, marginTop: 10 }}>
          {t("rec.candidate.status_help")}
        </div>
      </Panel>

      {/* Danger zone: archive/restore (reversible) + permanent delete */}
      <Panel title={t("rec.candidate.danger_title")}>
        {candidate.archived_at ? (
          <Notice
            tone="warn"
            style={{ alignItems: "center" }}
            action={
              <Btn small type="button" icon="undo" iconFlip onClick={handleArchiveToggle} disabled={busy}>
                {t("rec.candidates.restore")}
              </Btn>
            }
          >
            {t("rec.candidate.archived_note")}
          </Notice>
        ) : (
          <DangerRow text={t("rec.candidate.archive_explainer")}>
            <Btn type="button" icon="folder" onClick={() => setConfirmArchive(true)} disabled={busy}>
              {t("rec.candidate.archive")}
            </Btn>
          </DangerRow>
        )}
        <Divider style={{ margin: "16px 0" }} />
        <DangerRow text={t("rec.candidate.delete_explainer")}>
          <Btn danger type="button" icon="trash" onClick={() => setConfirmDelete(true)} disabled={busy}>
            {t("rec.candidate.delete")}
          </Btn>
        </DangerRow>
      </Panel>

      <Toast>{ok}</Toast>
      {!ok && <Toast tone="error" onDismiss={() => setErr("")}>{err}</Toast>}

      <ConfirmDialog
        open={confirmArchive}
        title={t("rec.candidate.archive_confirm_title")}
        message={t("rec.candidate.archive_confirm_body", { name: candidate.full_name || "—" })}
        confirmLabel={t("rec.candidate.archive_confirm")}
        cancelLabel={t("common.cancel")}
        danger={false}
        busy={busy}
        onConfirm={handleArchiveToggle}
        onCancel={() => setConfirmArchive(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={t("rec.candidate.delete")}
        message={t("rec.candidate.delete_explainer")}
        confirmLabel={t("rec.candidate.delete_confirm")}
        cancelLabel={t("common.cancel")}
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <Lightbox
        src={lightboxSrc}
        alt={candidate.full_name || ""}
        onClose={() => setLightboxSrc(null)}
        closeLabel={t("rec.candidate.close_photo")}
      />
    </>
  );
}

// Explanation on the leading side, its action at the trailing edge
// (stacked on phones).
function DangerRow({ text, children }) {
  const isMobile = useIsMobile();
  return (
    <div style={{
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "center",
      gap: isMobile ? 12 : 20,
    }}>
      <div style={{ flex: 1, minWidth: 0, ...T.footnote, color: C.dim }}>{text}</div>
      <div style={{ flexShrink: 0, display: "flex" }}>{children}</div>
    </div>
  );
}

// Placeholder blocks while a candidate loads.
function DetailSkeleton() {
  const isMobile = useIsMobile();
  return (
    <div aria-busy="true">
      <Panel>
        <div style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: "center",
          gap: isMobile ? 14 : 22,
        }}>
          <Skeleton width={isMobile ? 96 : 88} height={isMobile ? 96 : 88} style={{ borderRadius: R.pill, flexShrink: 0 }} />
          <div style={{
            flex: 1, width: "100%", display: "flex", flexDirection: isMobile ? "column" : "row",
            alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <Skeleton width={isMobile ? "70%" : 280} height={22} style={{ borderRadius: R.pill }} />
            <Skeleton width={120} height={30} style={{ borderRadius: R.pill }} />
          </div>
        </div>
      </Panel>
      <Panel><SkeletonRows rows={4} /></Panel>
      <Panel>
        <Skeleton width="34%" height={17} style={{ marginBottom: 16 }} />
        <Skeleton height={40} style={{ borderRadius: R.md, marginBottom: 12 }} />
        <Skeleton height={96} style={{ borderRadius: R.md }} />
      </Panel>
    </div>
  );
}

// ── Promote-to-BootCamp bridge (Phase C5) ──────────────────────────
// Shown once a candidate is accepted. Bridges recruitment to bootcamp:
// pick a boot camp squad, mint a squad-scoped sniper invite, and hand
// the code to the candidate. Read-only summary once promoted.

function PromotePanel({ candidate, onPromoted }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [squads, setSquads] = useState([]);
  const [squadId, setSquadId] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    listBootcampSquads().then(({ data }) => {
      if (cancelled) return;
      const list = data || [];
      setSquads(list);
      if (list.length > 0) setSquadId(list[0].id);
    });
    return () => { cancelled = true; };
  }, []);

  if (candidate.status !== "accepted") return null;

  const promotedSquad = squads.find((s) => s.id === candidate.promoted_squad_id);

  async function handlePromote() {
    if (!squadId || !email.trim() || busy) return;
    setBusy(true); setErr("");
    const { error } = await promoteCandidate(candidate.id, squadId, email);
    setBusy(false);
    if (error) { setErr(inviteErrorText(error, t)); return; }
    onPromoted();
  }

  return (
    <Panel title={t("rec.candidate.promote_title")}>
      {candidate.promoted_squad_id ? (
        <>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            flexWrap: "wrap", marginBottom: 12,
          }}>
            <Badge tone="ok">
              <Icon name="check" size={11} strokeWidth={3} />
              {t("rec.candidate.promoted")}
            </Badge>
            <span style={{ ...T.headline, color: C.bright }}>
              {promotedSquad?.name || t("rec.candidate.promoted_squad")}
            </span>
            {candidate.promoted_at && (
              <span style={{ ...T.footnote, color: C.dim }}>
                <Num>{fmtWhen(candidate.promoted_at, t, { year: "numeric", month: "short", day: "numeric" })}</Num>
              </span>
            )}
          </div>
          {candidate.promote_invite_code && (
            <CopyField
              value={candidate.promote_invite_code}
              copyLabel={t("rec.candidate.copy_invite")}
              copiedLabel={t("common.copied")}
            />
          )}
          <div style={{ ...T.footnote, color: C.dim, marginTop: 12 }}>
            {t("rec.candidate.promote_done_hint")}
          </div>
        </>
      ) : squads.length === 0 ? (
        <div style={{ ...T.footnote, color: C.dim }}>
          {t("rec.candidate.no_bootcamp_squads")}
        </div>
      ) : (
        <>
          <div style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "flex-end",
            gap: 12,
          }}>
            <label style={{ display: "block", flex: isMobile ? undefined : "0 1 300px", minWidth: 0 }}>
              <div style={S.label}>{t("rec.candidate.promote_email")}</div>
              <Input type="email" autoComplete="off" autoCapitalize="none" dir="ltr"
                     value={email} onChange={(e) => setEmail(e.target.value)}
                     placeholder="name@example.com" />
            </label>
            <label style={{ display: "block", flex: isMobile ? undefined : "0 1 300px", minWidth: 0 }}>
              <div style={S.label}>{t("rec.candidate.promote_squad")}</div>
              <Select value={squadId} onChange={(e) => setSquadId(e.target.value)}>
                {squads.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </label>
            <Btn
              primary
              type="button"
              icon="graduation"
              busy={busy}
              onClick={handlePromote}
              disabled={busy || !squadId || !email.trim()}
              style={isMobile ? undefined : { minHeight: 40, paddingBlock: 8 }}
            >
              {t("rec.candidate.promote_action")}
            </Btn>
          </div>
          <div style={{ ...T.footnote, color: C.dim, marginTop: 12 }}>
            {t("rec.candidate.promote_hint")}
          </div>
          <ErrLine>{err}</ErrLine>
        </>
      )}
    </Panel>
  );
}

// ── Candidate hero ─────────────────────────────────────────────────
// Portrait (tap: full-size photo, or the file picker when there is none)
// plus the candidate's standing as badges. The name itself is the page
// title right above.

function CandidateHero({ candidate, photoSrc, onUpload, onOpenPhoto, recommendationCount = 0 }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

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

  const photoSize = isMobile ? 96 : 88;
  const canView = !!photoSrc && !!onOpenPhoto;
  const portraitLabel = canView
    ? t("rec.candidate.view_photo")
    : t("rec.candidate.upload_photo");

  return (
    <Panel>
      <div style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        alignItems: "center",
        gap: isMobile ? 14 : 22,
      }}>
        <button
          type="button"
          data-press="scale"
          data-press-depth="soft"
          // With a photo, tapping the portrait opens the full-size
          // lightbox; without one it opens the file picker.
          onClick={() => {
            if (uploading) return;
            if (canView) onOpenPhoto(photoSrc);
            else fileRef.current?.click();
          }}
          aria-busy={uploading || undefined}
          aria-label={portraitLabel}
          title={portraitLabel}
          style={{
            all: "unset",
            position: "relative",
            display: "flex",
            flexShrink: 0,
            borderRadius: R.pill,
            cursor: uploading ? "wait" : (canView ? "zoom-in" : "pointer"),
          }}
        >
          <Avatar src={photoSrc} name={candidate.full_name} size={photoSize} />
          {uploading && (
            <span style={{
              position: "absolute",
              inset: 0,
              borderRadius: R.pill,
              background: `${C.imageShade}0.5)`,
              color: C.imageOverlayText,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Spinner size={24} />
            </span>
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

        {/* Phones: badges then the photo action, centered under the
            portrait. Desktop: badges beside it, the action at the far edge. */}
        <div style={{
          flex: 1,
          minWidth: 0,
          width: "100%",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: isMobile ? 12 : 16,
        }}>
          <div style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            justifyContent: isMobile ? "center" : "flex-start",
          }}>
            {candidate.team && (
              <Badge tone="bright">{t("rec.candidates.team")} {candidate.team}</Badge>
            )}
            {candidate.archived_at && (
              <Badge tone="warn">{t("rec.candidates.archived")}</Badge>
            )}
            <Badge tone={statusTone(candidate.status)}>
              {t(`rec.candidate_status.${candidate.status}`)}
            </Badge>
            {/* The final decision normally mirrors the status badge next to
                it; show it only when the two actually differ. */}
            {candidate.final_status && candidate.final_status !== candidate.status && (
              <Badge tone={candidate.final_status === "accepted" ? "ok" : "error"}>
                {t(`rec.final_status.${candidate.final_status}`)}
              </Badge>
            )}
            {recommendationCount > 0 && <RecCountChip n={recommendationCount} />}
          </div>
          <Btn
            small
            type="button"
            icon="camera"
            busy={uploading}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading
              ? t("rec.candidate.uploading")
              : photoSrc ? t("rec.candidate.replace_photo") : t("rec.candidate.upload_photo")}
          </Btn>
        </div>
      </div>
      <ErrLine>{err}</ErrLine>
    </Panel>
  );
}

// ── Survey responses (one card, collapsible per section) ───────────

function SurveyResponses({ questions, responsesByQ }) {
  const { t } = useI18n();
  const sections = SECTION_ORDER
    .map((key) => ({
      key,
      title: t(`rec.section.${key}`),
      questions: questions.filter((q) => q.section === key).sort((a, b) => a.ord - b.ord),
    }))
    .filter((s) => s.questions.length > 0);

  if (sections.length === 0) return null;
  return (
    <Panel title={t("rec.candidate.survey_title")}>
      <List>
        {sections.map((s) => (
          <SurveySection key={s.key} section={s} responsesByQ={responsesByQ} />
        ))}
      </List>
    </Panel>
  );
}

function SurveySection({ section, responsesByQ }) {
  const answeredCount = section.questions.filter((q) => responsesByQ.has(q.id)).length;
  return (
    <Disclosure
      title={section.title}
      count={<Num>{`${answeredCount} / ${section.questions.length}`}</Num>}
    >
      {/* Answers line up under the section title (past the chevron). */}
      <List style={{ paddingInlineStart: 24 }}>
        {section.questions.map((q) => (
          <ResponseRow key={q.id} question={q} response={responsesByQ.get(q.id)} />
        ))}
      </List>
    </Disclosure>
  );
}

function ResponseRow({ question, response }) {
  let answer = "—";
  let numeric = false;
  if (response) {
    if (question.question_type === "likert_5" && response.answer_value != null) {
      answer = `${response.answer_value} / 5`;
      numeric = true;
    } else if (response.answer_text) {
      answer = response.answer_text;
    } else if (response.answer_value != null) {
      answer = String(response.answer_value);
      numeric = true;
    }
  }
  return (
    <div style={{ padding: "10px 0" }}>
      <div style={{ ...T.footnote, color: C.dim, marginBottom: 2, overflowWrap: "anywhere" }}>
        {question.question_text}
      </div>
      <div style={{
        ...T.body,
        color: response ? C.text : C.dimmer,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
      }}>
        {numeric ? <Num>{answer}</Num> : response ? <UserText>{answer}</UserText> : answer}
      </div>
    </div>
  );
}

// ── Cycle links panel — surfaces the shared survey URL on this
// candidate's page so admins don't have to navigate back to Cycles. ─

function CycleLinksPanel({ cycle }) {
  const { t } = useI18n();
  const surveyUrl = surveyUrlForCycle(cycle);
  if (!surveyUrl) {
    return (
      <Panel title={t("rec.candidate.cycle_links")}>
        <div style={{ ...T.footnote, color: C.dim }}>
          {t("rec.candidate.no_survey_url")}
        </div>
      </Panel>
    );
  }
  return (
    <Panel title={t("rec.candidate.cycle_links")}>
      <Label>{t("rec.candidate.shared_survey_url")}</Label>
      <CopyField
        value={surveyUrl}
        copyLabel={t("common.copy")}
        copiedLabel={t("common.copied")}
      />
    </Panel>
  );
}

// ── Exam panel ─────────────────────────────────────────────────────

function ExamPanel({ candidate, cycle, attempt, busy, onToggleUnlock }) {
  const { t } = useI18n();
  const url = examUrlFor(cycle, candidate);
  const finished = attempt?.finished_at;
  const inProgress = attempt && !finished;

  return (
    <Panel title={t("rec.candidate.exam")}>
      {/* Score display first — most important info when present */}
      {finished && (
        <>
          <Stat
            value={`${attempt.score} / ${attempt.total}`}
            label={
              <>
                {t("rec.candidate.exam_score")}
                <span aria-hidden style={{ color: C.dimmer, margin: "0 6px" }}>·</span>
                <Num>{fmtWhen(attempt.finished_at, t)}</Num>
              </>
            }
          />
          <Divider style={{ margin: "14px 0 10px" }} />
        </>
      )}

      {inProgress && (
        <Notice tone="warn" icon="clock" style={{ marginBottom: 10 }}>
          {t("rec.candidate.exam_in_progress_note")}
        </Notice>
      )}

      <Switch
        checked={!!candidate.exam_unlocked}
        onChange={onToggleUnlock}
        disabled={busy}
        label={t("rec.candidate.exam_unlocked_label")}
      />

      {!attempt && (
        <div style={{ ...T.footnote, color: C.dim, marginTop: 6 }}>
          {candidate.exam_unlocked
            ? t("rec.candidate.exam_unlocked_explainer")
            : t("rec.candidate.exam_locked_explainer")}
        </div>
      )}

      {candidate.exam_unlocked && url && (
        <CopyField
          value={url}
          copyLabel={t("common.copy")}
          copiedLabel={t("common.copied")}
          style={{ marginTop: 12 }}
        />
      )}

      {candidate.exam_unlocked && !url && (
        <Notice tone="warn" style={{ marginTop: 12 }}>
          {t("rec.candidate.no_exam_url")}
        </Notice>
      )}
    </Panel>
  );
}

// ── Interview panel ────────────────────────────────────────────────

// Up to 3 other candidates from the same cycle can be named per interview.
// The cap is enforced here, in upsertInterview, and by a check constraint
// on the table.
const MAX_RECOMMENDATIONS = 3;

function InterviewPanel({
  candidateId, interviews, currentUserId, currentUserCallsign,
  roster = [], namesById, onSaved,
}) {
  const { t } = useI18n();
  const mine = interviews.find((i) => i.interviewer_id === currentUserId);
  const others = interviews.filter((i) => i.interviewer_id !== currentUserId);

  const [score, setScore] = useState(mine?.score ?? "");
  const [tags, setTags] = useState(Array.isArray(mine?.tags) ? mine.tags : []);
  const [notes, setNotes] = useState(mine?.notes || "");
  const [recommended, setRecommended] = useState(
    Array.isArray(mine?.recommended_ids) ? mine.recommended_ids : []
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // Sync local form state when refresh brings new data
  useEffect(() => {
    setScore(mine?.score ?? "");
    setTags(Array.isArray(mine?.tags) ? mine.tags : []);
    setNotes(mine?.notes || "");
    setRecommended(Array.isArray(mine?.recommended_ids) ? mine.recommended_ids : []);
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
      recommendedIds: recommended,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOk(t("rec.interview.saved"));
    setTimeout(() => setOk(""), 2000);
    onSaved && onSaved();
  }

  return (
    <Panel title={t("rec.interview.title")}>
      <div style={{ ...T.footnote, color: C.dim, marginBottom: 16 }}>
        {t("rec.interview.subtitle")}
      </div>

      <Field label={
        <>
          {t("rec.interview.your_interview")}
          {currentUserCallsign ? (
            <>
              <span aria-hidden style={{ color: C.dimmer, margin: "0 6px" }}>·</span>
              <Mono>{currentUserCallsign}</Mono>
            </>
          ) : null}
        </>
      }>
        <ScorePicker value={score} onChange={setScore} />
      </Field>
      <Field label={t("rec.interview.tags")}>
        <TagPicker selected={tags} onChange={setTags} />
      </Field>
      <Field
        label={
          <>
            {t("rec.interview.recommendations")}
            <span aria-hidden style={{ color: C.dimmer, margin: "0 6px" }}>·</span>
            <Num>{`${recommended.length}/${MAX_RECOMMENDATIONS}`}</Num>
          </>
        }
      >
        <div style={{ ...T.footnote, color: C.dim, marginBottom: 10 }}>
          {t("rec.interview.recommendations_hint")}
        </div>
        <RecommendPicker
          roster={roster}
          selected={recommended}
          onChange={setRecommended}
        />
      </Field>
      <Field label={t("rec.interview.notes")}>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("rec.interview.notes_ph")}
          aria-label={t("rec.interview.notes")}
        />
      </Field>
      <Btn primary type="button" onClick={save} disabled={busy} busy={busy}>
        {busy ? t("rec.saving") : t("rec.interview.save_btn")}
      </Btn>
      <ErrLine>{err}</ErrLine>
      <OkLine>{ok}</OkLine>

      {others.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <Label style={{ marginBottom: 8 }}>{t("rec.interview.others")}</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {others.map((iv) => (
              <Tile key={iv.id}>
                <InterviewSummary interview={iv} namesById={namesById} />
              </Tile>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

// Search-and-pick over the cycle roster. The result list only renders once
// something is typed, so the panel stays short on mobile; picked names sit
// above as numbered, removable chips.
function RecommendPicker({ roster, selected, onChange }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(roster.map((c) => [c.id, c])), [roster]);
  const full = selected.length >= MAX_RECOMMENDATIONS;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return roster
      .filter((c) => !selected.includes(c.id))
      .filter((c) =>
        (c.full_name || "").toLowerCase().includes(q) ||
        (c.personal_id || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [roster, selected, query]);

  function pick(id) {
    if (full || selected.includes(id)) return;
    onChange([...selected, id]);
    setQuery("");
  }

  return (
    <>
      {selected.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {selected.map((id, i) => {
            const name = byId.get(id)?.full_name || t("rec.interview.rec_unknown");
            return (
              <span
                key={id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  maxWidth: "100%",
                  minHeight: 34,
                  boxSizing: "border-box",
                  paddingBlock: 3,
                  paddingInline: "12px 4px",
                  background: C.fill,
                  color: C.bright,
                  borderRadius: R.pill,
                  ...T.footnote,
                  fontWeight: 600,
                }}
              >
                <Num style={{ color: C.dim, fontWeight: 500 }}>{i + 1}</Num>
                <span style={{ minWidth: 0, ...ELLIPSIS }}>{name}</span>
                <button
                  type="button"
                  data-press="scale"
                  data-press-depth="deep"
                  onClick={() => onChange(selected.filter((x) => x !== id))}
                  aria-label={`${t("common.remove")} — ${name}`}
                  title={t("common.remove")}
                  style={{
                    all: "unset",
                    boxSizing: "border-box",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    borderRadius: R.pill,
                    background: C.fill,
                    color: C.dim,
                    cursor: "pointer",
                  }}
                >
                  <Icon name="xmark" size={12} strokeWidth={2.6} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {full ? (
        <div style={{ ...T.footnote, color: C.dim }}>{t("rec.interview.rec_full")}</div>
      ) : roster.length === 0 ? (
        <div style={{ ...T.footnote, color: C.dim }}>{t("rec.interview.rec_empty_roster")}</div>
      ) : (
        <>
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("rec.interview.rec_search_ph")}
            aria-label={t("rec.interview.recommendations")}
          />
          {query.trim() !== "" && (
            <Tile
              padding="2px 12px"
              style={{ marginTop: 8, maxHeight: 232, overflowY: "auto", animation: RISE }}
            >
              {matches.length === 0 && (
                <div style={{ padding: "12px 0", ...T.footnote, color: C.dim }}>
                  {t("rec.interview.rec_no_matches")}
                </div>
              )}
              <List>
                {matches.map((c) => (
                  <Row
                    key={c.id}
                    onClick={() => pick(c.id)}
                    title={c.full_name || "—"}
                    subtitle={
                      <>
                        <Mono>{c.personal_id || ""}</Mono>
                        {c.team ? (
                          <>
                            {c.personal_id ? <span aria-hidden style={{ color: C.dimmer, margin: "0 6px" }}>·</span> : null}
                            {t("rec.candidates.team")} {c.team}
                          </>
                        ) : null}
                      </>
                    }
                    trailing={<Icon name="plus" size={16} strokeWidth={2.2} style={{ color: C.dim }} />}
                  />
                ))}
              </List>
            </Tile>
          )}
        </>
      )}
    </>
  );
}

// The names one interviewer recorded, shown read-only on their tile.
function RecommendedNames({ ids, namesById }) {
  const { t } = useI18n();
  if (!ids || ids.length === 0) return null;
  return (
    <div style={{
      display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 8,
    }}>
      <span style={{ ...T.caption, color: C.dim }}>
        {t("rec.interview.recommended")}
      </span>
      {ids.map((id) => (
        <Badge key={id} tone="bright" style={{ maxWidth: "100%" }}>
          <span style={{ minWidth: 0, ...ELLIPSIS }}>
            {namesById?.get(id) || t("rec.interview.rec_unknown")}
          </span>
        </Badge>
      ))}
    </div>
  );
}

// Standing of one candidate in the cycle's recommendation graph: how many
// people named them (the number the leaderboard ranks on), who those were,
// and who the candidate named back.
function RecommendationsPanel({ incoming, outgoing, onOpenCandidate }) {
  const { t } = useI18n();
  const count = incoming?.length || 0;
  return (
    <Panel title={t("rec.candidate.recommendations_title")}>
      <Stat
        value={count}
        label={t("rec.candidate.rec_count")}
        tone={recTone(count)}
        style={{ marginBottom: 16 }}
      />

      <Label>{t("rec.candidate.recommended_by")}</Label>
      <RecNameList
        people={incoming}
        emptyLabel={t("rec.candidate.no_recommendations")}
        onOpen={onOpenCandidate}
      />

      <Divider style={{ margin: "16px 0 14px" }} />

      <Label>{t("rec.candidate.recommends")}</Label>
      <RecNameList
        people={outgoing}
        emptyLabel={t("rec.candidate.no_recommends")}
        onOpen={onOpenCandidate}
      />
    </Panel>
  );
}

// 1–10 as a row of round buttons (two rows of five on phones, so each
// stays a comfortable target).
function ScorePicker({ value, onChange }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  return (
    <div
      role="radiogroup"
      aria-label={t("rec.interview.score")}
      style={isMobile ? {
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(36px, 44px))",
        gap: 10,
      } : {
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
        const active = Number(value) === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={active}
            data-press="scale"
            onClick={() => onChange(n)}
            style={{
              all: "unset",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              ...(isMobile
                ? { width: "100%", aspectRatio: "1 / 1" }
                : { width: 38, height: 38 }),
              borderRadius: R.pill,
              background: active ? C.tint : C.fill,
              color: active ? C.onTint : C.bright,
              fontFamily: FONT,
              ...T.body,
              ...NUM,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >{n}</button>
        );
      })}
    </div>
  );
}

// ── Tag picker (predefined chips) ──────────────────────────────────

function TagPicker({ selected, onChange }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  return (
    <div style={{ display: "flex", gap: isMobile ? 8 : 6, flexWrap: "wrap" }}>
      {PREDEFINED_TAGS.map((tag) => {
        const active = selected.includes(tag.key);
        const colors = chipColors(tag.tone, active);
        return (
          <button
            key={tag.key}
            type="button"
            data-press="scale"
            aria-pressed={active}
            onClick={() => {
              if (active) onChange(selected.filter((s) => s !== tag.key));
              else onChange([...selected, tag.key]);
            }}
            style={{
              all: "unset",
              boxSizing: "border-box",
              display: "inline-flex",
              alignItems: "center",
              minHeight: isMobile ? 36 : 30,
              paddingInline: isMobile ? 14 : 12,
              borderRadius: R.pill,
              background: colors.bg,
              color: colors.fg,
              fontFamily: FONT,
              ...(isMobile ? T.callout : T.footnote),
              fontWeight: 600,
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            {tagLabel(tag.key, t)}
          </button>
        );
      })}
    </div>
  );
}

// Unselected tags are quiet gray capsules; a selected tag fills with its
// tone (strength = green, concern = amber, neutral = ink).
function chipColors(tone, active) {
  if (!active) return { bg: C.fill, fg: C.text };
  if (tone === "ok")   return { bg: C.ok,   fg: C.bg };
  if (tone === "warn") return { bg: C.warn, fg: C.bg };
  return { bg: C.tint, fg: C.onTint };
}
