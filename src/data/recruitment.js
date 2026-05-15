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

// Fetch the candidate row + every survey question for their cycle +
// every survey response. Joins are done client-side because we need
// all three regardless and Supabase select-with-relations gets
// awkward when the relation isn't a direct FK.
export async function getCandidateWithDetails(candidateId) {
  const { data: candidate, error: cErr } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", candidateId)
    .maybeSingle();
  if (cErr || !candidate) return { error: cErr || new Error("not_found") };

  const [questionsRes, responsesRes] = await Promise.all([
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

  if (questionsRes.error) return { error: questionsRes.error };
  if (responsesRes.error) return { error: responsesRes.error };

  return {
    data: {
      candidate,
      questions: questionsRes.data || [],
      responses: responsesRes.data || [],
    },
  };
}

export async function updateCandidate(id, patch) {
  return supabase
    .from("candidates")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
}

// Aggregate every candidate in a cycle with their interview results:
// average score, scored count, min/max range, the union of tags (with
// frequency), and the per-interviewer breakdown. Used by the
// Evaluations screen to rank candidates by interview score.
export async function getCycleEvaluations(cycleId) {
  const { data: candidates, error: cErr } = await supabase
    .from("candidates")
    .select("*")
    .eq("cycle_id", cycleId);
  if (cErr) return { error: cErr };
  if (!candidates || candidates.length === 0) return { data: [] };

  const candidateIds = candidates.map((c) => c.id);
  const { data: interviews, error: iErr } = await supabase
    .from("candidate_interviews")
    .select("*")
    .in("candidate_id", candidateIds);
  if (iErr) return { error: iErr };

  // Resolve interviewer profiles for the drill-down view.
  const interviewerIds = [...new Set((interviews || []).map((i) => i.interviewer_id))];
  let profsById = new Map();
  if (interviewerIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, callsign, full_name, role")
      .in("id", interviewerIds);
    profsById = new Map((profs || []).map((p) => [p.id, p]));
  }

  // Group interviews by candidate.
  const byCandidate = new Map();
  for (const iv of interviews || []) {
    if (!byCandidate.has(iv.candidate_id)) byCandidate.set(iv.candidate_id, []);
    byCandidate.get(iv.candidate_id).push({
      ...iv,
      interviewer: profsById.get(iv.interviewer_id) || null,
    });
  }

  const rows = candidates.map((candidate) => {
    const ivs = byCandidate.get(candidate.id) || [];
    const scored = ivs.filter((i) => i.score != null);
    const scores = scored.map((i) => i.score);
    const avgScore = scores.length
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null;

    // Tag frequency across all of this candidate's interviews.
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
    };
  });

  return { data: rows };
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
