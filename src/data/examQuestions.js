// Z5 :: Exam question data layer (admin-side) — Phase C4.
// CRUD over exam_questions plus figure upload to the public
// exam-figures bucket.

import { supabase } from "../supabase";

const FIGURE_BUCKET = "exam-figures";

export async function listExamQuestions(cycleId) {
  return supabase
    .from("exam_questions")
    .select("*")
    .eq("cycle_id", cycleId)
    .order("ord", { ascending: true });
}

export async function createExamQuestion(cycleId, q) {
  return supabase
    .from("exam_questions")
    .insert({
      cycle_id: cycleId,
      ord: q.ord,
      prompt_text: q.prompt_text || null,
      prompt_image_url: q.prompt_image_url || null,
      options: q.options || [],
      correct_option: q.correct_option || null,
      points: q.points ?? 1,
    })
    .select()
    .single();
}

export async function updateExamQuestion(id, patch) {
  return supabase
    .from("exam_questions")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
}

export async function deleteExamQuestion(id) {
  return supabase.from("exam_questions").delete().eq("id", id);
}

export async function seedDefaultExam(cycleId) {
  return supabase.rpc("seed_default_exam_template", { p_cycle_id: cycleId });
}

// Upload a figure (question prompt image or an option image).
// `slot` disambiguates the path: "prompt" or an option key like "1".
export async function uploadExamFigure(questionId, slot, file) {
  if (!questionId || !file) return { error: new Error("missing_args") };
  const m = (file.name || "").match(/\.([a-zA-Z0-9]+)$/);
  const ext = m ? m[1].toLowerCase() : "png";
  const path = `${questionId}/${slot}.${ext}`;
  const { error } = await supabase.storage
    .from(FIGURE_BUCKET)
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) return { error };
  return { path };
}

// exam-figures is a public bucket, so a plain public URL works.
export function examFigureUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from(FIGURE_BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}
