// Z5 :: Public-survey data layer (anonymous, no auth required).
// Calls SECURITY DEFINER RPCs that enforce token + cycle-status checks
// in the database, so anon users never touch tables directly.

import { supabase } from "../supabase";

// Resolve a token → returns { cycle_id, cycle_name, status, questions }
// or an error if the token is invalid or the cycle isn't 'open'.
export async function getSurveyForToken(token) {
  return supabase.rpc("get_survey_for_token", { p_token: token });
}

// Create or resume a candidate session. Idempotent on (cycle, personal_id):
// the same soldier hitting the form twice in the same cycle gets the same
// candidate row back (so partial answers persist).
export async function startCandidate({ token, fullName, team, personalId }) {
  return supabase.rpc("start_candidate_session", {
    p_token: token,
    p_full_name: fullName,
    p_team: team,
    p_personal_id: personalId,
  });
}

export async function saveAnswer({ token, candidateId, questionId, answerText, answerValue }) {
  return supabase.rpc("save_survey_answer", {
    p_token: token,
    p_candidate_id: candidateId,
    p_question_id: questionId,
    p_answer_text: answerText ?? null,
    p_answer_value: answerValue ?? null,
  });
}

// Mark candidate as survey_done (still callable repeatedly, idempotent).
export async function submitSurvey({ token, candidateId }) {
  return supabase.rpc("submit_survey", {
    p_token: token,
    p_candidate_id: candidateId,
  });
}
