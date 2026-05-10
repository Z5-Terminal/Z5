// Z5 :: Avatar / photo upload helpers (Phase D).
// profile-avatars bucket is public (anyone can view a user's avatar).
// candidate-photos bucket is private — admin/officer/recruiter only —
// and we serve via signed URLs so the bucket can stay private without
// the UI needing to handle auth tokens.

import { supabase } from "../supabase";

const AVATAR_BUCKET    = "profile-avatars";
const CANDIDATE_BUCKET = "candidate-photos";

function fileExtension(file) {
  const m = (file?.name || "").match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : "jpg";
}

// ── Profile (user) avatars: public bucket ──────────────────────────

// Stores the path (e.g. "<user_id>/avatar.jpg") in profiles.avatar_url.
// Public URL is derived on read so a moved/renamed bucket doesn't break
// stored URLs.
export async function uploadProfileAvatar(userId, file) {
  if (!userId || !file) return { error: new Error("missing_args") };
  const ext = fileExtension(file);
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) return { error };
  return { path };
}

export function profileAvatarPublicUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  // Bust the browser cache when a fresh upload uses the same path:
  return data?.publicUrl ? `${data.publicUrl}?t=${Date.now()}` : null;
}

// ── Candidate photos: private bucket ───────────────────────────────

export async function uploadCandidatePhoto(candidateId, file) {
  if (!candidateId || !file) return { error: new Error("missing_args") };
  const ext = fileExtension(file);
  const path = `${candidateId}/photo.${ext}`;
  const { error } = await supabase.storage
    .from(CANDIDATE_BUCKET)
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) return { error };
  return { path };
}

// 24h signed URL — long enough for normal review sessions.
export async function candidatePhotoSignedUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(CANDIDATE_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24);
  if (error) return null;
  return data?.signedUrl || null;
}
