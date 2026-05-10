// Z5 :: Candidate interview records (admin-side).
// One row per (candidate, interviewer). Different interviewers leave
// distinct records; each can edit their own. Reads always include
// the interviewer's profile (callsign, role) joined client-side so
// the UI can label whose interview is whose.

import { supabase } from "../supabase";

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
      interviewer: byId.get(i.interviewer_id) || null,
    })),
  };
}

export async function upsertInterview({ candidateId, interviewerId, score, tags, notes }) {
  return supabase
    .from("candidate_interviews")
    .upsert(
      {
        candidate_id: candidateId,
        interviewer_id: interviewerId,
        score: score == null ? null : Number(score),
        tags: Array.isArray(tags) ? tags : [],
        notes: notes || null,
      },
      { onConflict: "candidate_id,interviewer_id" }
    )
    .select()
    .single();
}

export async function deleteInterview(id) {
  return supabase.from("candidate_interviews").delete().eq("id", id);
}
