// Z5 :: Candidate interview records (admin-side).
// One row per (candidate, interviewer). Different interviewers leave
// distinct records; each can edit their own. Reads always include
// the interviewer's profile (callsign, role) joined client-side so
// the UI can label whose interview is whose.
//
// `recommended_ids` holds up to 3 OTHER candidates the interviewee named
// when asked who they recommend. It lives on the *recommending*
// candidate's interview row; incoming counts are derived on read
// (see getRecommendationsFor / getCandidatesEnriched in recruitment.js).

import { supabase } from "../supabase";

// The recommended_ids column arrives with interview_recommendations_migration.sql.
// Until that has been run in Supabase, writes mentioning it 400 — we detect
// that and retry without the field so the rest of the interview still saves.
function missingRecommendedColumn(error) {
  return !!error && /recommended_ids/i.test(error.message || "");
}

export async function listCandidateInterviews(candidateId) {
  const { data: interviews, error } = await supabase
    .from("candidate_interviews")
    .select("*")
    .eq("candidate_id", candidateId)
    .order("updated_at", { ascending: false });
  if (error) return { error };
  if (!interviews || interviews.length === 0) return { data: [] };

  const ids = [...new Set(interviews.map((i) => i.interviewer_id))];
  const { data: profs, error: pErr } = await supabase
    .from("profiles")
    .select("id, callsign, full_name, role")
    .in("id", ids);
  if (pErr) return { error: pErr };

  const byId = new Map((profs || []).map((p) => [p.id, p]));
  return {
    data: interviews.map((i) => ({
      ...i,
      recommended_ids: Array.isArray(i.recommended_ids) ? i.recommended_ids : [],
      interviewer: byId.get(i.interviewer_id) || null,
    })),
  };
}

export async function upsertInterview({
  candidateId, interviewerId, score, tags, notes, recommendedIds,
}) {
  const base = {
    candidate_id: candidateId,
    interviewer_id: interviewerId,
    score: score == null ? null : Number(score),
    tags: Array.isArray(tags) ? tags : [],
    notes: notes || null,
  };
  // Cap at 3 client-side too — the DB check constraint is the backstop.
  const recs = Array.isArray(recommendedIds) ? recommendedIds.slice(0, 3) : [];

  const write = (row) =>
    supabase
      .from("candidate_interviews")
      .upsert(row, { onConflict: "candidate_id,interviewer_id" })
      .select()
      .single();

  const res = await write({ ...base, recommended_ids: recs });
  if (res.error && missingRecommendedColumn(res.error)) return write(base);
  return res;
}

export async function deleteInterview(id) {
  return supabase.from("candidate_interviews").delete().eq("id", id);
}
