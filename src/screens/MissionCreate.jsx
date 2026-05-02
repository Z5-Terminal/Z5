import { useEffect, useState } from "react";
import { useAuth, roleLabel, canCreateWholeTeamTask } from "../auth";
import { supabase } from "../supabase";
import { createMission } from "../data/missions";
import {
  Panel, PageHeader, Btn, Input, Textarea, Field, ErrLine, OkLine, Badge,
} from "../ui";
import { useIsMobile } from "../useIsMobile";
import { useI18n } from "../i18n";
import { C, S, FONT_MONO } from "../theme";
import {
  DEFAULT_ITEMS, SECTIONS, SECTION_LABELS, OPERATOR_ROLES,
} from "../missionTemplate";

export default function MissionCreate({ onCreated, onCancel, prefillDate, initialKind }) {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const { t } = useI18n();

  const [kind] = useState(initialKind || "operational");

  const [name, setName] = useState("");
  const [squadId, setSquadId] = useState(profile?.squad_id || "");
  const [scheduledAt, setScheduledAt] = useState(
    prefillDate ? dateToLocalInput(prefillDate, 9) : defaultDateTime(2)
  );
  const [dueAt, setDueAt] = useState(
    prefillDate ? dateToLocalInput(prefillDate, 17) : defaultDateTime(24)
  );
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const [squads, setSquads] = useState([]);
  const [members, setMembers] = useState([]);          // for operational: members of selected squad
  const [allTeamMembers, setAllTeamMembers] = useState([]); // for admin: entire team
  const [assigned, setAssigned] = useState({});        // user_id -> role key (operational) OR "yes" (admin)
  const [items, setItems] = useState(DEFAULT_ITEMS);

  // Admin task scope: "team" | "squad" | "people"
  const [scope, setScope] = useState("team");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const isAdminOfficer = profile?.role === "admin" || profile?.role === "officer";
  const canWholeTeam   = canCreateWholeTeamTask(profile?.role);

  // Load squads. Squad leaders are locked to their own squad.
  useEffect(() => {
    (async () => {
      const { data: sq } = await supabase.from("squads").select("*").order("name");
      const allowed = isAdminOfficer
        ? (sq || [])
        : (sq || []).filter((s) => s.id === profile?.squad_id);
      setSquads(allowed);
      if (!squadId && allowed[0]) setSquadId(allowed[0].id);
    })();
  }, [isAdminOfficer, profile?.squad_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load members of currently selected squad (used by operational + "pick squad" scope).
  useEffect(() => {
    if (!squadId) { setMembers([]); return; }
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("id, callsign, full_name, role, squad_id")
        .eq("squad_id", squadId)
        .order("callsign");
      setMembers(data || []);
    })();
  }, [squadId]);

  // Load entire team (admin/officer only, used by "whole team" and "pick individuals").
  useEffect(() => {
    if (kind !== "admin" || !canWholeTeam) return;
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("id, callsign, full_name, role, squad_id")
        .order("callsign");
      setAllTeamMembers(data || []);
    })();
  }, [kind, canWholeTeam]);

  // When switching kind, reset assignments so we don't send stale roles.
  useEffect(() => {
    setAssigned({});
    setErr(""); setOk("");
    if (kind === "admin") {
      // Default scope for leads (no whole-team permission) is "squad".
      setScope(canWholeTeam ? "team" : "squad");
    }
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  // When changing scope within admin, reset assignments + adjust squadId.
  function changeScope(next) {
    setScope(next);
    setAssigned({});
    if (next === "team") {
      // nothing to prefill
    } else if (next === "squad") {
      if (!squadId && squads[0]) setSquadId(squads[0].id);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setErr(""); setOk("");

    if (!name.trim()) { setErr(t("mc.err_name")); return; }

    let operatorsArr = [];
    let effectiveSquadId = null;

    if (kind === "operational") {
      operatorsArr = Object.entries(assigned)
        .filter(([, role]) => !!role)
        .map(([user_id, role]) => ({ user_id, role }));
      if (!squadId) { setErr(t("mc.err_squad")); return; }
      if (operatorsArr.length === 0) { setErr(t("mc.err_assign")); return; }
      if (items.length === 0) { setErr(t("mc.err_checklist")); return; }
      effectiveSquadId = squadId;
    } else {
      // admin
      if (scope === "team") {
        if (!canWholeTeam) { setErr(t("mc.err_permission")); return; }
        operatorsArr = allTeamMembers.map((m) => ({ user_id: m.id, role: "" }));
        effectiveSquadId = null;
      } else if (scope === "squad") {
        if (!squadId) { setErr(t("mc.err_squad")); return; }
        operatorsArr = members.map((m) => ({ user_id: m.id, role: "" }));
        effectiveSquadId = squadId;
      } else if (scope === "people") {
        operatorsArr = Object.keys(assigned)
          .filter((uid) => assigned[uid])
          .map((uid) => ({ user_id: uid, role: "" }));
        effectiveSquadId = null; // visible only to picked individuals
      }
      if (operatorsArr.length === 0) { setErr(t("mc.err_no_assignees")); return; }
    }

    setBusy(true);
    const { data, error } = await createMission({
      name:        name.trim(),
      squadId:     effectiveSquadId,
      scheduledAt: kind === "operational" && scheduledAt
                     ? new Date(scheduledAt).toISOString() : null,
      dueAt:       kind === "admin" && dueAt
                     ? new Date(dueAt).toISOString() : null,
      location:    location.trim(),
      notes:       notes.trim(),
      operators:   operatorsArr,
      items:       kind === "operational" ? items : null,
      kind,
    });
    setBusy(false);
    if (error) { setErr(String(error.message || error)); return; }
    setOk(kind === "admin" ? t("mc.task_posted") : t("mc.mission_created"));
    onCreated?.(data);
  }

  function toggleOperator(userId, role) {
    setAssigned((a) => {
      const next = { ...a };
      if (next[userId] === role) delete next[userId];
      else next[userId] = role;
      return next;
    });
  }

  function togglePerson(userId) {
    setAssigned((a) => {
      const next = { ...a };
      if (next[userId]) delete next[userId];
      else next[userId] = "yes";
      return next;
    });
  }

  // Dedup candidate list for "pick individuals" scope.
  const individualsPool = kind === "admin" && canWholeTeam
    ? allTeamMembers
    : members;

  return (
    <>
      <PageHeader
        title={kind === "admin" ? t("mc.admin_title") : t("mc.op_title")}
        subtitle={kind === "admin"
          ? t("mc.admin_sub")
          : t("mc.op_sub")}
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={onCancel} fullWidth={isMobile}>{t("mc.cancel")}</Btn>
          </div>
        }
      />

      <form onSubmit={submit}>
        <Panel title={kind === "admin" ? t("mc.task_details") : t("mc.mission_details")}>
          <Field label={kind === "admin" ? t("mc.title") : t("mc.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)}
                   placeholder={kind === "admin"
                     ? t("mc.ph_admin")
                     : t("mc.ph_op")} />
          </Field>

          {kind === "operational" && (
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 14,
            }}>
              <Field label={t("mc.datetime")}>
                <Input type="datetime-local" value={scheduledAt}
                       onChange={(e) => setScheduledAt(e.target.value)} />
              </Field>
              <Field label={t("mc.squad")}>
                <select value={squadId}
                        onChange={(e) => setSquadId(e.target.value)}
                        style={selectStyle(isMobile)}>
                  {squads.length === 0 && <option value="">{t("mc.nosquads")}</option>}
                  {squads.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {kind === "admin" && (
            <Field label={t("mc.duedate")}>
              <Input type="datetime-local" value={dueAt}
                     onChange={(e) => setDueAt(e.target.value)} />
            </Field>
          )}

          <Field label={kind === "admin" ? t("mc.location") : t("mc.location")}>
            <Input value={location} onChange={(e) => setLocation(e.target.value)}
                   placeholder={t("mc.location_ph")} />
          </Field>
          <Field label={kind === "admin" ? t("mc.body") : t("mc.notes")}>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder={kind === "admin"
                        ? t("mc.body_ph")
                        : t("mc.notes_ph")} />
          </Field>
        </Panel>

        {/* Assignees */}
        {kind === "operational" && (
          <Panel title={`${t("mc.operators")} (${Object.values(assigned).filter(Boolean).length} ${t("mc.assigned")})`}>
            {members.length === 0 && (
              <div style={{ color: C.dim, fontSize: 13 }}>
                {t("mc.noMembers")}
              </div>
            )}
            {members.map((m) => (
              <OperatorRow
                key={m.id}
                member={m}
                selectedRole={assigned[m.id] || ""}
                onChange={(role) => toggleOperator(m.id, role)}
                isMobile={isMobile}
              />
            ))}
          </Panel>
        )}

        {kind === "admin" && (
          <Panel title={t("mc.assignees")}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {canWholeTeam && (
                <Btn type="button" active={scope === "team"} onClick={() => changeScope("team")}>
                  {t("mc.wholeteam")}
                </Btn>
              )}
              <Btn type="button" active={scope === "squad"} onClick={() => changeScope("squad")}>
                {t("mc.picksquad")}
              </Btn>
              <Btn type="button" active={scope === "people"} onClick={() => changeScope("people")}>
                {t("mc.pickpeople")}
              </Btn>
            </div>

            {scope === "team" && (
              <div style={{ color: C.dim, fontSize: 13 }}>
                {t("mc.wholeteam_desc")} ({allTeamMembers.length} {t("mc.people")}).
              </div>
            )}

            {scope === "squad" && (
              <>
                <Field label={t("mc.squad")}>
                  <select value={squadId}
                          onChange={(e) => setSquadId(e.target.value)}
                          style={selectStyle(isMobile)}>
                    {squads.length === 0 && <option value="">{t("mc.nosquads")}</option>}
                    {squads.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </Field>
                <div style={{ color: C.dim, fontSize: 12 }}>
                  {members.length} {members.length === 1 ? t("mc.member") : t("mc.members")} {t("mc.insquad")}
                </div>
              </>
            )}

            {scope === "people" && (
              <>
                <div style={{ color: C.dim, fontSize: 12, marginBottom: 8 }}>
                  {t("mc.tap_toggle")}
                </div>
                {individualsPool.length === 0 && (
                  <div style={{ color: C.dim, fontSize: 13 }}>{t("mc.no_ops")}</div>
                )}
                {individualsPool.map((m) => (
                  <PersonPickRow
                    key={m.id}
                    member={m}
                    selected={!!assigned[m.id]}
                    onToggle={() => togglePerson(m.id)}
                    isMobile={isMobile}
                  />
                ))}
              </>
            )}
          </Panel>
        )}

        {/* Checklist — operational only */}
        {kind === "operational" && (
          <Panel
            title={t("mc.checklist")}
            action={
              <Btn small onClick={(e) => { e.preventDefault(); setItems(DEFAULT_ITEMS); }}>
                {t("mc.reset")}
              </Btn>
            }
          >
            <div style={{ color: C.dim, fontSize: 12, marginBottom: 14 }}>
              {t("mc.checklist_help")}
            </div>
            {SECTIONS.map((sec) => (
              <SectionEditor
                key={sec.key}
                section={sec}
                items={items.filter((it) => it.section === sec.key)}
                onItemsChange={(sectionItems) => {
                  setItems((all) => [
                    ...all.filter((it) => it.section !== sec.key),
                    ...sectionItems.map((it, idx) => ({
                      ...it,
                      section: sec.key,
                      order_no: idx + 1,
                    })),
                  ]);
                }}
              />
            ))}
          </Panel>
        )}

        <ErrLine>{err}</ErrLine>
        <OkLine>{ok}</OkLine>

        <div style={{
          display: "flex",
          gap: 10,
          marginTop: 10,
          flexDirection: isMobile ? "column" : "row",
        }}>
          <Btn primary type="submit" disabled={busy} fullWidth={isMobile}>
            {busy ? (kind === "admin" ? t("mc.posting") : t("mc.creating"))
                  : (kind === "admin" ? t("mc.post_task") : t("mc.create_mission"))}
          </Btn>
          <Btn type="button" onClick={onCancel} fullWidth={isMobile}>
            {t("mc.cancel")}
          </Btn>
        </div>
      </form>
    </>
  );
}

function selectStyle(isMobile) {
  return {
    ...S.input,
    fontSize: isMobile ? 16 : S.input.fontSize,
    minHeight: isMobile ? 46 : undefined,
  };
}

function OperatorRow({ member, selectedRole, onChange, isMobile }) {
  const { t } = useI18n();
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 0",
      borderBottom: `1px solid ${C.border}`,
      flexWrap: "wrap",
    }}>
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{
          fontFamily: FONT_MONO,
          color: C.bright,
          fontWeight: 600,
          fontSize: 14,
          letterSpacing: "0.3px",
        }}>
          {member.callsign || "—"}
        </div>
        <div style={{ color: C.dim, fontSize: 12 }}>
          {member.full_name || <span style={{ color: C.dimmer }}>—</span>}
          {" · "}
          <span>{roleLabel(member.role)}</span>
        </div>
      </div>
      <select
        value={selectedRole}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...S.input,
          width: isMobile ? "100%" : 200,
          fontSize: isMobile ? 16 : S.input.fontSize,
          minHeight: isMobile ? 46 : undefined,
        }}
      >
        <option value="">{t("mc.notassigned")}</option>
        {OPERATOR_ROLES.map((r) => (
          <option key={r.key} value={r.key}>{r.label}</option>
        ))}
      </select>
    </div>
  );
}

