# Z5 design language

Apple-style craft on the e-ink palette. The palette (warm paper / deep-black night, ink as the only accent, muted status tones) is unchanged; what changed is how the interface is built and how it moves. This file is the reference for anyone adding or editing UI.

The four needs every screen serves: **predictability** (it behaves the way the platform taught you), **understanding** (you always know where you are and what a thing does), **achievement** (the primary task is the shortest path), **delight** (it responds like a physical object).

## 1. Foundations

| File | What lives there |
| --- | --- |
| `src/theme.js` | `C` color tokens, `T` type scale, `R` radii, `Z` layers, `MATERIAL` blur recipes, `NUM` tabular figures, `S` base style atoms, `FONT` / `FONT_MONO` |
| `src/motion.js` | `MOTION` spring transitions (CSS), `DURATION`, `animateSpring`, `project`, `rubberband`, `createVelocityTracker`, `prefersReducedMotion` |
| `src/icons.jsx` | `<Icon name size flip />` — the only icon source |
| `src/ui.jsx` | every shared primitive (re-exports `Modal`, `Menu`, `Lightbox` from `overlays.jsx`) |
| `index.html` | the global interaction layer: `:active` / `:hover` / `:focus-visible`, keyframes, reduced-motion / reduced-transparency / contrast fallbacks |

Hard rules (unchanged from before): inline styles only; colors only from `C` (never a hex/rgba literal in a screen — add a token); logical properties only (`marginInlineStart`, `insetInlineEnd`, `textAlign: "start"`…), never left/right; every user-visible string through `t()` with EN and HE in sync; test phone and desktop, paper and night, Hebrew and English.

## 2. Surfaces and depth

- **One bordered level.** `Panel` is the only bordered card. Inside a Panel use flat `Row`s separated by hairlines (`List` draws them *between* rows) and borderless `Tile`s (`C.cardBg` fill). Never put a bordered box inside a Panel.
- **Radii are concentric and generous**: cards `R.xl` (20) desktop / `R.lg` (16) phone, controls `R.md` (12), inner tiles and rows `R.sm`–`R.md`, capsules `R.pill`. Nothing uses 2–6px corners any more except tiny marks.
- **Hairlines** are `C.separator` (translucent), not `C.border`. `C.border` is only the Panel outline and field outline.
- **Materials**: anything that floats over scrolling content (mobile top bar, tab bar, bulk-action bars, sheets, menus, sticky in-page headers) uses a translucent background `C.material` / `C.materialThick` + `...MATERIAL.bar` / `...MATERIAL.thick` and carries the attribute `data-material=""` (so reduced-transparency and high-contrast users get a solid surface). Don't stack a translucent layer on another translucent layer. Don't put a 1px divider under floating chrome that sits at rest over nothing — show the hairline only once content is underneath.
- **Dim to focus, separate to keep flow.** A blocking task uses `Modal` (scrim). Lightweight choices use `Menu` (no scrim).
- **Layers** come from `Z` — never invent a z-index.

## 3. Typography

System font everywhere (`FONT`). Use the scale from `T` by spreading it: `{ ...T.title2, color: C.bright }`.

| Token | Use |
| --- | --- |
| `T.largeTitle` / `T.title1` | page title (PageHeader does this) |
| `T.title2` / `T.title3` | section headings, dialog titles, big names |
| `T.headline` | row titles, card headlines (semibold) |
| `T.body` | default text |
| `T.callout` / `T.footnote` | secondary text, descriptions |
| `T.caption` / `T.caption2` | meta, timestamps, micro-labels |

- **No spaced-out uppercase.** No `textTransform: "uppercase"`, no letter-spacing above `0.02em`. Labels are sentence case in secondary color (`S.label`). Hierarchy comes from weight + size + color together, not from caps or tracking. (Hebrew has no case and wide tracking breaks it.)
- **Mono is for codes only** — callsigns, serials, invite codes, tokens/URLs, personal ID numbers (`<Mono>` / `FONT_MONO`). Dates, times, counts, scores and percentages are **not** mono: use the system font with tabular figures — wrap them in `<Num>` (tabular figures + bidi isolation, so "11 / 12" never renders reversed in Hebrew while Hebrew dates keep their natural order) or spread `...NUM`.
- Color roles: `C.bright` titles and key values, `C.text` body, `C.dim` secondary, `C.dimmer` tertiary/disabled/chevrons. Status colors (`C.ok/warn/error/schedule`) only for status.
- **No glyph characters as icons** (`⌖ ◎ ◈ ▶ ✎ ✕ ← → ✓ 📄`): use `<Icon>`. Directional icons take `flip` so they mirror in RTL. i18n strings no longer contain leading `+`, arrows or glyphs — add `icon="plus"` etc. on the button instead.

## 4. Response and motion

- **Feedback on pointer-down.** Every tappable element carries a `data-press` attribute: `data-press="scale"` for buttons, chips, cards (sinks slightly; add `data-press-depth="soft"` for large cards, `"deep"` for small icon targets) or `data-press="row"` for list rows (highlight fill + hover). The shared primitives already do this; hand-built tappables must too. Never use `onMouseEnter`/`onMouseLeave` state or direct `e.currentTarget.style` mutation for hover — the global layer handles hover and press.
- **Nothing on the input path waits.** No artificial delays before acting on a tap, no disabling input during a transition.
- **Springs, not durations.** For state changes use CSS transitions with `MOTION.move` (default, no overshoot), `MOTION.snap` (small things) or `MOTION.bounce` (only after a gesture with momentum): `transition: \`transform ${MOTION.move}\``. For color/opacity feedback use `MOTION.fade` / `MOTION.quick`. For gesture-driven motion use `animateSpring` and hand it the release velocity.
- **Only animate `transform` and `opacity`** (plus color). Never animate width/height/top/left/margin.
- **Spatial consistency.** Things leave the way they came. Going deeper (list → detail) uses `<ViewTransition kind="push">`, coming back `kind="pop"`, switching peers `kind="tab"`. Popovers grow from their trigger (`Menu` does this). New content that appears in place rises in with `animation: \`z5-rise ${DURATION.move}ms var(--z5-spring) backwards\``.
- **Reduced motion / transparency / contrast** are handled globally — as long as you use the tokens, `MOTION.*`, the shared keyframes (`z5-rise`, `z5-materialize`, `z5-view-*`, `z5-pop`, `z5-ping`, `z5-shimmer`, `z5-spin`, `z5-fade-in/out`) and `data-material`. Don't add new keyframes in screens. No looping decorative animation.

