// Z5 :: Predefined interview tags (Phase D).
// Stored in candidate_interviews.tags as text[] of these keys. UI looks
// up display labels via i18n (`rec.tag.<key>`). Legacy free-text tags
// from before this list existed still render — they just fall back to
// their literal text via the tagLabel() helper.

export const PREDEFINED_TAGS = [
  // Strengths (tone: ok)
  { key: "focused",              tone: "ok" },
  { key: "disciplined",          tone: "ok" },
  { key: "communicative",        tone: "ok" },
  { key: "physically_strong",    tone: "ok" },
  { key: "high_motivation",      tone: "ok" },
  { key: "leadership_potential", tone: "ok" },
  { key: "mature",               tone: "ok" },
  { key: "team_player",          tone: "ok" },

  // Concerns (tone: warn)
  { key: "discipline_concerns",     tone: "warn" },
  { key: "physical_concerns",       tone: "warn" },
  { key: "low_motivation",          tone: "warn" },
  { key: "communication_concerns",  tone: "warn" },
  { key: "needs_development",       tone: "warn" },

  // Neutral observations
  { key: "promising_but_young",  tone: "default" },
  { key: "specialist_potential", tone: "default" },
];

const TAG_BY_KEY = new Map(PREDEFINED_TAGS.map((tag) => [tag.key, tag]));

export function tagLabel(key, t) {
  if (!key) return "";
  // Predefined tags translate via i18n
  if (TAG_BY_KEY.has(key)) {
    const i18nKey = `rec.tag.${key}`;
    const translated = t ? t(i18nKey) : i18nKey;
    if (translated && translated !== i18nKey) return translated;
  }
  // Legacy free-text tag — render the raw string
  return key;
}

export function tagTone(key) {
  return TAG_BY_KEY.get(key)?.tone || "default";
}