function PersonPickRow({ member, selected, onToggle, isMobile }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        all: "unset",
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        boxSizing: "border-box",
        padding: isMobile ? "12px 4px" : "10px 4px",
        minHeight: isMobile ? 48 : 40,
        borderBottom: `1px solid ${C.border}`,
        cursor: "pointer",
      }}
    >
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        flexShrink: 0,
        border: `1px solid ${selected ? C.ok : C.borderBright}`,
        background: selected ? C.selectedBg : "transparent",
        color: selected ? C.ok : "transparent",
        fontSize: 16,
        fontWeight: 700,
        borderRadius: 2,
      }}>
        ✓
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: FONT_MONO,
          color: C.bright,
          fontWeight: 600,
          fontSize: 14,
        }}>
          {member.callsign || "—"}
        </div>
        <div style={{
          color: C.dim,
          fontSize: 12,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {member.full_name || "—"} · {roleLabel(member.role)}
        </div>
      </div>
    </button>
  );
}

function SectionEditor({ section, items, onItemsChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useI18n();

  function updateItem(idx, label) {
    const next = items.map((it, i) => (i === idx ? { ...it, label } : it));
    onItemsChange(next);
  }
  function removeItem(idx) {
    onItemsChange(items.filter((_, i) => i !== idx));
  }
  function addItem() {
    onItemsChange([...items, { label: t("mc.add_item"), order_no: items.length + 1 }]);
  }

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 4,
      padding: "10px 12px",
      marginBottom: 10,
      background: C.cardBg,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
      }} onClick={() => setCollapsed((c) => !c)}>
        <span style={{
          color: C.dimmer,
          fontSize: 12,
          transform: collapsed ? "none" : "rotate(90deg)",
          transition: "transform 120ms",
          display: "inline-block",
          width: 10,
        }}>▶</span>
        <div style={{
          color: C.bright,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "1px",
          textTransform: "uppercase",
          flex: 1,
        }}>
          {SECTION_LABELS[section.key]}
        </div>
        <Badge>{items.length}</Badge>
      </div>

      {!collapsed && (
        <div style={{ marginTop: 10 }}>
          {items.map((it, idx) => (
            <div key={idx} style={{
              display: "flex",
              gap: 8,
              marginBottom: 6,
              alignItems: "center",
            }}>
              <Input value={it.label}
                     onChange={(e) => updateItem(idx, e.target.value)} />
              <Btn small onClick={(e) => { e.preventDefault(); removeItem(idx); }}>
                ×
              </Btn>
            </div>
          ))}
          <div style={{ marginTop: 6 }}>
            <Btn small onClick={(e) => { e.preventDefault(); addItem(); }}>
              {t("mc.add_item")}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function defaultDateTime(offsetHours = 2) {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + offsetHours);
  return fmtLocal(d);
}

// Pre-fill from a calendar Date at a given hour (e.g. 09:00 for scheduled, 17:00 for due).
function dateToLocalInput(date, hour = 9) {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return fmtLocal(d);
}

function fmtLocal(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
