import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth, canCreateInvites } from "../auth";
import { useI18n } from "../i18n";
import { supabase } from "../supabase";
import { Panel, PageHeader, Btn, Input, ErrLine, Badge } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { S, C, FONT_MONO } from "../theme";

// ── Mobile card for editing own gear ────────────────────────────────

function GearMobileCard({ row, onChange, onRemove, t }) {
  const [open, setOpen] = useState(false);
  const r = row;

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 5,
      marginBottom: 8,
      background: "rgba(255,255,255,0.02)",
      overflow: "hidden",
    }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          all: "unset",
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "10px 12px",
          cursor: "pointer",
          boxSizing: "border-box",
          minHeight: 0,
        }}
      >
        <span style={{
          color: C.dimmer,
          fontSize: 12,
          width: 10,
          flexShrink: 0,
          transform: open ? "rotate(90deg)" : "none",
          transition: "transform 120ms",
          display: "inline-block",
        }}>▶</span>
        <div style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}>
          <div style={{
            color: C.bright,
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            letterSpacing: "0.2px",
            textTransform: "uppercase",
          }}>
            {r.slot || "—"}
          </div>
          <div style={{
            color: C.dim,
            fontSize: 12,
            display: "flex",
            gap: 8,
            minWidth: 0,
          }}>
            <span style={{
              flex: 1,
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {r.model || <span style={{ color: C.dimmer }}>{t("gear.nomodel")}</span>}
            </span>
            {r.serial && (
              <span style={{
                fontFamily: FONT_MONO,
                color: C.text,
                fontSize: 11,
                flexShrink: 0,
              }}>
                {r.serial}
              </span>
            )}
          </div>
        </div>
      </button>

      {open && (
        <div style={{
          padding: "4px 12px 12px",
          borderTop: `1px solid ${C.border}`,
        }}>
          <CompactField label={t("gear.slot")}>
            <Input value={r.slot || ""}
                   onChange={(e) => onChange(r.id, "slot", e.target.value)} />
          </CompactField>
          <CompactField label={t("gear.model")}>
            <Input value={r.model || ""}
                   onChange={(e) => onChange(r.id, "model", e.target.value)} />
          </CompactField>
          <CompactField label={t("gear.serial")}>
            <Input mono value={r.serial || ""}
                   onChange={(e) => onChange(r.id, "serial", e.target.value)} />
          </CompactField>
          <CompactField label={t("gear.notes")}>
            <Input value={r.notes || ""}
                   onChange={(e) => onChange(r.id, "notes", e.target.value)} />
          </CompactField>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
            <Btn small onClick={() => onRemove(r.id)}>{t("gear.remove")}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function CompactField({ label, children }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        color: C.dim,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.8px",
        textTransform: "uppercase",
        marginBottom: 4,
      }}>{label}</div>
      {children}
    </div>
  );
}

const DEFAULT_SLOTS = [
  "Primary weapon",
  "Scope / optic",
  "Suppressor",
  "Secondary weapon",
  "Radio",
  "NVG / thermal",
];

// ── Sniper rifle icon — uses GunLogo.png ────────────────────────────

function RifleIcon() {
  return (
    <img
      src={`${import.meta.env.BASE_URL}GunLogo.png`}
      alt=""
      style={{
        height: "0.9em",
        maxWidth: 60,
        width: "auto",
        verticalAlign: "middle",
        marginRight: 8,
        objectFit: "contain",
      }}
    />
  );
}

// ── Personal gear (editable) ────────────────────────────────────────

export default function Gear({ embedded }) {
  const { session, profile } = useAuth();
  const { t } = useI18n();
  const userId = session?.user?.id;
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

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
    if (data) setRows((arr) => [...arr, data]);
  }

  async function removeRow(id) {
    setRows((arr) => arr.filter((r) => r.id !== id));
    await supabase.from("gear").delete().eq("id", id);
  }

  // Show squad gear for squad_leader / admin / officer
  const canViewSquad = canCreateInvites(profile?.role);

  const gearContent = (
    <>
      {loading && <div style={{ color: C.dim }}>{t("gear.loading")}</div>}
      <ErrLine>{err}</ErrLine>

      {isMobile ? (
        <div>
          {rows.map((r) => (
            <GearMobileCard
              key={r.id}
              row={r}
              onChange={update}
              onRemove={removeRow}
              t={t}
            />
          ))}
          {rows.length === 0 && !loading && (
            <div style={{ color: C.dim, fontSize: 14, padding: "8px 0" }}>
              {t("gear.empty")}
            </div>
          )}
        </div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: "22%" }}>{t("gear.slot")}</th>
              <th style={{ ...S.th, width: "28%" }}>{t("gear.model")}</th>
              <th style={{ ...S.th, width: "22%" }}>{t("gear.serial")}</th>
              <th style={S.th}>{t("gear.notes")}</th>
              <th style={{ ...S.th, width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={S.td}>
                  <Input value={r.slot || ""}
                         onChange={(e) => update(r.id, "slot", e.target.value)} />
                </td>
                <td style={S.td}>
                  <Input value={r.model || ""}
                         onChange={(e) => update(r.id, "model", e.target.value)} />
                </td>
                <td style={S.td}>
                  <Input mono value={r.serial || ""}
                         onChange={(e) => update(r.id, "serial", e.target.value)} />
                </td>
                <td style={S.td}>
                  <Input value={r.notes || ""}
                         onChange={(e) => update(r.id, "notes", e.target.value)} />
                </td>
                <td style={S.td}>
                  <Btn small onClick={() => removeRow(r.id)}>{t("gear.remove")}</Btn>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td style={S.td} colSpan={5}>{t("gear.empty")}</td></tr>
            )}
          </tbody>
        </table>
      )}
    </>
  );

  if (embedded) {
    return (
      <>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <Btn small onClick={addRow}>{t("gear.add")}</Btn>
        </div>
        {gearContent}
        {canViewSquad && <SquadGear currentUserId={userId} profile={profile} embedded />}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={<><RifleIcon /> {t("gear.title")}</>}
        subtitle={t("gear.subtitle")}
        action={<Btn small onClick={addRow}>{t("gear.add")}</Btn>}
      />
      <Panel connectTop>
        {gearContent}
      </Panel>

      {canViewSquad && <SquadGear currentUserId={userId} profile={profile} />}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════
// SQUAD GEAR — read-only view of squad members' gear in collapsible folders
// ══════════════════════════════════════════════════════════════════════

function SquadGear({ currentUserId, profile, embedded }) {
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

  const squadContent = (
    <>
      {loading && <div style={{ color: C.dim }}>{t("gear.squad_loading")}</div>}
      {!loading && members.length === 0 && (
        <div style={{ color: C.dim, fontSize: 13 }}>{t("gear.squad_empty")}</div>
      )}

      {members.map((m) => {
        const gear = gearByUser[m.id] || [];
        const isOpen = expanded.has(m.id);
        const displayName = m.callsign || m.full_name || m.id.slice(0, 8);
        const filledCount = gear.filter((g) => g.model || g.serial).length;

        return (
          <MemberGearFolder
            key={m.id}
            name={displayName}
            role={m.role}
            gearCount={filledCount}
            totalCount={gear.length}
            expanded={isOpen}
            onToggle={() => toggle(m.id)}
            isMobile={isMobile}
            t={t}
          >
            {gear.length === 0 ? (
              <div style={{ color: C.dim, fontSize: 13, padding: "8px 0" }}>
                {t("gear.no_gear")}
              </div>
            ) : (
              isMobile
                ? gear.map((g) => <ReadOnlyGearCard key={g.id} row={g} t={t} />)
                : <ReadOnlyGearTable gear={gear} t={t} />
            )}
          </MemberGearFolder>
        );
      })}
    </>
  );

  if (embedded) {
    return (
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
        <div style={{
          color: C.dim,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.8px",
          textTransform: "uppercase",
          marginBottom: 10,
        }}>{t("gear.squad_title")}</div>
        {squadContent}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={<><RifleIcon /> {t("gear.squad_title")}</>}
        subtitle={t("gear.squad_subtitle")}
      />
      <Panel connectTop>
        {squadContent}
      </Panel>
    </>
  );
}

// ── Collapsible folder for a squad member ───────────────────────────

function MemberGearFolder({ name, role, gearCount, totalCount, expanded, onToggle, isMobile, t, children }) {
  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      marginBottom: isMobile ? 10 : 12,
      background: "rgba(255,255,255,0.02)",
      overflow: "hidden",
    }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          all: "unset",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          padding: isMobile ? "14px 14px" : "14px 18px",
          cursor: "pointer",
        }}
      >
        <span style={{
          color: C.dim,
          fontSize: 12,
          width: 14,
          display: "inline-block",
          transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          transition: "transform 0.15s",
        }}>▶</span>
        <span style={{
          color: C.bright,
          fontWeight: 700,
          fontSize: isMobile ? 13 : 14,
          letterSpacing: "0.8px",
          textTransform: "uppercase",
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {name}
        </span>
        <Badge>{gearCount} / {totalCount} {t("gear.items")}</Badge>
      </button>
      {expanded && (
        <div style={{
          padding: isMobile ? "0 14px 14px" : "0 18px 16px",
          borderTop: `1px solid ${C.border}`,
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Read-only gear display (desktop table) ──────────────────────────

function ReadOnlyGearTable({ gear, t }) {
  return (
    <table style={{ ...S.table, marginTop: 8 }}>
      <thead>
        <tr>
          <th style={{ ...S.th, width: "25%" }}>{t("gear.slot")}</th>
          <th style={{ ...S.th, width: "30%" }}>{t("gear.model")}</th>
          <th style={{ ...S.th, width: "20%" }}>{t("gear.serial")}</th>
          <th style={S.th}>{t("gear.notes")}</th>
        </tr>
      </thead>
      <tbody>
        {gear.map((g) => (
          <tr key={g.id}>
            <td style={{ ...S.td, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px" }}>
              {g.slot || "—"}
            </td>
            <td style={S.td}>
              {g.model || <span style={{ color: C.dimmer }}>—</span>}
            </td>
            <td style={{ ...S.td, fontFamily: FONT_MONO, fontSize: 13 }}>
              {g.serial || <span style={{ color: C.dimmer }}>—</span>}
            </td>
            <td style={S.td}>
              {g.notes || <span style={{ color: C.dimmer }}>—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Read-only gear display (mobile card) ────────────────────────────

function ReadOnlyGearCard({ row, t }) {
  const r = row;
  const hasData = r.model || r.serial;
  return (
    <div style={{
      padding: "10px 0",
      borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{
        color: C.bright,
        fontSize: 13,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.3px",
        marginBottom: 4,
      }}>
        {r.slot || "—"}
      </div>
      {hasData ? (
        <div style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          fontSize: 12,
          color: C.dim,
        }}>
          {r.model && <span>{r.model}</span>}
          {r.serial && (
            <span style={{ fontFamily: FONT_MONO, color: C.text, fontSize: 11 }}>
              {r.serial}
            </span>
          )}
          {r.notes && <span style={{ color: C.dimmer }}>{r.notes}</span>}
        </div>
      ) : (
        <div style={{ color: C.dimmer, fontSize: 12 }}>—</div>
      )}
    </div>
  );
}
