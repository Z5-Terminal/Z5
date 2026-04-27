---
name: z5-i18n
description: "Scan Z5 project JSX files for hardcoded English text not wrapped in t(), and verify that every EN key in i18n.jsx has a matching HE key (and vice versa). Use this skill whenever adding new UI text, creating new screens, or when the user asks to check translations, find missing keys, or audit i18n coverage. Also trigger when the user mentions 'untranslated', 'missing translation', 'Hebrew', 'i18n', or 'hardcoded text'."
---

# Z5 i18n Audit Skill

This skill helps you find internationalization gaps in the Z5 codebase. There are two things that go wrong with i18n in this project, and both are easy to miss during development:

1. **Hardcoded English strings** — a developer writes `"Save"` directly in JSX instead of `{t("some.key")}`. The app works fine in English but shows raw English when switched to Hebrew.
2. **Key mismatch between EN and HE dictionaries** — someone adds a key to the `EN` object in `src/i18n.jsx` but forgets the Hebrew translation (or vice versa). The fallback chain (`HE[key] ?? EN[key] ?? key`) hides the problem — Hebrew users silently see English text.

## How the i18n system works

The translation system lives in `src/i18n.jsx`. It exports:

- `useI18n()` hook → returns `{ t, lang, setLang, dir, isRTL }`
- `t(key)` or `t(key, { param: value })` — looks up the key in the active language dict, falls back to EN, then to the raw key string
- Two plain objects: `const EN = { ... }` and `const HE = { ... }` at the bottom of the file
- Keys follow a dotted namespace convention: `"nav.home"`, `"mis.title"`, `"gear.primary"`, etc.
- The `dir` property is `"rtl"` for Hebrew, `"ltr"` for English — used for CSS `direction`

## Audit procedure

### Step 1: Check EN/HE key parity

Read `src/i18n.jsx` and extract every key from both `EN` and `HE`. Compare the two sets:

- Keys in EN but missing from HE → **needs Hebrew translation**
- Keys in HE but missing from EN → **orphan** (likely a typo or leftover)

Report results as a table. If all keys match, say so.

### Step 2: Scan JSX files for hardcoded English text

Look through all `.jsx` files under `src/` for user-visible English text that isn't wrapped in `t()`. The things to watch for:

**Suspicious patterns (likely hardcoded):**
- String literals inside JSX that contain English words, e.g. `<span>Save</span>`, `<Btn>Cancel</Btn>`
- Template literals with English words rendered as children or in `title`/`placeholder`/`aria-label` attributes
- Direct English strings in props like `label="Name"` or `placeholder="Enter email"`

**Acceptable exceptions (do NOT flag these):**
- `import` / `export` statements
- Console logs, error messages in `throw new Error()`
- CSS property values, style objects
- Variable names and object keys
- SVG attributes (`viewBox`, `stroke`, etc.)
- `type="password"`, `type="submit"` and other HTML attribute values
- Single characters or symbols (`"▶"`, `"←"`, `"+"`, `"✔"`, `"✕"`, `"⌖"`, `"◎"`, `"◈"`)
- Technical identifiers: callsign placeholders like `"GHOST-1"`, role strings like `"admin"`
- Comments
- The `EN` and `HE` dictionaries themselves in `i18n.jsx`
- `import.meta.env.BASE_URL` and similar env references
- File extensions and paths (`.png`, `.pdf`)
- Strings only used in data structures that map to i18n keys (e.g. `{ key: "operational" }` where `t("kind.operational")` is called later)

When you find a suspected hardcoded string, report:
- File path and approximate line
- The hardcoded text
- A suggested i18n key (following the existing namespace convention)

### Step 3: Suggest fixes

For each issue found, provide:
- The exact code change needed (old → new)
- Any new keys to add to both EN and HE dictionaries

## Output format

Structure your report like this:

```
## EN/HE Key Parity
✔ All N keys matched  (or list mismatches)

## Hardcoded Strings Found
| File | Line | Text | Suggested Key |
| ... | ... | ... | ... |

## Suggested Changes
(code snippets for each fix)
```

Keep it concise. The operator wants a punch list they can act on, not a novel.
