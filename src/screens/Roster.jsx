import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth, roleLabel, canManageSquads, canCreateInvites } from "../auth";
import { useI18n } from "../i18n";
import { supabase } from "../supabase";
import { Panel, PageHeader, Btn, Input, Field, ErrLine, OkLine, Badge, Mono } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, S } from "../theme";

const SQUAD_STATUS_LABELS = {
  active:   "ACTIVE",
  training: "IN BOOTCAMP",
};
const SQUAD_STATUS_TONES = {
  active:   "ok",
  training: "warn",
};
const SQUAD_STATUS_ORDER = { active: 0, training: 1 };

const ROLE_OPTIONS = ["sniper", "squad_leader"];

function shortCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "Z5-";
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  s += "-";
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export default function Roster() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const [squads, setSquads] = useState([]);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [showCreateSquad, setShowCreateSquad] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    const [{ data: sq }, { data: ms }, { data: inv }] = await Promise.all([
      supabase.from("squads").select("*").order("name"),
      supabase.from("profiles").select("*").order("callsign"),
      supabase.from("invites").select("*").order("created_at", { ascending: false }),
    ]);
    setSquads(sq || []);
    setMembers(ms || []);
    setInvites(inv || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel("z5-roster")
      .on("postgres_changes", { event: "*", schema: "public", table: "squads"   }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "invites"  }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const isManager = canManageSquads(profile?.role);
  const showCreateInvite = canCreateInvites(profile?.role);

  const sortedSquads = useMemo(() => {
    return [...squads].sort((a, b) => {
      const sa = SQUAD_STATUS_ORDER[a.status ?? "active"] ?? 0;
      const sb = SQUAD_STATUS_ORDER[b.status ?? "active"] ?? 0;
      if (sa !== sb) return sa - sb;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [squads]);

  async function changeSquadStatus(squad, nextStatus) {
    setErr(""); setOk("");
    const { error } = await supabase
      .from("squads")
      .update({ status: nextStatus })
      .eq("id", squad.id);
    if (error) { setErr(error.message); return; }
    setOk(`Squad "${squad.name}" → ${SQUAD_STATUS_LABELS[nextStatus]}.`);
    load();
  }

  async function updateSquad(squad, updates) {
    setErr(""); setOk("");
    const { error } = await supabase
      .from("squads")
      .update(updates)
      .eq("id", squad.id);
    if (error) { setErr(error.message); return; }
    setOk(`Squad "${updates.name || squad.name}" updated.`);
    load();
  }

  async function deleteSquad(squad) {
    setErr(""); setOk("");
    // Unassign members first
    const { error: e1 } = await supabase
      .from("profiles")
      .update({ squad_id: null })
      .eq("squad_id", squad.id);
    if (e1) { setErr(e1.message); return; }
    const { error: e2 } = await supabase
      .from("squads")
      .delete()
      .eq("id", squad.id);
    if (e2) { setErr(e2.message); return; }
    setOk(`Squad "${squad.name}" deleted.`);
    load();
  }

  async function updateMemberRole(member, newRole) {
    setErr(""); setOk("");
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", member.id);
    if (error) { setErr(error.message); return; }
    setOk(`${member.callsign || member.email} → ${roleLabel(newRole)}.`);
    load();
  }

  async function assignMemberToSquad(member, squadId) {
    setErr(""); setOk("");
    const { error } = await supabase
      .from("profiles")
      .update({ squad_id: squadId })
      .eq("id", member.id);
    if (error) { setErr(error.message); return; }
    const sq = squads.find((s) => s.id === squadId);
    setOk(t("ros.member_assigned", { who: member.callsign || member.email, squad: sq?.name || "—" }));
    load();
  }

  async function toggleInstructor(member) {
    setErr(""); setOk("");
    const newVal = !member.is_instructor;
    const { error } = await supabase
      .from("profiles")
      .update({ is_instructor: newVal })
      .eq("id", member.id);
    if (error) { setErr(error.message); return; }
    setOk(`${member.callsign || member.email} → ${newVal ? t("ros.instructor_on") : t("ros.instructor_off")}`);
    load();
  }

  async function removeMemberFromSquad(member) {
    setErr(""); setOk("");
    const { error } = await supabase
      .from("profiles")
      .update({ squad_id: null })
      .eq("id", member.id);
    if (error) { setErr(error.message); return; }
    setOk(`${member.callsign || member.email} removed from squad.`);
    load();
  }

  async function deleteMember(member) {
    setErr(""); setOk("");
    const { data, error } = await supabase.rpc("delete_member", {
      p_user_id: member.id,
    });
    if (error) { setErr(error.message); return; }
    const who = data?.deleted || member.callsign || member.email;
    setOk(`${who} deleted.`);
    load();
  }

  async function deleteInvite(invite) {
    setErr(""); setOk("");
    const { error } = await supabase
      .from("invites")
      .delete()
      .eq("id", invite.id);
    if (error) { setErr(error.message); return; }
    setOk(`Invite ${invite.code} deleted.`);
    load();
  }

  return (
    <>
      <PageHeader
        title={t("ros.title")}
        subtitle={t("ros.subtitle")}
        action={isManager && (
          <Btn small primary onClick={() => setShowCreateSquad(!showCreateSquad)}>
            {showCreateSquad ? t("mis.cancel") : t("ros.new_squad")}
          </Btn>
        )}
      />

      <Panel connectTop>
        {showCreateSquad && (
          <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${C.border}` }}>
            <CreateSquadPanel onCreated={(msg) => { setOk(msg); setShowCreateSquad(false); load(); }} setErr={setErr} />
          </div>
        )}

        {squads.length === 0 && !showCreateSquad && (
          <div style={{ color: C.dim, fontSize: 13 }}>{t("ros.nosquads")}</div>
        )}

        {sortedSquads.map((sq) => (
          <SquadBlock
            key={sq.id}
            squad={sq}
            allSquads={sortedSquads}
            members={members.filter((m) => m.squad_id === sq.id)}
            canManage={isManager}
            onChangeStatus={changeSquadStatus}
            onUpdateSquad={updateSquad}
            onDeleteSquad={deleteSquad}
            onUpdateMemberRole={updateMemberRole}
            onAssignSquad={assignMemberToSquad}
            onRemoveMember={removeMemberFromSquad}
            onDeleteMember={deleteMember}
            onToggleInstructor={toggleInstructor}
            currentUserId={profile?.id}
          />
        ))}

        {isManager && members.some((m) => !m.squad_id) && (
          <SquadBlock
            squad={{ id: null, name: t("ros.unassigned") }}
            allSquads={sortedSquads}
            members={members.filter((m) => !m.squad_id)}
            canManage={isManager}
            onUpdateMemberRole={updateMemberRole}
            onAssignSquad={assignMemberToSquad}
            onRemoveMember={removeMemberFromSquad}
            onDeleteMember={deleteMember}
            onToggleInstructor={toggleInstructor}
            currentUserId={profile?.id}
            isUnassignedBlock
          />
        )}
      </Panel>

      {showCreateInvite && (
        <div style={{ marginTop: 28 }}>
          <InvitesPanel
            squads={squads}
            invites={invites}
            profile={profile}
            onChanged={(msg) => { setOk(msg); load(); }}
            onDeleteInvite={deleteInvite}
            setErr={setErr}
          />
        </div>
      )}

      <ErrLine>{err}</ErrLine>
      <OkLine>{ok}</OkLine>
    </>
  );
}

/* ═══════════════════════════════════════════════
   SQUAD BLOCK — with edit/delete
   ═══════════════════════════════════════════════ */
function SquadBlock({
  squad, allSquads = [], members, canManage, onChangeStatus, onUpdateSquad, onDeleteSquad,
  onUpdateMemberRole, onAssignSquad, onRemoveMember, onDeleteMember, onToggleInstructor, currentUserId, isUnassignedBlock = false,
}) {
  const { t } = useI18n();
  const isMobile = useIsMobile();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(squad.name || "");
  const [editBootcamp, setEditBootcamp] = useState(squad.is_bootcamp || false);
  const [confirmDel, setConfirmDel] = useState(false);

  function handleSaveSquad() {
    if (!editName.trim()) return;
    onUpdateSquad(squad, {
      name: editName.trim().toUpperCase(),
      is_bootcamp: editBootcamp,
    });
    setEditing(false);
  }

  // Status transition actions removed per user request (no Mark training / Archive)

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 4,
      padding: isMobile ? "12px 10px" : "16px 20px",
      marginBottom: isMobile ? 10 : 14,
      background: C.panel,
      opacity: 1,
    }}>
      {/* ── Squad header ── */}
      <div style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        alignItems: isMobile ? "flex-start" : "center",
        gap: isMobile ? 8 : 10,
        marginBottom: 10,
      }}>
        {editing ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flex: 1, width: isMobile ? "100%" : "auto" }}>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)}
                   style={{ width: isMobile ? "100%" : 180 }} />
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: C.text, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={editBootcamp} onChange={(e) => setEditBootcamp(e.target.checked)}
                     style={{ width: 16, height: 16, accentColor: C.warn }} />
              {t("ros.bootcamp")}
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              <Btn small primary onClick={handleSaveSquad}>{t("mis.save")}</Btn>
              <Btn small onClick={() => { setEditing(false); setEditName(squad.name); setEditBootcamp(squad.is_bootcamp); }}>{t("mis.cancel")}</Btn>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ color: C.bright, fontSize: isMobile ? 14 : 15, fontWeight: 600 }}>{squad.name}</span>
            {squad.is_bootcamp
              ? <Badge tone="warn">{t("nav.bootcamp")}</Badge>
              : <Badge tone="ok">{t("ros.active")}</Badge>}
            <Badge>{members.length} {members.length === 1 ? t("ros.member") : t("ros.members")}</Badge>
          </div>
        )}

        {canManage && !editing && !isUnassignedBlock && (
          <div style={{
            marginLeft: isMobile ? 0 : "auto",
            display: "flex",
            gap: 6,
            flexShrink: 0,
          }}>
            <Btn small onClick={() => setEditing(true)}>{t("mis.edit")}</Btn>
            {!confirmDel ? (
              <Btn small onClick={() => setConfirmDel(true)}>{t("mis.delete")}</Btn>
            ) : (
              <>
                <Btn small style={{ color: C.error, borderColor: C.error }}
                     onClick={() => { onDeleteSquad(squad); setConfirmDel(false); }}>
                  {t("mis.confirm_delete")}
                </Btn>
                <Btn small onClick={() => setConfirmDel(false)}>{t("mis.cancel")}</Btn>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Members ── */}
      {isMobile ? (
        <div>
          {members.map((m) => (
            <MemberCardMobile
              key={m.id}
              member={m}
              canManage={canManage}
              isCurrentUser={m.id === currentUserId}
              onChangeRole={onUpdateMemberRole}
              onAssignSquad={onAssignSquad}
              onRemove={onRemoveMember}
              onDelete={onDeleteMember}
              onToggleInstructor={onToggleInstructor}
              allSquads={allSquads}
              isUnassignedBlock={isUnassignedBlock}
            />
          ))}
          {members.length === 0 && (
            <div style={{ color: C.dim, fontSize: 14, padding: "6px 0" }}>{t("ros.nomembers")}</div>
          )}
        </div>
      ) : (
        <table style={{ ...S.table, marginBottom: 0 }}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: "18%" }}>{t("ros.callsign")}</th>
              <th style={{ ...S.th, width: "20%" }}>{t("ros.name")}</th>
              <th style={{ ...S.th, width: "14%" }}>{t("ros.role")}</th>
              <th style={{ ...S.th }}>{t("ros.email")}</th>
              {canManage && <th style={{ ...S.th, width: "22%", textAlign: "right" }}></th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <MemberRowDesktop
                key={m.id}
                member={m}
                canManage={canManage}
                isCurrentUser={m.id === currentUserId}
                onChangeRole={onUpdateMemberRole}
                onAssignSquad={onAssignSquad}
                onRemove={onRemoveMember}
                onDelete={onDeleteMember}
                onToggleInstructor={onToggleInstructor}
                allSquads={allSquads}
                isUnassignedBlock={isUnassignedBlock}
              />
            ))}
            {members.length === 0 && (
              <tr><td style={{ ...S.td, color: C.dim }} colSpan={canManage ? 5 : 4}>{t("ros.nomembers")}</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ── Desktop member row with role change + remove ── */
function MemberRowDesktop({ member, canManage, isCurrentUser, onChangeRole, onAssignSquad, onRemove, onDelete, onToggleInstructor, allSquads = [], isUnassignedBlock = false }) {
  const { t } = useI18n();
  const [editingRole, setEditingRole] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const assignableSquads = (allSquads || []).filter((s) => s.id && s.id !== member.squad_id);

  return (
    <tr>
      <td style={S.td}><Mono>{member.callsign || "—"}</Mono></td>
      <td style={S.td}>{member.full_name || <span style={{ color: C.dim }}>—</span>}</td>
      <td style={S.td}>
        {editingRole ? (
          <select
            value={member.role}
            onChange={(e) => { onChangeRole(member, e.target.value); setEditingRole(false); }}
            onBlur={() => setEditingRole(false)}
            autoFocus
            style={{ ...S.input, fontSize: 12, padding: "4px 8px", width: 140 }}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{roleLabel(r)}</option>
            ))}
          </select>
        ) : (
          <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
            <Badge tone="bright">{roleLabel(member.role)}</Badge>
            {member.is_instructor && <Badge tone="warn">INSTRUCTOR</Badge>}
          </span>
        )}
      </td>
      <td style={{ ...S.td, color: C.dim }}>{member.email}</td>
      {canManage && (
        <td style={{ ...S.td, textAlign: "right", whiteSpace: "nowrap" }}>
          <div style={{ display: "inline-flex", gap: 4, justifyContent: "flex-end" }}>
            {/* Assign/Move is available for everyone including self */}
            {onAssignSquad && assignableSquads.length > 0 && (
              assigning ? (
                <select
                  autoFocus
                  defaultValue=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) { onAssignSquad(member, v); setAssigning(false); }
                  }}
                  onBlur={() => setAssigning(false)}
                  style={{ ...S.input, fontSize: 12, padding: "4px 8px", width: 140 }}
                >
                  <option value="">{t("ros.pick_squad")}</option>
                  {assignableSquads.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              ) : (
                <Btn small onClick={() => setAssigning(true)}>
                  {isUnassignedBlock ? t("ros.assign") : t("ros.move")}
                </Btn>
              )
            )}
            {/* Role change, instructor toggle, remove, delete — not for self */}
            {!isCurrentUser && (
              <>
              <Btn small onClick={() => setEditingRole(!editingRole)}>
                {editingRole ? t("mis.cancel") : t("ros.change_role")}
              </Btn>
              <Btn small onClick={() => onToggleInstructor && onToggleInstructor(member)}
                   style={member.is_instructor ? { color: C.warn, borderColor: "rgba(255,170,0,0.3)" } : {}}>
                {member.is_instructor ? t("ros.revoke_instructor") : t("ros.make_instructor")}
              </Btn>
              {!isUnassignedBlock && member.squad_id && (
                !confirmRemove ? (
                  <Btn small onClick={() => setConfirmRemove(true)}>{t("ros.remove_member")}</Btn>
                ) : (
                  <>
                    <Btn small style={{ color: C.warn, borderColor: C.warn }}
                         onClick={() => { onRemove(member); setConfirmRemove(false); }}>
                      {t("ros.confirm_remove")}
                    </Btn>
                    <Btn small onClick={() => setConfirmRemove(false)}>{t("mis.cancel")}</Btn>
                  </>
                )
              )}
              {onDelete && (
                !confirmDelete ? (
                  <Btn small style={{ color: C.error, borderColor: "rgba(255,85,85,0.3)" }}
                       onClick={() => setConfirmDelete(true)}>
                    {t("ros.delete_user")}
                  </Btn>
                ) : (
                  <>
                    <Btn small style={{ color: C.error, borderColor: C.error, background: "rgba(255,85,85,0.1)" }}
                         onClick={() => { onDelete(member); setConfirmDelete(false); }}>
                      {t("ros.confirm_delete_user")}
                    </Btn>
                    <Btn small onClick={() => setConfirmDelete(false)}>{t("mis.cancel")}</Btn>
                  </>
                )
              )}
              </>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

/* ── Mobile member card with role change + remove ── */
function MemberCardMobile({ member, canManage, isCurrentUser, onChangeRole, onAssignSquad, onRemove, onDelete, onToggleInstructor, allSquads = [], isUnassignedBlock = false }) {
  const { t } = useI18n();
  const [editingRole, setEditingRole] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const assignableSquads = (allSquads || []).filter((s) => s.id && s.id !== member.squad_id);

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      padding: "12px 14px",
      marginBottom: 10,
      background: "rgba(255,255,255,0.02)",
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
        gap: 10,
      }}>
        <Mono style={{ color: C.bright, fontWeight: 600, fontSize: 15 }}>
          {member.callsign || "—"}
        </Mono>
        {editingRole ? (
          <select
            value={member.role}
            onChange={(e) => { onChangeRole(member, e.target.value); setEditingRole(false); }}
            style={{ ...S.input, fontSize: 14, padding: "6px 10px", width: 150, minHeight: 36 }}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{roleLabel(r)}</option>
            ))}
          </select>
        ) : (
          <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
            <Badge tone="bright">{roleLabel(member.role)}</Badge>
            {member.is_instructor && <Badge tone="warn">INSTRUCTOR</Badge>}
          </span>
        )}
      </div>
      <div style={{ fontSize: 14, color: C.text, marginBottom: 2 }}>
        {member.full_name || <span style={{ color: C.dim }}>—</span>}
      </div>
      <div style={{
        fontSize: 12,
        color: C.dim,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        marginBottom: canManage && !isCurrentUser ? 8 : 0,
      }}>
        {member.email}
      </div>
      {canManage && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {/* Assign/Move available for everyone including self */}
          {onAssignSquad && assignableSquads.length > 0 && (
            assigning ? (
              <select
                autoFocus
                defaultValue=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) { onAssignSquad(member, v); setAssigning(false); }
                }}
                onBlur={() => setAssigning(false)}
                style={{ ...S.input, fontSize: 14, padding: "6px 10px", minHeight: 36, flex: 1 }}
              >
                <option value="">{t("ros.pick_squad")}</option>
                {assignableSquads.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            ) : (
              <Btn small onClick={() => setAssigning(true)}>
                {isUnassignedBlock ? t("ros.assign") : t("ros.move")}
              </Btn>
            )
          )}
          {/* Role change, instructor toggle, remove, delete — not for self */}
          {!isCurrentUser && (
            <>
            <Btn small onClick={() => setEditingRole(!editingRole)}>
              {editingRole ? t("mis.cancel") : t("ros.change_role")}
            </Btn>
            <Btn small onClick={() => onToggleInstructor && onToggleInstructor(member)}
                 style={member.is_instructor ? { color: C.warn, borderColor: "rgba(255,170,0,0.3)" } : {}}>
              {member.is_instructor ? t("ros.revoke_instructor") : t("ros.make_instructor")}
            </Btn>
            {!isUnassignedBlock && member.squad_id && (
              !confirmRemove ? (
                <Btn small onClick={() => setConfirmRemove(true)}>{t("ros.remove_member")}</Btn>
              ) : (
                <>
                  <Btn small style={{ color: C.warn, borderColor: C.warn }}
                       onClick={() => { onRemove(member); setConfirmRemove(false); }}>
                    {t("ros.confirm_remove")}
                  </Btn>
                  <Btn small onClick={() => setConfirmRemove(false)}>{t("mis.cancel")}</Btn>
                </>
              )
            )}
            {onDelete && (
              !confirmDelete ? (
                <Btn small style={{ color: C.error, borderColor: "rgba(255,85,85,0.3)" }}
                     onClick={() => setConfirmDelete(true)}>
                  {t("ros.delete_user")}
                </Btn>
              ) : (
                <>
                  <Btn small style={{ color: C.error, borderColor: C.error, background: "rgba(255,85,85,0.1)" }}
                       onClick={() => { onDelete(member); setConfirmDelete(false); }}>
                    {t("ros.confirm_delete_user")}
                  </Btn>
                  <Btn small onClick={() => setConfirmDelete(false)}>{t("mis.cancel")}</Btn>
                </>
              )
            )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   CREATE SQUAD PANEL
   ═══════════════════════════════════════════════ */
function CreateSquadPanel({ onCreated, setErr }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [isBootcamp, setIsBootcamp] = useState(false);
  const [busy, setBusy] = useState(false);
  const isMobile = useIsMobile();

  async function create(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const nm = name.trim().toUpperCase();
      if (!nm) throw new Error(t("ros.err_squad_name"));
      const { error } = await supabase.from("squads").insert({
        name: nm,
        status: isBootcamp ? "training" : "active",
        is_bootcamp: isBootcamp,
      });
      if (error) throw error;
      setName("");
      setIsBootcamp(false);
      onCreated(t("ros.squad_created", { name: nm }));
    } catch (e) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={create}>
      <div style={{
        display: "flex",
        gap: 12,
        alignItems: isMobile ? "stretch" : "flex-end",
        flexWrap: "wrap",
        flexDirection: isMobile ? "column" : "row",
      }}>
        <Field label={t("ros.squad_name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)}
                 placeholder={t("ros.squad_ph")}
                 style={{ width: isMobile ? "100%" : 240 }} />
        </Field>
        <label style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          color: C.text,
          fontSize: 14,
          minHeight: isMobile ? 46 : 36,
          alignSelf: isMobile ? "flex-start" : "center",
          paddingBottom: isMobile ? 0 : 2,
        }}>
          <input
            type="checkbox"
            checked={isBootcamp}
            onChange={(e) => setIsBootcamp(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: C.warn }}
          />
          <span>{t("ros.bootcamp")}</span>
        </label>
      </div>
      <div style={{ marginTop: 12 }}>
        <Btn primary type="submit" disabled={busy} fullWidth={isMobile}>
          {busy ? t("ros.registering") : t("ros.register")}
        </Btn>
      </div>
    </form>
  );
}

/* ═══════════════════════════════════════════════
   INVITES PANEL — with delete
   ═══════════════════════════════════════════════ */
function InvitesPanel({ squads, invites, profile, onChanged, onDeleteInvite, setErr }) {
  const { t } = useI18n();
  const isAdmin = profile?.role === "admin" || profile?.role === "officer";
  const isMobile = useIsMobile();

  const allowedSquads = isAdmin ? squads : squads.filter((s) => s.id === profile?.squad_id);
  const allowedRoles  = isAdmin
    ? ["sniper", "squad_leader", "officer", "admin"]
    : ["sniper"];

  const [squadId, setSquadId] = useState(allowedSquads[0]?.id || "");
  const [role, setRole] = useState("sniper");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!allowedSquads.find((s) => s.id === squadId)) {
      setSquadId(allowedSquads[0]?.id || "");
    }
  }, [allowedSquads, squadId]);

  const squadOptional = role === "admin" || role === "officer";

  async function create(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      if (!squadOptional && !squadId) throw new Error(t("ros.err_select_squad"));
      const code = shortCode();
      const { error } = await supabase.from("invites").insert({
        code, squad_id: squadId || null, role,
      });
      if (error) throw error;
      onChanged(t("ros.invite_generated", { code }));
      setShowForm(false);
    } catch (e) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader
        title={t("ros.invites_title")}
        subtitle={t("ros.invites_sub")}
        action={
          <Btn small primary onClick={() => setShowForm(!showForm)}>
            {showForm ? t("mis.cancel") : t("ros.generate")}
          </Btn>
        }
      />

      <Panel connectTop>
        {showForm && (
          <form onSubmit={create} style={{
            marginBottom: 20,
            paddingBottom: 20,
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            gap: 14,
            alignItems: isMobile ? "stretch" : "flex-end",
            flexWrap: "wrap",
            flexDirection: isMobile ? "column" : "row",
          }}>
            <Field inline label={t("mc.squad")}>
              <select value={squadId}
                      onChange={(e) => setSquadId(e.target.value)}
                      style={{
                        ...S.input,
                        width: isMobile ? "100%" : 260,
                        fontSize: isMobile ? 16 : S.input.fontSize,
                        minHeight: isMobile ? 46 : undefined,
                      }}>
                {squadOptional && <option value="">{t("ros.no_squad")}</option>}
                {allowedSquads.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                {allowedSquads.length === 0 && !squadOptional && <option value="">{t("mc.nosquads")}</option>}
              </select>
            </Field>
            <Field inline label={t("ros.role")}>
              <select value={role}
                      onChange={(e) => {
                        const r = e.target.value;
                        setRole(r);
                        if (r === "admin" || r === "officer") setSquadId("");
                      }}
                      style={{
                        ...S.input,
                        width: isMobile ? "100%" : 220,
                        fontSize: isMobile ? 16 : S.input.fontSize,
                        minHeight: isMobile ? 46 : undefined,
                      }}>
                {allowedRoles.map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
            </Field>
            <Btn primary type="submit" disabled={busy || (!squadOptional && !squadId)}>
              {busy ? t("ros.generating") : t("ros.generate")}
            </Btn>
          </form>
        )}

        {isMobile ? (
          <div>
            {invites.map((inv) => (
              <InviteCardMobile key={inv.id} invite={inv} squads={squads}
                                canDelete={isAdmin} onDelete={onDeleteInvite} />
            ))}
            {invites.length === 0 && (
              <div style={{ color: C.dim, fontSize: 14, padding: "6px 0" }}>{t("ros.noinvites")}</div>
            )}
          </div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>{t("ros.code")}</th>
                <th style={S.th}>{t("mc.squad")}</th>
                <th style={S.th}>{t("ros.role")}</th>
                <th style={S.th}>{t("ros.status")}</th>
                <th style={S.th}>{t("ros.created")}</th>
                {isAdmin && <th style={S.th}></th>}
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <InviteRowDesktop key={inv.id} invite={inv} squads={squads}
                                  canDelete={isAdmin} onDelete={onDeleteInvite} />
              ))}
              {invites.length === 0 && (
                <tr><td style={{ ...S.td, color: C.dim }} colSpan={isAdmin ? 6 : 5}>{t("ros.noinvites")}</td></tr>
              )}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

function InviteRowDesktop({ invite, squads, canDelete, onDelete }) {
  const { t } = useI18n();
  const sq = squads.find((s) => s.id === invite.squad_id);
  const used = !!invite.used_by;
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <tr>
      <td style={S.td}>
        <Mono style={{ color: used ? C.dim : C.bright, fontWeight: 600 }}>{invite.code}</Mono>
      </td>
      <td style={S.td}>{sq?.name || "—"}</td>
      <td style={S.td}>{roleLabel(invite.role)}</td>
      <td style={S.td}>
        {used ? <Badge>{t("ros.used")}</Badge> : <Badge tone="ok">{t("ros.available")}</Badge>}
      </td>
      <td style={{ ...S.td, color: C.dim }}>
        {new Date(invite.created_at).toLocaleString([], {
          month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
        })}
      </td>
      {canDelete && (
        <td style={S.td}>
          {!used && (
            !confirmDel ? (
              <Btn small onClick={() => setConfirmDel(true)}>{t("mis.delete")}</Btn>
            ) : (
              <div style={{ display: "flex", gap: 4 }}>
                <Btn small style={{ color: C.error, borderColor: C.error }}
                     onClick={() => { onDelete(invite); setConfirmDel(false); }}>
                  {t("mis.confirm_delete")}
                </Btn>
                <Btn small onClick={() => setConfirmDel(false)}>{t("mis.cancel")}</Btn>
              </div>
            )
          )}
        </td>
      )}
    </tr>
  );
}

function InviteCardMobile({ invite, squads, canDelete, onDelete }) {
  const { t } = useI18n();
  const sq = squads.find((s) => s.id === invite.squad_id);
  const used = !!invite.used_by;
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      padding: "12px 14px",
      marginBottom: 10,
      background: "rgba(255,255,255,0.02)",
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        marginBottom: 8,
      }}>
        <Mono style={{ color: used ? C.dim : C.bright, fontWeight: 700, fontSize: 15 }}>
          {invite.code}
        </Mono>
        {used ? <Badge>{t("ros.used")}</Badge> : <Badge tone="ok">{t("ros.available")}</Badge>}
      </div>
      <div style={{ fontSize: 13, color: C.text, marginBottom: 2 }}>
        {sq?.name || "—"} · {roleLabel(invite.role)}
      </div>
      <div style={{ fontSize: 11, color: C.dim }}>
        {new Date(invite.created_at).toLocaleString([], {
          month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
        })}
      </div>
      {canDelete && !used && (
        <div style={{ marginTop: 8 }}>
          {!confirmDel ? (
            <Btn small onClick={() => setConfirmDel(true)}>{t("mis.delete")}</Btn>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <Btn small style={{ color: C.error, borderColor: C.error }}
                   onClick={() => { onDelete(invite); setConfirmDel(false); }}>
                {t("mis.confirm_delete")}
              </Btn>
              <Btn small onClick={() => setConfirmDel(false)}>{t("mis.cancel")}</Btn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
