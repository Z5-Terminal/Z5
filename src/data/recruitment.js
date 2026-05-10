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

// ── URL helpers ────────────────────────────────────────────────────

// Build the absolute candidate-facing survey URL for a cycle. Hash-routed
// so the GitHub Pages deploy doesn't need server-side rewrites.
export function surveyUrlForCycle(cycle) {
  if (!cycle?.access_token) return null;
  if (typeof window === "undefined") return null;
  const base = (import.meta.env && import.meta.env.BASE_URL) || "/";
  return `${window.location.origin}${base}#/recruitment/${cycle.access_token}/survey`;
}
