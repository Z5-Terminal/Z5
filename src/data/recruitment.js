// Z5 :: Recruitment data layer (admin-side).
// Cycles, candidates, survey questions, responses. Public anon-side calls
// (used by the candidate-facing survey screens) live in their own module
// in Phase C2 and call SECURITY DEFINER RPCs directly.

import { supabase } from "../supabase";

// ── Cycles ─────────────────────────────────────────────────────────

export async function listCycles() {
  return supabase
    .from("recruitment_cycles")
    .select("*")
    .order("created_at", { ascending: false });
}

export async function getCycle(id) {
  return supabase
    .from("recruitment_cycles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
}

export async function createCycle({ name, startsOn, endsOn, notes }) {
  const { data, error } = await supabase
    .from("recruitment_cycles")
    .insert({
      name,
      starts_on: startsOn || null,
      ends_on: endsOn || null,
      notes: notes || null,
    })
    .select()
    .single();
  if (error) return { error };
  // Seed the default 37-question template into the new cycle. RPC is
  // idempotent, so a second call (e.g. if the user creates a cycle then
  // hits "create" again) is harmless.
  if (data?.id) {
    await supabase.rpc("seed_default_survey_template", { p_cycle_id: data.id });
  }
  return { data };
}

export async function updateCycle(id, patch) {
  return supabase
    .from("recruitment_cycles")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
}

export async function deleteCycle(id) {
  return supabase.from("recruitment_cycles").delete().eq("id", id);
}

// Generates the access token + flips status to 'open'.
export async function beginCycle(id) {
  return supabase.rpc("begin_recruitment_cycle", { p_cycle_id: id });
}

// Replaces the existing token; old links stop working.
export async function regenerateToken(id) {
  return supabase.rpc("regenerate_cycle_token", { p_cycle_id: id });
}

// Manual status transitions (open → interviewing → exam → closed).
export async function setCycleStatus(id, status) {
  return supabase
    .from("recruitment_cycles")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
}

// ── Survey questions (admin-side) ──────────────────────────────────

export async function listSurveyQuestions(cycleId) {
  return supabase
    .from("survey_questions")
    .select("*")
    .eq("cycle_id", cycleId)
    .order("ord", { ascending: true });
}

export async function createSurveyQuestion(cycleId, q) {
  // Caller should have computed an `ord` that puts the row at the
  // end of its section; we don't sort or dedupe here.
  return supabase
    .from("survey_questions")
    .insert({
      cycle_id: cycleId,
      ord: q.ord,
      section: q.section || null,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options ?? null,
      required: q.required !== false,
    })
    .select()
    .single();
}

export async function updateSurveyQuestion(id, patch) {
  return supabase
    .from("survey_questions")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
}

export async function deleteSurveyQuestion(id) {
  return supabase.from("survey_questions").delete().eq("id", id);
}

// Re-seed the default 37-question template into a cycle, but only if
// it currently has no questions (the SQL function is idempotent).
export async function seedDefaultTemplate(cycleId) {
  return supabase.rpc("seed_default_survey_template", { p_cycle_id: cycleId });
}

// ── Candidates (admin-side) ────────────────────────────────────────

export async function listCandidates(cycleId, { team, status } = {}) {
  let q = supabase
    .from("candidates")
    .select("*")
    .eq("cycle_id", cycleId)
    .order("created_at", { ascending: false });
  if (team)   q = q.eq("team", team);
  if (status) q = q.eq("status", status);
  return q;
}

// Fetch the candidate row + parent cycle + every survey question for
// the cycle + every survey response. Joins are done client-side.
export async function getCandidateWithDetails(candidateId) {
  const { data: candidate, error: cErr } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", candidateId)
    .maybeSingle();
  if (cErr || !candidate) return { error: cErr || new Error("not_found") };

  const [cycleRes, questionsRes, responsesRes] = await Promise.all([
    supabase
      .from("recruitment_cycles")
      .select("*")
      .eq("id", candidate.cycle_id)
      .maybeSingle(),
    supabase
      .from("survey_questions")
      .select("*")
      .eq("cycle_id", candidate.cycle_id)
      .order("ord", { ascending: true }),
    supabase
      .from("survey_responses")
      .select("*")
      .eq("candidate_id", candidateId),
  ]);

  if (cycleRes.error)     return { error: cycleRes.error };
  if (questionsRes.error) return { error: questionsRes.error };
  if (responsesRes.error) return { error: responsesRes.error };

  return {
    data: {
      candidate,
      cycle: cycleRes.data,
      questions: questionsRes.data || [],
      responses: responsesRes.data || [],
    },
  };
}

// Fetch a candidate's exam attempt (if any). Returns null when the
// candidate hasn't started the exam yet.
export async function getCandidateExam(candidateId) {
  return supabase
    .from("exam_attempts")
    .select("*")
    .eq("candidate_id", candidateId)
    .maybeSingle();
}

// Build the candidate-facing exam URL for a (cycle, candidate) pair.
// Returns null when the cycle has no access_token yet (cycle still in
// draft) or the candidate has no personal_id.
export function examUrlFor(cycle, candidate) {
  if (!cycle?.access_token || !candidate?.personal_id) return null;
  if (typeof window === "undefined") return null;
  const base = (import.meta.env && import.meta.env.BASE_URL) || "/";
  return `${window.location.origin}${base}#/recruitment/${cycle.access_token}/exam/${encodeURIComponent(candidate.personal_id)}`;
}

export async function updateCandidate(id, patch) {
  return supabase
    .from("candidates")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
}

// Aggregate every candidate in a cycle with their interview + exam
// results: avg interview score, scored count, min/max range, union of
// tags (with frequency), per-interviewer breakdown, and exam attempt
// (if any). The Candidates screen uses this for both its team-grouped
// layout and its score-ranked leaderboard layout.
export async function getCandidatesEnriched(cycleId) {
  const { data: candidates, error: cErr } = await supabase
    .from("candidates")
    .select("*")
    .eq("cycle_id", cycleId);
  if (cErr) return { error: cErr };
  if (!candidates || candidates.length === 0) return { data: [] };

  const candidateIds = candidates.map((c) => c.id);
  const [interviewsRes, examsRes] = await Promise.all([
    supabase
      .from("candidate_interviews")
      .select("*")
      .in("candidate_id", candidateIds),
    supabase
      .from("exam_attempts")
      .select("*")
      .in("candidate_id", candidateIds),
  ]);
  if (interviewsRes.error) return { error: interviewsRes.error };
  if (examsRes.error)      return { error: examsRes.error };

  const interviews = interviewsRes.data || [];
  const exams      = examsRes.data || [];

  // Resolve interviewer profiles for the drill-down view.
  const interviewerIds = [...new Set(interviews.map((i) => i.interviewer_id))];
  let profsById = new Map();
  if (interviewerIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, callsign, full_name, role")
      .in("id", interviewerIds);
    profsById = new Map((profs || []).map((p) => [p.id, p]));
  }

  // Group interviews and exams by candidate.
  const interviewsByCand = new Map();
  for (const iv of interviews) {
    if (!interviewsByCand.has(iv.candidate_id)) interviewsByCand.set(iv.candidate_id, []);
    interviewsByCand.get(iv.candidate_id).push({
      ...iv,
      interviewer: profsById.get(iv.interviewer_id) || null,
    });
  }
  const examByCand = new Map();
  for (const ex of exams) examByCand.set(ex.candidate_id, ex);

  const rows = candidates.map((candidate) => {
    const ivs = interviewsByCand.get(candidate.id) || [];
    const scored = ivs.filter((i) => i.score != null);
    const scores = scored.map((i) => i.score);
    const avgScore = scores.length
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null;

    const tagCounts = {};
    for (const iv of ivs) {
      for (const tag of iv.tags || []) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    return {
      candidate,
      interviews: ivs,
      interviewCount: ivs.length,
      scoredCount: scored.length,
      avgScore,
      minScore: scores.length ? Math.min(...scores) : null,
      maxScore: scores.length ? Math.max(...scores) : null,
      tags: Object.keys(tagCounts),
      tagCounts,
      examAttempt: examByCand.get(candidate.id) || null,
    };
  });

  return { data: rows };
}

// ── Live survey activity ────────────────────────────────────────────

// Per-cycle survey funnel: how many candidates opened the shared link
// (a candidates row exists once they start), how many are mid-survey,
// and how many have submitted (survey_done or any later status).
export async function getCycleSurveyStats(cycleId) {
  const { data, error } = await supabase
    .from("candidates")
    .select("id, status")
    .eq("cycle_id", cycleId);
  if (error) return { error };
  const rows = data || [];
  const inProgress = rows.filter((r) => r.status === "survey_in_progress").length;
  return {
    data: {
      total: rows.length,
      inProgress,
      submitted: rows.length - inProgress,
    },
  };
}

// Candidate counts for every cycle at once (Cycles list rows).
export async function getCandidateCountsByCycle() {
  const { data, error } = await supabase
    .from("candidates")
    .select("cycle_id");
  if (error) return { error };
  const counts = {};
  for (const r of data || []) {
    counts[r.cycle_id] = (counts[r.cycle_id] || 0) + 1;
  }
  return { data: counts };
}

// ── Phase C5: combined score + promote-to-bootcamp bridge ──────────

// Combined screening score 0-100: 50% interview average (1-10 scale),
// 50% exam percentage. Null until BOTH components exist — a candidate
// with only one signal shouldn't outrank one with two.
export function combinedScore(row) {
  const iv = row?.avgScore;
  const ex = row?.examAttempt;
  if (iv == null || ex?.score == null || !ex?.total || !ex?.finished_at) return null;
  return Math.round(iv * 10 * 0.5 + (ex.score / ex.total) * 100 * 0.5);
}

export async function listBootcampSquads() {
  return supabase
    .from("squads")
    .select("id, name, status")
    .eq("is_bootcamp", true)
    .order("name");
}

function inviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "Z5-";
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  s += "-";
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

// Bridge an accepted candidate into a bootcamp squad: mints a sniper
// invite scoped to that squad and stamps the candidate row with the
// promotion, so the invite code can be handed to the candidate.
export async function promoteCandidate(candidateId, squadId) {
  const code = inviteCode();
  const { error: invErr } = await supabase
    .from("invites")
    .insert({ code, squad_id: squadId, role: "sniper" });
  if (invErr) return { error: invErr };
  return supabase
    .from("candidates")
    .update({
      promoted_squad_id: squadId,
      promoted_at: new Date().toISOString(),
      promote_invite_code: code,
    })
    .eq("id", candidateId)
    .select()
    .single();
}

// ── URL helpers ────────────────────────────────────────────────────

// Build the absolute candidate-facing survey URL for a cycle. Hash-routed
// so the GitHub Pages deploy doesn't need server-side rewrites.
export function surveyUrlForCycle(cycle) {
  if (!cycle?.access_token) return null;
  if (typeof window === "undefined") return null;
  const base = (import.meta.env && import.meta.env.BASE_URL) || "/";
  return `${window.location.origin}${base}#/recruitment/${cycle.access_token}/survey`;
}
