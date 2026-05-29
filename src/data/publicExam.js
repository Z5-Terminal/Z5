// Z5 :: Public exam data layer (anonymous, no auth).
// Calls SECURITY DEFINER RPCs that enforce token + cycle-status +
// candidate-unlock checks server-side. Questions returned here never
// include the correct answer — grading happens entirely in submit_exam.

import { supabase } from "../supabase";

export async function getExamForToken(token, personalId) {
  return supabase.rpc("get_exam_for_token", {
    p_token: token,
    p_personal_id: personalId,
  });
}

export async function startExamAttempt(token, personalId) {
  return supabase.rpc("start_exam_attempt", {
    p_token: token,
    p_personal_id: personalId,
  });
}

export async function saveExamAnswer({ token, personalId, questionId, selectedOption }) {
  return supabase.rpc("save_exam_answer", {
    p_token: token,
    p_personal_id: personalId,
    p_question_id: questionId,
    p_selected_option: selectedOption ?? null,
  });
}

export async function submitExam(token, personalId) {
  return supabase.rpc("submit_exam", {
    p_token: token,
    p_personal_id: personalId,
  });
}