## 5. Primitives (import from `../ui`)

Layout: `Page`, `CenteredColumn`, `AppShell`, `MobileNavBar`, `PageHeader({ title, subtitle, action, back: { onClick, label }, hero })`, `SectionHeader({ title, subtitle, action })`, `ViewTransition({ viewKey, kind })`.

Surfaces: `Panel({ title, action, flush, style })`, `Tile({ padding, style, onClick })`, `Divider({ inset })`, `List({ inset })`, `Row({ onClick, leading, title, subtitle, trailing, chevron, selected, disabled, as, align, wrap, style, children })`, `Disclosure({ title, subtitle, icon, count, trailing, open, defaultOpen, onToggle, tile, children })`.

Controls: `Btn({ primary, danger, plain, active, small, compact, fullWidth, icon, iconEnd, iconFlip, busy })`, `IconButton({ icon, label, size, active, danger, flip })`, `Input({ mono })`, `Textarea`, `Select({ small })`, `Field({ label, hint, inline })`, `Segmented({ options: [{ value, label, icon }], value, onChange, size, fullWidth })`, `Chip({ active, onClick, count, icon })`, `ChipRow({ label })`, `Switch({ checked, onChange, label })`, `Stepper({ value, onChange, min, max })`, `Checkbox({ checked, onChange, label, tone })`, `BackButton({ onClick, label })`.

Text and data: `Mono`, `Num`, `Badge({ tone: default|bright|ok|warn|error|info })`, `Stat({ value, label, tone, size, align })`, `Progress({ value, tone: auto|ink|ok|warn|error|info, height })`, `Avatar({ src, name, size, onClick })`, `initialsOf(name)`, `CopyField({ value, copyLabel, copiedLabel })`, `DataCard`.

Feedback: `Notice({ tone: default|info|ok|warn|error, title, icon, action })`, `ErrLine`, `OkLine`, `EmptyState({ icon, title, action, compact })`, `Skeleton`, `SkeletonRows`, `Spinner`.

Overlays: `Modal({ open, onClose, title, footer, maxWidth, variant })` (centered dialog on desktop, drag-to-dismiss bottom sheet on phones), `ConfirmDialog`, `Menu({ trigger, items, align })`, `Lightbox({ src, alt, onClose, closeLabel })`.

Constants: `ELLIPSIS`, `ABOVE_TABBAR` (the `bottom` for bars floating above the mobile tab bar), `SIDEBAR_WIDTH`, `CONTENT_MAX_WIDTH`.

## 6. Patterns — what to use for what

| Situation | Use |
| --- | --- |
| Pick one of 2–5 peers (view mode, scope, track, theme, language) | `Segmented` |
| Filter by many values / values with counts | `ChipRow` + `Chip` |
| Choose from a long list in a form | `Select` (native picker) |
| A few actions behind one button ("New…", "⋯") | `Menu` |
| A list of things you can open | `Panel` → `List` → `Row chevron` |
| Expand/collapse a group | `Disclosure` |
| Sub-view inside a screen | swap content inside `<ViewTransition kind="push"/"pop">`, header gets `back` |
| Destructive or irreversible action | `ConfirmDialog` (never an in-place "tap again to confirm" label flip) |
| Benign reversible toggle | act immediately |
| Loading a list / a block | `SkeletonRows` / `Skeleton` (not "Loading…" text) |
| Nothing to show | `EmptyState` with a next step when there is one |
| Error / success / warning message | `Notice` / `ErrLine` / `OkLine`, placed next to the control that caused it |
| A number that matters | `Stat` (or `<Num>` inline) |
| Completion / readiness | `Progress` — ink while in progress, green when complete; reserve warn/error tones for real problems |
| Person | `Avatar` + callsign in `<Mono>` + name/role in secondary |
| URL / invite code to share | `CopyField` |
| On/off setting | `Switch`; multi-select mark in a row → `Checkbox` |
| Section of a long page | `Panel title=…` (headline inside the card) or `SectionHeader` between cards |

Page anatomy: `PageHeader` (large title, optional subtitle, one primary action at the trailing edge) → the primary workflow first → secondary sections → settings/danger at the bottom. One primary (`Btn primary`) action per view; everything else is gray or plain. Labels say what happens ("Delete cycle", not "OK").

Touch targets: at least 44px tall on phones for anything tappable (primitives already are). Controls sit next to what they affect.

## 7. Checklist before shipping a screen

1. No hex/rgba literals, no left/right properties, no hardcoded English or Hebrew.
2. No uppercase/letter-spaced labels, no mono dates or numbers, no glyph icons.
3. Every tappable thing has `data-press`; destructive actions go through `ConfirmDialog`.
4. Loading, empty and error states exist and use the primitives.
5. Looks right at 390px and 1440px, paper and night, Hebrew (RTL) and English.
6. Long names truncate or wrap cleanly; numbers don't flip in RTL.
