import { useEffect, useState } from "react";
import { useAuth, roleLabelT, canCreateWholeTeamTask } from "../auth";
import { supabase } from "../supabase";
import { createMission } from "../data/missions";
import {
  Panel, PageHeader, Btn, Input, Textarea, Select, Field, ErrLine, OkLine, Badge,
  Row, List, Disclosure, Segmented, Checkbox, IconButton, Notice, EmptyState,
  Mono, Num, ViewTransition,
} from "../ui";
import { useIsMobile } from "../useIsMobile";
import { useI18n } from "../i18n";
import { C, T } from "../theme";
import {
  DEFAULT_ITEMS, SECTIONS, SECTION_LABELS, OPERATOR_ROLES,
} from "../missionTemplate";
import { SECTION_ICONS } from "./Checklist";

export default function MissionCreate({ onCreated, onCancel, prefillDate, initialKind }) {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const { t } = useI18n();

  const [kind] = useState(initialKind || "operational");

  const [name, setName] = useState("");
  const [squadId, setSquadId] = useState(profile?.squad_id || "");
  // Default to the current hour (rounded down) for both prefilled and
  // ad-hoc creation. Mission scheduled-at lands at the present hour;
  // due-at lands +1h for operational, +24h for admin.
  const [scheduledAt, setScheduledAt] = useState(() =>
    prefillDate
      ? dateToLocalInput(prefillDate, new Date().getHours())
      : defaultDateTime(0)
  );
  const [dueAt, setDueAt] = useState(() =>
    prefillDate
      ? dateToLocalInput(prefillDate, new Date().getHours() + 1)
      : defaultDateTime(24)
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

  const assignedCount = Object.values(assigned).filter(Boolean).length;
  const twoCol = {
    display: "grid",
    gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)",
    columnGap: 14,
  };

  // The native date control is a touch taller than its neighbours; pin
  // it to the field height so the two-column row lines up.
  const dateStyle = { height: isMobile ? 46 : 40 };

  const squadSelect = (
    <Select value={squadId} onChange={(e) => setSquadId(e.target.value)}>
      {squads.length === 0 && <option value="">{t("mc.nosquads")}</option>}
      {squads.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </Select>
  );

  const scopeOptions = [
    canWholeTeam ? { value: "team", label: t("mc.scope_team") } : null,
    { value: "squad", label: t("mc.scope_squad") },
    { value: "people", label: t("mc.scope_people") },
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        back={{ onClick: onCancel }}
        title={kind === "admin" ? t("mc.admin_title") : t("mc.op_title")}
        subtitle={kind === "admin"
          ? t("mc.admin_sub")
          : t("mc.op_sub")}
      />

      <form onSubmit={submit}>
        {/* ── Details ──────────────────────────────────────────────── */}
        <Panel title={kind === "admin" ? t("mc.task_details") : t("mc.mission_details")}>
          <Field label={kind === "admin" ? t("mc.title") : t("mc.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)}
                   placeholder={kind === "admin"
                     ? t("mc.ph_admin")
                     : t("mc.ph_op")} />
          </Field>

          {kind === "operational" && (
            <div style={twoCol}>
              <Field label={t("mc.datetime")}>
                <Input type="datetime-local" value={scheduledAt}
                       onChange={(e) => setScheduledAt(e.target.value)}
                       style={dateStyle} />
              </Field>
              <Field label={t("mc.squad")}>
                {squadSelect}
              </Field>
            </div>
          )}

          {kind === "admin" ? (
            <div style={twoCol}>
              <Field label={t("mc.duedate")}>
                <Input type="datetime-local" value={dueAt}
                       onChange={(e) => setDueAt(e.target.value)}
                       style={dateStyle} />
              </Field>
              <Field label={t("mc.location")}>
                <Input value={location} onChange={(e) => setLocation(e.target.value)}
                       placeholder={t("mc.location_ph")} />
              </Field>
            </div>
          ) : (
            <Field label={t("mc.location")}>
              <Input value={location} onChange={(e) => setLocation(e.target.value)}
                     placeholder={t("mc.location_ph")} />
            </Field>
          )}

          <div style={{ marginBottom: -14 }}>
            <Field label={kind === "admin" ? t("mc.body") : t("mc.notes")}>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                        placeholder={kind === "admin"
                          ? t("mc.body_ph")
                          : t("mc.notes_ph")} />
            </Field>
          </div>
        </Panel>

        {/* ── Operators — operational only ─────────────────────────── */}
        {kind === "operational" && (
          <Panel
            title={t("mc.operators")}
            action={(
              <Badge tone={assignedCount > 0 ? "bright" : "default"}>
                <Num>{assignedCount}</Num> {t("mc.assigned")}
              </Badge>
            )}
          >
            {members.length === 0 && (
              <EmptyState compact icon="people">{t("mc.noMembers")}</EmptyState>
            )}
            <List>
              {members.map((m) => (
                <OperatorRow
                  key={m.id}
                  member={m}
                  selectedRole={assigned[m.id] || ""}
                  onChange={(role) => toggleOperator(m.id, role)}
                  isMobile={isMobile}
                />
              ))}
            </List>
          </Panel>
        )}

        {/* ── Assignees — admin tasks ──────────────────────────────── */}
        {kind === "admin" && (
          <Panel
            title={t("mc.assignees")}
            action={scope === "people" && (
              <Badge tone={assignedCount > 0 ? "bright" : "default"}>
                <Num>{assignedCount}</Num> {t("mc.selected")}
              </Badge>
            )}
          >
            <Segmented
              ariaLabel={t("mc.scope_label")}
              options={scopeOptions}
              value={scope}
              onChange={changeScope}
              fullWidth={isMobile}
            />

            <ViewTransition viewKey={scope} kind="tab" style={{ marginTop: 14 }}>
              {scope === "team" && (
                <Notice icon="people">
                  {t("mc.wholeteam_desc")} (<Num>{allTeamMembers.length}</Num> {t("mc.people")}).
                </Notice>
              )}

              {scope === "squad" && (
                <>
                  <div style={{ maxWidth: isMobile ? "none" : 340, marginBottom: -4 }}>
                    <Field label={t("mc.squad")}>
                      {squadSelect}
                    </Field>
                  </div>
                  <div style={{ ...T.footnote, color: C.dim }}>
                    <Num>{members.length}</Num> {members.length === 1 ? t("mc.member") : t("mc.members")} {t("mc.insquad")}
                  </div>
                </>
              )}

              {scope === "people" && (
                <>
                  <div style={{ ...T.footnote, color: C.dim, marginBottom: 4 }}>
                    {t("mc.tap_toggle")}
                  </div>
                  {individualsPool.length === 0 && (
                    <EmptyState compact icon="people">{t("mc.no_ops")}</EmptyState>
                  )}
                  <List inset={34}>
                    {individualsPool.map((m) => (
                      <PersonPickRow
                        key={m.id}
                        member={m}
                        selected={!!assigned[m.id]}
                        onToggle={() => togglePerson(m.id)}
                      />
                    ))}
                  </List>
                </>
              )}
            </ViewTransition>
          </Panel>
        )}

        {/* ── Checklist editor — operational only ──────────────────── */}
        {kind === "operational" && (
          <Panel
            title={t("mc.checklist")}
            action={
              <Btn small type="button" icon="undo" onClick={(e) => { e.preventDefault(); setItems(DEFAULT_ITEMS); }}>
                {t("mc.reset")}
              </Btn>
            }
          >
            <div style={{ ...T.footnote, color: C.dim, marginBottom: 8 }}>
              {t("mc.checklist_help")}
            </div>
            <List>
              {SECTIONS.map((sec) => (
                <SectionEditor
                  key={sec.key}
                  section={sec}
                  isMobile={isMobile}
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
            </List>
          </Panel>
        )}

        <ErrLine>{err}</ErrLine>
        <OkLine>{ok}</OkLine>

        <div style={{
          display: "flex",
          gap: 10,
          marginTop: 16,
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "center",
        }}>
          <Btn primary type="submit" disabled={busy} busy={busy} fullWidth={isMobile}>
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

// Callsign + name/role, shared by the operator and people rows.
function memberSubtitle(member, t) {
  return (
    <>
      {member.full_name || "—"}
      <span aria-hidden style={{ color: C.dimmer, margin: "0 6px" }}>·</span>
      {roleLabelT(member.role, t)}
    </>
  );
}

// One squad member with the role they take on this mission. An empty
// value means "not assigned".
function OperatorRow({ member, selectedRole, onChange, isMobile }) {
  const { t } = useI18n();
  const picker = (
    <Select
      small
      value={selectedRole}
      onChange={(e) => onChange(e.target.value)}
      aria-label={`${t("mc.operators")}: ${member.callsign || member.full_name || ""}`}
      wrapStyle={{ width: isMobile ? "100%" : 200 }}
      style={{
        color: selectedRole ? C.bright : C.dim,
        fontWeight: selectedRole ? 600 : 400,
        // 16px keeps iOS from zooming the page when the picker opens.
        ...(isMobile ? { fontSize: 16, minHeight: 44 } : null),
      }}
    >
      <option value="">{t("mc.notassigned")}</option>
      {OPERATOR_ROLES.map((r) => (
        <option key={r.key} value={r.key}>{r.label}</option>
      ))}
    </Select>
  );
  // Phones: the picker sits under the name at full width, so neither the
  // name nor the chosen role is ever cut short.
  return (
    <Row
      as="div"
      title={<Mono>{member.callsign || "—"}</Mono>}
      subtitle={memberSubtitle(member, t)}
      trailing={isMobile ? null : picker}
      style={isMobile ? { paddingBlock: 12 } : undefined}
    >
      {isMobile && <div style={{ marginTop: 8 }}>{picker}</div>}
    </Row>
  );
}

// The whole row toggles; the check mark is presentational.
function PersonPickRow({ member, selected, onToggle }) {
  const { t } = useI18n();
  return (
    <Row
      onClick={onToggle}
      role="checkbox"
      aria-checked={selected}
      leading={<Checkbox checked={selected} />}
      title={<Mono>{member.callsign || "—"}</Mono>}
      subtitle={memberSubtitle(member, t)}
    />
  );
}

function SectionEditor({ section, items, onItemsChange, isMobile }) {
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
    <Disclosure
      defaultOpen
      title={SECTION_LABELS[section.key]}
      icon={SECTION_ICONS[section.key]}
      count={items.length}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 2 }}>
        {items.map((it, idx) => (
          <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Input
              value={it.label}
              aria-label={`${t("mc.item_label")} ${idx + 1}`}
              onChange={(e) => updateItem(idx, e.target.value)}
              // Enter while editing the checklist must not create the
              // mission by accident.
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              style={{ flex: 1, minWidth: 0 }}
            />
            <IconButton
              icon="trash"
              label={t("mc.remove_item")}
              size={isMobile ? 44 : 36}
              onClick={(e) => { e.preventDefault(); removeItem(idx); }}
              style={{ background: "transparent", color: C.dim }}
            />
          </div>
        ))}
        <div>
          <Btn small plain type="button" icon="plus" onClick={(e) => { e.preventDefault(); addItem(); }}>
            {t("mc.add_item")}
          </Btn>
        </div>
      </div>
    </Disclosure>
  );
}

function defaultDateTime(offsetHours = 0) {
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
