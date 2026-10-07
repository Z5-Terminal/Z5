import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth, canCreateInvites } from "../auth";
import { useI18n } from "../i18n";
import { supabase } from "../supabase";
import {
  Panel, PageHeader, SectionHeader, Tile, Btn, IconButton, Input, Field, Stepper,
  ErrLine, Badge, Mono, Num, Avatar, List, Disclosure, ConfirmDialog, EmptyState,
  SkeletonRows, ELLIPSIS,
} from "../ui";
import { useIsMobile } from "../useIsMobile";
import { S, C, R, T } from "../theme";
import { MOTION, DURATION, prefersReducedMotion } from "../motion";

const DEFAULT_SLOTS = [
  "Primary weapon",
  "Scope / optic",
  "Suppressor",
  "Magazines",
  "Secondary weapon",
  "Radio",
  "NVG / thermal",
];

// ── Weapon-build pins ────────────────────────────────────────────────
// Marker positions (% of the rifle image) for rifle-mounted slots.
// Slots without a pin render as plain equipment cards below the build.
const PIN_MAP = [
  { match: /primary/i,        x: 33,   y: 56 },
  { match: /scope|optic/i,    x: 38,   y: 20 },
  { match: /suppressor/i,     x: 88,   y: 40 },
  { match: /magaz/i,          x: 44.5, y: 80 },
];
function pinFor(slot) {
  return PIN_MAP.find((p) => p.match.test(slot || "")) || null;
}
const isQtySlot = (slot) => /magaz/i.test(slot || "");

// Slot names are stored in English (see DEFAULT_SLOTS / "Custom"); the
// known ones are shown through the dictionary, anything else verbatim.
const SLOT_LABEL_KEYS = {
  "Primary weapon": "gear.primary",
  "Scope / optic": "gear.scope",
  "Suppressor": "gear.suppressor",
  "Magazines": "gear.magazines",
  "Secondary weapon": "gear.secondary",
  "Radio": "gear.radio",
  "NVG / thermal": "gear.nvg",
  "Custom": "gear.custom",
};
function slotLabel(slot, t) {
  const key = SLOT_LABEL_KEYS[slot];
  return key ? t(key) : (slot || "—");
}

// Rifle artwork geometry (intrinsic pixels) — reserves the space while
// the image loads so the pins never jump.
const RIFLE_ASPECT = "1844 / 853";
const RIFLE_MAX_WIDTH = 760;

// A serial is a code: always left-to-right, isolated from Hebrew around it.
const CODE_TEXT = { direction: "ltr", unicodeBidi: "isolate" };

// ── Personal gear (editable) ────────────────────────────────────────

export default function Gear({ embedded }) {
  const { session, profile } = useAuth();
  const { t } = useI18n();
  const userId = session?.user?.id;
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [addedId, setAddedId] = useState(null);
  const [pendingRemove, setPendingRemove] = useState(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("gear").select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    if (error) { setErr(String(error.message)); setLoading(false); return; }
    if (!data || data.length === 0) {
      const seed = DEFAULT_SLOTS.map((slot, i) => ({
        user_id: userId, slot, model: "", serial: "", sort_order: i,
      }));
      const { data: inserted, error: e2 } = await supabase
        .from("gear").insert(seed).select();
      if (e2) setErr(String(e2.message));
      setRows(inserted || []);
    } else if (!data.some((r) => isQtySlot(r.slot))) {
      // Older inventories predate the Magazines slot — add it once.
      const { data: mag } = await supabase
        .from("gear")
        .insert({ user_id: userId, slot: "Magazines", model: "", serial: "", qty: 0, sort_order: data.length })
        .select().single();
      setRows(mag ? [...data, mag] : data);
    } else {
      setRows(data);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function update(id, field, value) {
    setRows((arr) => arr.map((r) => r.id === id ? { ...r, [field]: value } : r));
    await supabase.from("gear").update({ [field]: value }).eq("id", id);
  }

  async function addRow() {
    const sort = rows.length;
    const { data } = await supabase.from("gear")
      .insert({ user_id: userId, slot: "Custom", model: "", serial: "", sort_order: sort })
      .select().single();
    if (data) {
      setRows((arr) => [...arr, data]);
      setAddedId(data.id);
    }
  }

  async function removeRow(id) {
    setRows((arr) => arr.filter((r) => r.id !== id));
    await supabase.from("gear").delete().eq("id", id);
  }

  // Show squad gear for squad_leader / admin / officer
  const canViewSquad = canCreateInvites(profile?.role);

  const content = (
    <>
      <ErrLine>{err}</ErrLine>
      {loading
        ? <BuildSkeleton />
        : (
          <WeaponBuild
            rows={rows}
            addedId={addedId}
            onChange={update}
            onAdd={addRow}
            onRemove={setPendingRemove}
          />
        )}
      <ConfirmDialog
        open={!!pendingRemove}
        title={t("gear.remove_title")}
        message={pendingRemove ? t("gear.remove_body", { slot: slotLabel(pendingRemove.slot, t) }) : ""}
        confirmLabel={t("gear.remove")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => {
          const row = pendingRemove;
          setPendingRemove(null);
          if (row) removeRow(row.id);
        }}
        onCancel={() => setPendingRemove(null)}
      />
      {canViewSquad && <SquadGear currentUserId={userId} profile={profile} />}
    </>
  );

  // Embedded (inside Profile): the host screen owns the page title.
  if (embedded) return content;

  return (
    <>
      <PageHeader title={t("gear.title")} subtitle={t("gear.subtitle")} />
      {content}
    </>
  );
}

// Placeholder with the same anatomy as the loaded build.
function BuildSkeleton() {
  const isMobile = useIsMobile();
  return (
    <Panel flush>
      <div aria-busy="true">
        <div style={{ background: C.imageSurface }}>
          <div style={{ maxWidth: RIFLE_MAX_WIDTH, marginInline: "auto", aspectRatio: RIFLE_ASPECT }} />
        </div>
        <div style={{ padding: isMobile ? "6px 16px 10px" : "8px 22px 12px" }}>
          <SkeletonRows rows={3} />
        </div>
      </div>
    </Panel>
  );
}

// ══════════════════════════════════════════════════════════════════════
// WEAPON BUILD — the rifle photo with numbered pins on its mounted
// components; each component is an attachment card with model + serial
// (or amount, for magazines). A pin and its card are linked: hovering
// either with a mouse, tapping a pin, or tapping / focusing a card
// highlights both. Non-mounted slots are plain equipment cards below.
// ══════════════════════════════════════════════════════════════════════

function WeaponBuild({ rows, addedId, onChange, onAdd, onRemove }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  // Selection sticks (tap / focus); hover is a transient mouse preview.
  const [activeId, setActiveId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const cardEls = useRef({});

  const pinned = rows.filter((r) => pinFor(r.slot));
  const rest   = rows.filter((r) => !pinFor(r.slot));
  const linkedId = hoverId != null ? hoverId : activeId;
  const anyLinked = pinned.some((r) => r.id === linkedId);

  // Bring a card into view when it is (partly) off-screen, keeping it
  // clear of the sticky top bar and the floating tab bar on phones.
  // (Measured by hand: the flush Panel clips its content, which makes
  // scrollIntoView ignore scroll margins.)
  function reveal(id) {
    const el = cardEls.current[id];
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    const clearTop = isMobile ? 72 : 20;
    const clearBottom = isMobile ? 112 : 20;
    const limit = window.innerHeight - clearBottom;
    let dy = 0;
    if (r.top < clearTop) dy = r.top - clearTop;
    else if (r.bottom > limit) dy = Math.min(r.bottom - limit, r.top - clearTop);
    if (dy !== 0) window.scrollBy({ top: dy, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  function selectPin(id) {
    if (activeId === id) { setActiveId(null); return; }
    setActiveId(id);
    reveal(id);
  }

  // A freshly added row lands at the end of the equipment grid — follow it.
  useEffect(() => {
    if (addedId != null) reveal(addedId);
  }, [addedId]);

  const hoverProps = (id) => ({
    onPointerEnter: (e) => { if (e.pointerType === "mouse") setHoverId(id); },
    onPointerLeave: (e) => { if (e.pointerType === "mouse") setHoverId((cur) => (cur === id ? null : cur)); },
  });

  const grid = {
    display: "grid",
    gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)",
    gap: 10,
  };
  const sectionTitle = { ...S.panelTitle, margin: 0, marginBottom: isMobile ? 10 : 12, fontSize: isMobile ? 16 : 17 };

  if (rows.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon="rifle"
          title={t("gear.empty")}
          action={<Btn small type="button" icon="plus" onClick={onAdd}>{t("gear.add")}</Btn>}
        >
          {t("gear.empty_hint")}
        </EmptyState>
      </Panel>
    );
  }

  return (
    <>
      <Panel flush>
        {/* The rifle — image-context surface, intrinsically black in both
            themes. Tapping the artwork itself clears the selection. */}
        <div
          onClick={() => setActiveId(null)}
          style={{ background: C.imageSurface }}
        >
          <div style={{ position: "relative", maxWidth: RIFLE_MAX_WIDTH, marginInline: "auto" }}>
            <img
              src={`${import.meta.env.BASE_URL}gear-rifle.jpg`}
              alt=""
              style={{ width: "100%", display: "block", aspectRatio: RIFLE_ASPECT }}
            />
            {pinned.map((r, i) => (
              <Pin
                key={r.id}
                pin={pinFor(r.slot)}
                number={i + 1}
                label={slotLabel(r.slot, t)}
                active={linkedId === r.id}
                dimmed={anyLinked && linkedId !== r.id}
                onSelect={() => selectPin(r.id)}
                onPreview={(on) => setHoverId((cur) => (on ? r.id : (cur === r.id ? null : cur)))}
              />
            ))}
          </div>
        </div>

        {/* Mounted components */}
        {pinned.length > 0 && (
          <div style={{ padding: isMobile ? "14px 16px 16px" : "18px 22px 22px" }}>
            <h2 style={sectionTitle}>{t("gear.attachments")}</h2>
            <div style={grid}>
              {pinned.map((r, i) => (
                <LoadoutCard
                  key={r.id}
                  row={r}
                  number={i + 1}
                  active={linkedId === r.id}
                  cardRef={(el) => { cardEls.current[r.id] = el; }}
                  onActivate={() => setActiveId(r.id)}
                  hoverProps={hoverProps(r.id)}
                  onChange={onChange}
                  onRemove={onRemove}
                />
              ))}
            </div>
          </div>
        )}
      </Panel>

      {/* Everything not mounted on the rifle */}
      <Panel title={t("gear.equipment")}>
        {rest.length > 0 && (
          <div style={{ ...grid, marginBottom: 12 }}>
            {rest.map((r) => (
              <LoadoutCard
                key={r.id}
                row={r}
                isNew={r.id === addedId}
                cardRef={(el) => { cardEls.current[r.id] = el; }}
                onActivate={() => setActiveId(null)}
                onChange={onChange}
                onRemove={onRemove}
              />
            ))}
          </div>
        )}
        <Btn small type="button" icon="plus" onClick={onAdd}>{t("gear.add")}</Btn>
      </Panel>
    </>
  );
}

// Numbered marker over the rifle artwork. `left` / `top` are image-space
// percentages on purpose: they must not mirror in RTL.
function Pin({ pin, number, label, active, dimmed, onSelect, onPreview }) {
  const isMobile = useIsMobile();
  const size = isMobile ? 24 : 28;
  return (
    <div style={{
      position: "absolute",
      left: `${pin.x}%`,
      top: `${pin.y}%`,
      width: 44,
      height: 44,
      transform: "translate(-50%, -50%)",
    }}>
      <button
        type="button"
        data-press="scale"
        data-press-depth="deep"
        aria-label={`${number}. ${label}`}
        aria-pressed={active}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onPointerEnter={(e) => { if (e.pointerType === "mouse") onPreview(true); }}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") onPreview(false); }}
        onFocus={(e) => {
          // Keyboard focus previews the link too (the default focus ring
          // is ink and would vanish on the dark artwork in paper mode).
          let keyboard = false;
          try { keyboard = e.currentTarget.matches(":focus-visible"); } catch { /* older engines */ }
          if (keyboard) onPreview(true);
        }}
        onBlur={() => onPreview(false)}
        style={{
          all: "unset",
          boxSizing: "border-box",
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: R.pill,
          cursor: "pointer",
          outline: "none",
        }}
      >
        {/* Halo — grows out of the pin when linked. */}
        <span aria-hidden style={{
          position: "absolute",
          width: size + 16,
          height: size + 16,
          borderRadius: R.pill,
          background: `${C.imageTint}0.3)`,
          opacity: active ? 1 : 0,
          transform: active ? "scale(1)" : "scale(0.6)",
          transition: `transform ${MOTION.bounce}, opacity ${MOTION.fade}`,
        }} />
        <span style={{
          position: "relative",
          width: size,
          height: size,
          borderRadius: R.pill,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Image-context ink: the artwork is black in both themes, so
          // the marker is always light with dark figures.
          background: C.imageOverlayText,
          color: C.imageSurface,
          boxShadow: `0 0 0 2px ${C.imageShade}0.55)`,
          fontSize: isMobile ? 12 : 13,
          fontWeight: 700,
          lineHeight: 1,
          opacity: dimmed ? 0.55 : 1,
          transform: active ? "scale(1.2)" : "scale(1)",
          transition: `transform ${MOTION.bounce}, opacity ${MOTION.fade}`,
        }}>
          <Num>{number}</Num>
        </span>
      </button>
    </div>
  );
}

// The same number the pin carries, as an ink circle on the card.
function NumberMark({ number, active }) {
  return (
    <span aria-hidden style={{
      width: 22,
      height: 22,
      flexShrink: 0,
      borderRadius: R.pill,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: C.tint,
      color: C.onTint,
      fontSize: 12,
      fontWeight: 700,
      lineHeight: 1,
      transform: active ? "scale(1.14)" : "scale(1)",
      transition: `transform ${MOTION.bounce}`,
    }}>
      <Num>{number}</Num>
    </span>
  );
}

function LoadoutCard({ row, number, active, isNew, cardRef, onActivate, hoverProps, onChange, onRemove }) {
  const { t, isRTL } = useI18n();
  const isMobile = useIsMobile();
  const qtySlot = isQtySlot(row.slot);
  const label = slotLabel(row.slot, t);
  const stacked = isMobile && !qtySlot;
  const controlHeight = isMobile ? 46 : 40;
  return (
    <div
      ref={cardRef}
      {...hoverProps}
      onClickCapture={onActivate}
      onFocus={onActivate}
      style={{
        minWidth: 0,
        ...(isNew ? { animation: `z5-rise ${DURATION.move}ms var(--z5-spring) backwards` } : null),
      }}
    >
      <Tile
        padding="10px 14px 0"
        style={{
          height: "100%",
          background: active ? C.fillStrong : C.cardBg,
          boxShadow: active ? `inset 0 0 0 1.5px ${C.bright}` : `inset 0 0 0 1.5px transparent`,
          transition: `background-color ${MOTION.fade}, box-shadow ${MOTION.fade}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 32, marginBottom: 8 }}>
          {number != null && <NumberMark number={number} active={active} />}
          <div style={{ flex: 1, minWidth: 0, ...T.callout, fontWeight: 600, color: C.bright, ...ELLIPSIS }}>
            {label}
          </div>
          <IconButton
            icon="xmark"
            label={`${t("gear.remove")}: ${label}`}
            size={isMobile ? 44 : 30}
            onClick={() => onRemove(row)}
            style={{
              background: "transparent",
              color: C.dimmer,
              marginBlock: isMobile ? -6 : 0,
              marginInlineEnd: isMobile ? -12 : -6,
            }}
          />
        </div>

        <div style={{
          display: "flex",
          flexDirection: stacked ? "column" : "row",
          alignItems: stacked ? "stretch" : "flex-start",
          columnGap: 10,
        }}>
          <div style={{ flex: stacked ? "none" : "1.7 1 0", minWidth: 0 }}>
            <Field label={t("gear.model")}>
              <Input
                aria-label={`${label}: ${t("gear.model")}`}
                value={row.model || ""}
                onChange={(e) => onChange(row.id, "model", e.target.value)}
              />
            </Field>
          </div>
          {qtySlot ? (
            <div style={{ flexShrink: 0 }}>
              <Field label={t("gear.qty")}>
                <div style={{ minHeight: controlHeight, display: "flex", alignItems: "center" }}>
                  <Stepper
                    value={row.qty ?? 0}
                    onChange={(v) => onChange(row.id, "qty", v)}
                    decLabel={t("gear.qty_dec")}
                    incLabel={t("gear.qty_inc")}
                  />
                </div>
              </Field>
            </div>
          ) : (
            <div style={{ flex: stacked ? "none" : "1 1 0", minWidth: 0 }}>
              <Field label={t("gear.serial")}>
                <Input
                  mono
                  dir="ltr"
                  aria-label={`${label}: ${t("gear.serial")}`}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  value={row.serial || ""}
                  onChange={(e) => onChange(row.id, "serial", e.target.value)}
                  style={{ textAlign: isRTL ? "end" : "start" }}
                />
              </Field>
            </div>
          )}
        </div>
      </Tile>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// SQUAD GEAR — read-only view of squad members' gear in collapsible groups
// ══════════════════════════════════════════════════════════════════════

function SquadGear({ currentUserId, profile }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const isAdminOfficer = profile?.role === "admin" || profile?.role === "officer";

  const [members, setMembers] = useState([]);
  const [gearByUser, setGearByUser] = useState({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);

    // Load squad members (admins see all; squad_leaders see their squad)
    let mq = supabase.from("profiles")
      .select("id, callsign, full_name, role, squad_id")
      .order("callsign");
    if (!isAdminOfficer) {
      mq = mq.eq("squad_id", profile?.squad_id);
    }
    const { data: memberData } = await mq;
    const filtered = (memberData || []).filter((m) => m.id !== currentUserId);
    setMembers(filtered);

    if (filtered.length === 0) { setLoading(false); return; }

    // Load all gear for these members
    const ids = filtered.map((m) => m.id);
    const { data: gearData } = await supabase
      .from("gear")
      .select("*")
      .in("user_id", ids)
      .order("sort_order", { ascending: true });

    const map = {};
    for (const g of gearData || []) {
      if (!map[g.user_id]) map[g.user_id] = [];
      map[g.user_id].push(g);
    }
    setGearByUser(map);
    setLoading(false);
  }, [currentUserId, profile?.squad_id, isAdminOfficer]);

  useEffect(() => { load(); }, [load]);

  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const firstLoad = loading && members.length === 0;

  return (
    <>
      <SectionHeader title={t("gear.squad_title")} subtitle={t("gear.squad_subtitle")} />
      <Panel style={{ marginTop: 0, padding: isMobile ? "6px 16px" : "8px 22px" }}>
        {firstLoad && <SkeletonRows rows={3} />}
        {!loading && members.length === 0 && (
          <EmptyState icon="people" compact>{t("gear.squad_empty")}</EmptyState>
        )}
        {members.length > 0 && (
          <List>
            {members.map((m) => {
              const gear = gearByUser[m.id] || [];
              const filledCount = gear.filter((g) => g.model || g.serial).length;
              const displayName = m.callsign || m.full_name || m.id.slice(0, 8);
              return (
                <Disclosure
                  key={m.id}
                  open={expanded.has(m.id)}
                  onToggle={() => toggle(m.id)}
                  icon={<Avatar name={displayName} size={32} />}
                  title={m.callsign || !m.full_name ? <Mono>{displayName}</Mono> : displayName}
                  subtitle={m.callsign ? m.full_name : null}
                  trailing={(
                    <Badge>
                      <Num>{`${filledCount} / ${gear.length}`}</Num>
                      {!isMobile && <span>{t("gear.items")}</span>}
                    </Badge>
                  )}
                >
                  {gear.length === 0 ? (
                    <EmptyState icon={null} compact>{t("gear.no_gear")}</EmptyState>
                  ) : isMobile ? (
                    <div style={{ display: "grid", gap: 8, paddingTop: 2, paddingBottom: 6 }}>
                      {gear.map((g) => <ReadOnlyGearTile key={g.id} row={g} />)}
                    </div>
                  ) : (
                    <ReadOnlyGearTable gear={gear} />
                  )}
                </Disclosure>
              );
            })}
          </List>
        )}
      </Panel>
    </>
  );
}

const Blank = () => <span style={{ color: C.dimmer }}>—</span>;

// Serial column: the code, or the amount for quantity slots (which have
// no serial of their own). Returns null when there is nothing to show.
function serialOrQty(row, t) {
  if (row.serial) return <Mono style={{ ...CODE_TEXT, fontSize: 13 }}>{row.serial}</Mono>;
  if (isQtySlot(row.slot) && row.qty != null) {
    return <span style={{ color: C.dim }}>{t("gear.qty")} <Num style={{ color: C.text }}>{row.qty}</Num></span>;
  }
  return null;
}

// ── Read-only gear display (desktop table) ──────────────────────────

function ReadOnlyGearTable({ gear }) {
  const { t } = useI18n();
  const last = gear.length - 1;
  const td = (i, extra) => ({
    ...S.td,
    ...(i === last ? { borderBottom: "none" } : null),
    ...extra,
  });
  return (
    <table style={{ ...S.table, marginBottom: 4, tableLayout: "fixed" }}>
      <thead>
        <tr>
          <th style={{ ...S.th, width: "24%" }}>{t("gear.slot")}</th>
          <th style={{ ...S.th, width: "32%" }}>{t("gear.model")}</th>
          <th style={{ ...S.th, width: "20%" }}>{t("gear.serial")}</th>
          <th style={S.th}>{t("gear.notes")}</th>
        </tr>
      </thead>
      <tbody>
        {gear.map((g, i) => (
          <tr key={g.id}>
            <td style={td(i, { fontWeight: 600, color: C.bright })}>{slotLabel(g.slot, t)}</td>
            <td style={td(i, { overflowWrap: "anywhere" })}>{g.model || <Blank />}</td>
            <td style={td(i, { overflowWrap: "anywhere" })}>{serialOrQty(g, t) || <Blank />}</td>
            <td style={td(i, { overflowWrap: "anywhere" })}>{g.notes || <Blank />}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Read-only gear display (phone tile) ─────────────────────────────

function ReadOnlyGearTile({ row }) {
  const { t } = useI18n();
  const code = serialOrQty(row, t);
  const hasData = row.model || code || row.notes;
  return (
    <Tile padding="10px 12px">
      <div style={{ ...T.callout, fontWeight: 600, color: C.bright }}>{slotLabel(row.slot, t)}</div>
      {hasData ? (
        <div style={{ ...T.footnote, color: C.text, marginTop: 2, overflowWrap: "anywhere" }}>
          {row.model && <div>{row.model}</div>}
          {code && <div style={{ color: C.dim }}>{code}</div>}
          {row.notes && <div style={{ color: C.dim }}>{row.notes}</div>}
        </div>
      ) : (
        <div style={{ ...T.footnote, marginTop: 2 }}><Blank /></div>
      )}
    </Tile>
  );
}
