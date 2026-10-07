import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useAuth, roleLabelT, canManageSquads, canCreateInvites } from "../auth";
import { useI18n, fmtWhen } from "../i18n";
import { supabase } from "../supabase";
import { profileAvatarPublicUrl } from "../data/avatars";
import {
  Panel, PageHeader, SectionHeader, Btn, IconButton, Input, Select, Switch, Field,
  Notice, Badge, Mono, Num, Avatar, Row, List, Menu, ConfirmDialog, EmptyState,
  SkeletonRows, ELLIPSIS,
} from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, S, T } from "../theme";
import { DURATION } from "../motion";

const SQUAD_STATUS_ORDER = { active: 0, training: 1 };

const ROLE_OPTIONS = ["sniper", "squad_leader"];

const RISE = `z5-rise ${DURATION.move}ms var(--z5-spring) backwards`;

// Where a success / error message is shown: next to what caused it.
const SCOPE_PAGE = "page";
const SCOPE_CREATE = "create";
const SCOPE_UNASSIGNED = "unassigned";
const SCOPE_INVITES = "invites";
const scopeOfMember = (member) => member.squad_id || SCOPE_UNASSIGNED;

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
  const isMobile = useIsMobile();
  const [squads, setSquads] = useState([]);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [msgScope, setMsgScope] = useState(SCOPE_PAGE);
  const [showCreateSquad, setShowCreateSquad] = useState(false);
  // Pending destructive action awaiting confirmation: { kind, item }.
  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

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
    setLoading(false);
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

  // Start of every action: clear the previous message and say where the
  // next one belongs.
  function begin(scope) {
    setErr(""); setOk("");
    setMsgScope(scope);
  }

  async function updateSquad(squad, updates) {
    begin(squad.id);
    const { error } = await supabase
      .from("squads")
      .update(updates)
      .eq("id", squad.id);
    if (error) { setErr(error.message); return; }
    setOk(t("ros.squad_updated", { name: updates.name || squad.name }));
    load();
  }

  async function deleteSquad(squad) {
    begin(squad.id);
    // Unassign members first
    const { error: e1 } = await supabase.rpc("admin_clear_squad_members", {
      p_squad_id: squad.id,
    });
    if (e1) { setErr(e1.message); return; }
    const { error: e2 } = await supabase
      .from("squads")
      .delete()
      .eq("id", squad.id);
    if (e2) { setErr(e2.message); return; }
    setMsgScope(SCOPE_PAGE);
    setOk(t("ros.squad_deleted", { name: squad.name }));
    load();
  }

  async function updateMemberRole(member, newRole) {
    begin(scopeOfMember(member));
    const { error } = await supabase.rpc("admin_set_member_role", {
      p_user_id: member.id, p_role: newRole,
    });
    if (error) { setErr(error.message); return; }
    setOk(t("ros.role_changed", { who: member.callsign || member.email, role: roleLabelT(newRole, t) }));
    load();
  }

  async function assignMemberToSquad(member, squadId) {
    begin(scopeOfMember(member));
    const { error } = await supabase.rpc("admin_set_member_squad", {
      p_user_id: member.id, p_squad_id: squadId,
    });
    if (error) { setErr(error.message); return; }
    const sq = squads.find((s) => s.id === squadId);
    setOk(t("ros.member_assigned", { who: member.callsign || member.email, squad: sq?.name || "—" }));
    load();
  }

  async function toggleInstructor(member) {
    begin(scopeOfMember(member));
    const newVal = !member.is_instructor;
    const { error } = await supabase.rpc("admin_set_member_instructor", {
      p_user_id: member.id, p_is_instructor: newVal,
    });
    if (error) { setErr(error.message); return; }
    setOk(t(newVal ? "ros.instructor_granted" : "ros.instructor_revoked", { who: member.callsign || member.email }));
    load();
  }

  async function removeMemberFromSquad(member) {
    begin(scopeOfMember(member));
    const { error } = await supabase.rpc("admin_set_member_squad", {
      p_user_id: member.id, p_squad_id: null,
    });
    if (error) { setErr(error.message); return; }
    setOk(t("ros.member_removed", { who: member.callsign || member.email }));
    load();
  }

  async function deleteMember(member) {
    begin(scopeOfMember(member));
    const { data, error } = await supabase.rpc("delete_member", {
      p_user_id: member.id,
    });
    if (error) { setErr(error.message); return; }
    const who = data?.deleted || member.callsign || member.email;
    setOk(t("ros.member_deleted", { who }));
    load();
  }

  async function deleteInvite(invite) {
    begin(SCOPE_INVITES);
    const { error } = await supabase
      .from("invites")
      .delete()
      .eq("id", invite.id);
    if (error) { setErr(error.message); return; }
    setOk(t("ros.invite_deleted", { code: invite.code }));
    load();
  }

  // ── Confirmation for destructive actions ──
  const ask = (kind) => (item) => setConfirm({ kind, item });
  const confirmCfg = confirm ? ({
    squad: {
      title: t("ros.delete_squad_title", { name: confirm.item.name }),
      message: t("ros.delete_squad_body"),
      confirmLabel: t("ros.delete_squad"),
      run: () => deleteSquad(confirm.item),
    },
    remove: {
      title: t("ros.remove_title", { who: confirm.item.callsign || confirm.item.email }),
      message: t("ros.remove_body"),
      confirmLabel: t("ros.remove_member"),
      danger: false,
      run: () => removeMemberFromSquad(confirm.item),
    },
    member: {
      title: t("ros.delete_user_title", { who: confirm.item.callsign || confirm.item.email }),
      message: t("ros.delete_user_body"),
      confirmLabel: t("ros.delete_user"),
      run: () => deleteMember(confirm.item),
    },
    invite: {
      title: t("ros.delete_invite_title"),
      message: t("ros.delete_invite_body", { code: confirm.item.code }),
      confirmLabel: t("ros.delete_invite"),
      run: () => deleteInvite(confirm.item),
    },
  })[confirm.kind] : null;

  async function runConfirmed() {
    if (!confirmCfg) return;
    setConfirmBusy(true);
    await confirmCfg.run();
    setConfirmBusy(false);
    setConfirm(null);
  }

  const unassigned = members.filter((m) => !m.squad_id);
  const showUnassigned = isManager && unassigned.length > 0;

  // A message whose panel is gone (deleted squad, emptied "unassigned"
  // block, closed form) falls back to the top of the page.
  const scopeOnScreen = msgScope === SCOPE_PAGE
    || (msgScope === SCOPE_CREATE && showCreateSquad)
    || (msgScope === SCOPE_INVITES && showCreateInvite)
    || (msgScope === SCOPE_UNASSIGNED && showUnassigned)
    || squads.some((s) => s.id === msgScope);
  const shownScope = scopeOnScreen ? msgScope : SCOPE_PAGE;
  const feedback = (scope, style) => (
    shownScope === scope ? <Feedback err={err} ok={ok} style={style} /> : null
  );

  const memberHandlers = {
    onUpdateMemberRole: updateMemberRole,
    onAssignSquad: assignMemberToSquad,
    onRemoveMember: ask("remove"),
    onDeleteMember: ask("member"),
    onToggleInstructor: toggleInstructor,
  };

  return (
    <>
      <PageHeader
        title={t("ros.title")}
        subtitle={t("ros.subtitle")}
        action={isManager && (
          showCreateSquad ? (
            <Btn small type="button" onClick={() => setShowCreateSquad(false)}>
              {t("common.cancel")}
            </Btn>
          ) : (
            <Btn small primary type="button" icon="plus" onClick={() => setShowCreateSquad(true)}>
              {t("ros.new_squad")}
            </Btn>
          )
        )}
      />

      {feedback(SCOPE_PAGE, { marginTop: 8, marginBottom: 0 })}

      {showCreateSquad && (
        <Panel title={t("ros.create_title")} style={{ animation: RISE }}>
          <CreateSquadPanel
            onCreated={(msg) => { setMsgScope(SCOPE_PAGE); setOk(msg); setShowCreateSquad(false); load(); }}
            setErr={(m) => { setMsgScope(SCOPE_CREATE); setOk(""); setErr(m); }}
          />
          {feedback(SCOPE_CREATE, { marginTop: isMobile ? 12 : 0, marginBottom: 0 })}
        </Panel>
      )}

      {loading && (
        <Panel>
          <SkeletonRows rows={4} />
        </Panel>
      )}

      {!loading && squads.length === 0 && !showCreateSquad && (
        <Panel>
          <EmptyState icon="people" title={t("ros.nosquads")} />
        </Panel>
      )}

      {sortedSquads.map((sq) => (
        <SquadBlock
          key={sq.id}
          squad={sq}
          allSquads={sortedSquads}
          members={members.filter((m) => m.squad_id === sq.id)}
          canManage={isManager}
          onUpdateSquad={updateSquad}
          onDeleteSquad={ask("squad")}
          {...memberHandlers}
          currentUserId={profile?.id}
          feedback={feedback(sq.id)}
        />
      ))}

      {showUnassigned && (
        <SquadBlock
          squad={{ id: null, name: t("ros.unassigned") }}
          allSquads={sortedSquads}
          members={unassigned}
          canManage={isManager}
          {...memberHandlers}
          currentUserId={profile?.id}
          isUnassignedBlock
          feedback={feedback(SCOPE_UNASSIGNED)}
        />
      )}

      {showCreateInvite && (
        <InvitesPanel
          squads={squads}
          invites={invites}
          profile={profile}
          loading={loading}
          onChanged={(msg) => { setMsgScope(SCOPE_INVITES); setOk(msg); load(); }}
          onDeleteInvite={ask("invite")}
          setErr={(m) => { setMsgScope(SCOPE_INVITES); setOk(""); setErr(m); }}
          feedback={feedback(SCOPE_INVITES, { marginBottom: 0 })}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirmCfg?.title}
        message={confirmCfg?.message}
        confirmLabel={confirmCfg?.confirmLabel}
        cancelLabel={t("common.cancel")}
        danger={confirmCfg ? confirmCfg.danger !== false : true}
        busy={confirmBusy}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

// Result of the last action, shown inside the panel it concerns.
function Feedback({ err, ok, style }) {
  if (!err && !ok) return null;
  return (
    <div style={{ display: "grid", gap: 8, marginBottom: 12, animation: RISE, ...style }}>
      {err && <Notice tone="error">{err}</Notice>}
      {ok && <Notice tone="ok">{ok}</Notice>}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SQUAD BLOCK — with edit/delete
   ═══════════════════════════════════════════════ */
function SquadBlock({
  squad, allSquads = [], members, canManage, onUpdateSquad, onDeleteSquad,
  onUpdateMemberRole, onAssignSquad, onRemoveMember, onDeleteMember, onToggleInstructor, currentUserId, isUnassignedBlock = false,
  feedback,
}) {
  const { t } = useI18n();
  const isMobile = useIsMobile();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(squad.name || "");
  const [editBootcamp, setEditBootcamp] = useState(squad.is_bootcamp || false);

  function startEditing() {
    // Always start from the current values (the squad may have changed
    // since this block mounted).
    setEditName(squad.name || "");
    setEditBootcamp(!!squad.is_bootcamp);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setEditName(squad.name);
    setEditBootcamp(squad.is_bootcamp);
  }

  function handleSaveSquad() {
    if (!editName.trim()) return;
    onUpdateSquad(squad, {
      name: editName.trim().toUpperCase(),
      is_bootcamp: editBootcamp,
    });
    setEditing(false);
  }

  // Status transition actions removed per user request (no Mark training / Archive)

  const title = (
    <span style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px 8px", minWidth: 0 }}>
      <span style={{ overflowWrap: "anywhere" }}>{squad.name}</span>
      {!isUnassignedBlock && (
        squad.is_bootcamp
          ? <Badge tone="warn">{t("nav.bootcamp")}</Badge>
          : <Badge tone="ok">{t("ros.active")}</Badge>
      )}
      <Badge>{members.length} {members.length === 1 ? t("ros.member") : t("ros.members")}</Badge>
    </span>
  );

  const memberProps = (m) => ({
    member: m,
    canManage,
    isCurrentUser: m.id === currentUserId,
    onChangeRole: onUpdateMemberRole,
    onAssignSquad,
    onRemove: onRemoveMember,
    onDelete: onDeleteMember,
    onToggleInstructor,
    allSquads,
    isUnassignedBlock,
  });

  return (
    <Panel
      style={isMobile ? { padding: "16px 16px 8px" } : undefined}
      title={editing ? null : title}
      action={canManage && !editing && !isUnassignedBlock ? (
        <Menu
          items={[
            { key: "edit", label: t("common.edit"), icon: "pencil", onSelect: startEditing },
            { key: "delete", label: t("ros.delete_squad"), icon: "trash", danger: true, onSelect: () => onDeleteSquad(squad) },
          ]}
          trigger={(p) => <IconButton icon="ellipsis" label={t("common.more")} size={isMobile ? 34 : 30} {...p} />}
        />
      ) : null}
    >
      {editing && (
        <form
          onSubmit={(e) => { e.preventDefault(); handleSaveSquad(); }}
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            flexWrap: "wrap",
            gap: isMobile ? 12 : 14,
            marginBottom: 14,
            animation: RISE,
          }}
        >
          <Input value={editName} onChange={(e) => setEditName(e.target.value)}
                 aria-label={t("ros.squad_name")} autoFocus
                 style={{ width: isMobile ? "100%" : 220 }} />
          <Switch checked={editBootcamp} onChange={setEditBootcamp} label={t("ros.bootcamp")} />
          <div style={{ display: "flex", gap: 8, marginInlineStart: isMobile ? 0 : "auto" }}>
            <Btn small primary type="submit">{t("common.save")}</Btn>
            <Btn small type="button" onClick={cancelEditing}>{t("common.cancel")}</Btn>
          </div>
        </form>
      )}

      {feedback}

      {/* ── Members ── */}
      {members.length === 0 ? (
        <EmptyState compact icon="people" title={t("ros.nomembers")} />
      ) : isMobile ? (
        <List>
          {members.map((m) => (
            <MemberRowMobile key={m.id} {...memberProps(m)} />
          ))}
        </List>
      ) : (
        <table style={{ ...S.table, marginBottom: 0, tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ ...S.th, ...CELL_FIRST, width: "19%" }}>{t("ros.callsign")}</th>
              <th style={{ ...S.th, width: "20%" }}>{t("ros.name")}</th>
              <th style={{ ...S.th, width: "19%" }}>{t("ros.role")}</th>
              <th style={{ ...S.th, ...(canManage ? null : CELL_LAST) }}>{t("ros.email")}</th>
              {canManage && <th style={{ ...S.th, ...CELL_LAST, width: 150 }}></th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <MemberRowDesktop key={m.id} last={i === members.length - 1} {...memberProps(m)} />
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

// Table cells line up with the panel's own padding at both edges.
const CELL_FIRST = { paddingInlineStart: 0 };
const CELL_LAST = { paddingInlineEnd: 0 };
// Same edge for a cell whose own direction is forced to LTR.
const CELL_LAST_LTR = (isRTL) => (isRTL ? { paddingInlineStart: 0 } : { paddingInlineEnd: 0 });

/* ── Per-member actions ───────────────────────────────────────────────
   Everything lives behind one "more" button. Removing from the squad
   and deleting the user are confirmed in a dialog by the parent.       */
function memberMenuItems({
  t, member, isCurrentUser, isUnassignedBlock, canAssign,
  onStartAssign, onStartRole, onToggleInstructor, onRemove, onDelete,
}) {
  return [
    canAssign && {
      key: "assign",
      label: isUnassignedBlock ? t("ros.assign") : t("ros.move"),
      icon: "swap",
      onSelect: onStartAssign,
    },
    !isCurrentUser && {
      key: "role",
      label: t("ros.change_role"),
      icon: "personCheck",
      onSelect: onStartRole,
    },
    !isCurrentUser && {
      key: "instructor",
      label: member.is_instructor ? t("ros.revoke_instructor") : t("ros.make_instructor"),
      icon: "graduation",
      onSelect: () => onToggleInstructor && onToggleInstructor(member),
    },
    !isCurrentUser && !isUnassignedBlock && member.squad_id && {
      key: "remove",
      label: t("ros.remove_member"),
      icon: "xmark",
      onSelect: () => onRemove(member),
    },
    !isCurrentUser && onDelete && "divider",
    !isCurrentUser && onDelete && {
      key: "delete",
      label: t("ros.delete_user"),
      icon: "trash",
      danger: true,
      onSelect: () => onDelete(member),
    },
  ].filter(Boolean);
}

function MemberMenu({ items, size }) {
  const { t } = useI18n();
  if (items.length === 0) return null;
  return (
    <Menu
      items={items}
      trigger={(p) => <IconButton icon="ellipsis" label={t("common.more")} size={size} {...p} />}
    />
  );
}

function RoleBadges({ member }) {
  const { t } = useI18n();
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
      <Badge tone="bright">{roleLabelT(member.role, t)}</Badge>
      {member.is_instructor && <Badge tone="warn">{t("prof.instructor_badge")}</Badge>}
    </span>
  );
}

function RolePicker({ member, small, onChangeRole, onDone, style, wrapStyle }) {
  const { t } = useI18n();
  return (
    <Select
      small={small}
      autoFocus
      aria-label={t("ros.change_role")}
      value={member.role}
      onChange={(e) => { onChangeRole(member, e.target.value); onDone(); }}
      onBlur={onDone}
      style={style}
      wrapStyle={wrapStyle}
    >
      {ROLE_OPTIONS.map((r) => (
        <option key={r} value={r}>{roleLabelT(r, t)}</option>
      ))}
    </Select>
  );
}

function SquadPicker({ member, squads, small, onAssignSquad, onDone, style, wrapStyle }) {
  const { t } = useI18n();
  return (
    <Select
      small={small}
      autoFocus
      aria-label={t("ros.pick_squad")}
      defaultValue=""
      onChange={(e) => {
        const v = e.target.value;
        if (v) { onAssignSquad(member, v); onDone(); }
      }}
      onBlur={onDone}
      style={style}
      wrapStyle={wrapStyle}
    >
      <option value="">{t("ros.pick_squad")}</option>
      {squads.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </Select>
  );
}

// List avatars use the plain public URL (without the per-call cache-buster
// profileAvatarPublicUrl appends), so the browser can cache them instead
// of re-downloading every photo each time the roster mounts.
function useMemberAvatar(member) {
  return useMemo(() => {
    const url = profileAvatarPublicUrl(member.avatar_url);
    return url ? url.split("?")[0] : null;
  }, [member.avatar_url]);
}

/* ── Desktop member row with role change + remove ── */
function MemberRowDesktop({ member, last, canManage, isCurrentUser, onChangeRole, onAssignSquad, onRemove, onDelete, onToggleInstructor, allSquads = [], isUnassignedBlock = false }) {
  const { t, isRTL } = useI18n();
  const [editingRole, setEditingRole] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const assignableSquads = (allSquads || []).filter((s) => s.id && s.id !== member.squad_id);
  const avatarSrc = useMemberAvatar(member);
  const td = last ? { ...S.td, borderBottom: "none", paddingBottom: 4 } : S.td;

  return (
    <tr>
      <td style={{ ...td, ...CELL_FIRST }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar src={avatarSrc} name={member.callsign || member.full_name} size={32} />
          <Mono style={{ color: C.bright, fontWeight: 600, ...ELLIPSIS }}>{member.callsign || "—"}</Mono>
        </div>
      </td>
      <td style={{ ...td, ...ELLIPSIS }}>
        {member.full_name || <span style={{ color: C.dim }}>—</span>}
      </td>
      <td style={td}>
        {editingRole ? (
          <RolePicker small member={member} onChangeRole={onChangeRole}
                      onDone={() => setEditingRole(false)} />
        ) : (
          <RoleBadges member={member} />
        )}
      </td>
      {/* An address always reads left-to-right and truncates at its end;
          it still lines up with the column's leading edge. */}
      <td dir="ltr" title={member.email}
          style={{ ...td, color: C.dim, ...ELLIPSIS, textAlign: isRTL ? "end" : "start", ...(canManage ? null : CELL_LAST_LTR(isRTL)) }}>
        {member.email}
      </td>
      {canManage && (
        <td style={{ ...td, ...CELL_LAST, textAlign: "end", whiteSpace: "nowrap" }}>
          {assigning ? (
            <SquadPicker small member={member} squads={assignableSquads}
                         onAssignSquad={onAssignSquad} onDone={() => setAssigning(false)}
                         style={{ width: 150 }} />
          ) : (
            <MemberMenu size={30} items={memberMenuItems({
              t, member, isCurrentUser, isUnassignedBlock,
              canAssign: !!onAssignSquad && assignableSquads.length > 0,
              onStartAssign: () => setAssigning(true),
              onStartRole: () => setEditingRole(true),
              onToggleInstructor, onRemove, onDelete,
            })} />
          )}
        </td>
      )}
    </tr>
  );
}

/* ── Mobile member row with role change + remove ── */
function MemberRowMobile({ member, canManage, isCurrentUser, onChangeRole, onAssignSquad, onRemove, onDelete, onToggleInstructor, allSquads = [], isUnassignedBlock = false }) {
  const { t } = useI18n();
  const [editingRole, setEditingRole] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const assignableSquads = (allSquads || []).filter((s) => s.id && s.id !== member.squad_id);
  const avatarSrc = useMemberAvatar(member);
  const pickerWrap = { display: "flex", width: "100%", marginTop: 10 };

  return (
    <Row
      as="div"
      align="flex-start"
      leading={<Avatar src={avatarSrc} name={member.callsign || member.full_name} size={40} />}
      trailing={canManage ? (
        <MemberMenu size={36} items={memberMenuItems({
          t, member, isCurrentUser, isUnassignedBlock,
          canAssign: !!onAssignSquad && assignableSquads.length > 0,
          onStartAssign: () => { setEditingRole(false); setAssigning(true); },
          onStartRole: () => { setAssigning(false); setEditingRole(true); },
          onToggleInstructor, onRemove, onDelete,
        })} />
      ) : null}
    >
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 8px" }}>
        <Mono style={{ fontSize: 15, lineHeight: 1.4, color: C.bright, fontWeight: 600 }}>
          {member.callsign || "—"}
        </Mono>
        <RoleBadges member={member} />
      </div>
      <div style={{ ...T.callout, color: C.text, marginTop: 2, ...ELLIPSIS }}>
        {member.full_name || <span style={{ color: C.dim }}>—</span>}
      </div>
      <div style={{ ...T.caption, color: C.dim, ...ELLIPSIS }}>
        <span dir="ltr">{member.email}</span>
      </div>
      {editingRole && (
        <RolePicker member={member} onChangeRole={onChangeRole}
                    onDone={() => setEditingRole(false)} wrapStyle={pickerWrap} />
      )}
      {assigning && (
        <SquadPicker member={member} squads={assignableSquads}
                     onAssignSquad={onAssignSquad} onDone={() => setAssigning(false)}
                     wrapStyle={pickerWrap} />
      )}
    </Row>
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
    <form onSubmit={create} style={{
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "flex-end",
      flexWrap: "wrap",
      gap: isMobile ? 0 : 20,
    }}>
      <Field label={t("ros.squad_name")}>
        <Input value={name} onChange={(e) => setName(e.target.value)}
               placeholder={t("ros.squad_ph")}
               style={{ width: isMobile ? "100%" : 260 }} />
      </Field>
      <div style={{ display: "flex", alignItems: "center", minHeight: isMobile ? 44 : 40, marginBottom: 14 }}>
        <Switch checked={isBootcamp} onChange={setIsBootcamp} label={t("ros.bootcamp")} />
      </div>
      <div style={{ marginInlineStart: isMobile ? 0 : "auto", marginBottom: isMobile ? 0 : 14 }}>
        <Btn primary type="submit" disabled={busy} busy={busy} fullWidth={isMobile}>
          {busy ? t("ros.registering") : t("ros.register")}
        </Btn>
      </div>
    </form>
  );
}

/* ═══════════════════════════════════════════════
   INVITES PANEL — with delete
   ═══════════════════════════════════════════════ */
function InvitesPanel({ squads, invites, profile, loading, onChanged, onDeleteInvite, setErr, feedback }) {
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
      <SectionHeader
        title={t("ros.invites_title")}
        subtitle={t("ros.invites_sub")}
        action={showForm ? (
          <Btn small type="button" onClick={() => setShowForm(false)}>{t("common.cancel")}</Btn>
        ) : (
          <Btn small type="button" icon="plus" onClick={() => setShowForm(true)}>{t("ros.generate")}</Btn>
        )}
      />

      {feedback}

      {showForm && (
        <Panel style={{ animation: RISE }}>
          <form onSubmit={create} style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "flex-end",
            flexWrap: "wrap",
            gap: isMobile ? 0 : 16,
          }}>
            <div style={{ width: isMobile ? "100%" : 260 }}>
              <Field label={t("mc.squad")}>
                <Select value={squadId} onChange={(e) => setSquadId(e.target.value)}>
                  {squadOptional && <option value="">{t("ros.no_squad")}</option>}
                  {allowedSquads.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                  {allowedSquads.length === 0 && !squadOptional && <option value="">{t("mc.nosquads")}</option>}
                </Select>
              </Field>
            </div>
            <div style={{ width: isMobile ? "100%" : 220 }}>
              <Field label={t("ros.role")}>
                <Select value={role}
                        onChange={(e) => {
                          const r = e.target.value;
                          setRole(r);
                          if (r === "admin" || r === "officer") setSquadId("");
                        }}>
                  {allowedRoles.map((r) => (
                    <option key={r} value={r}>{roleLabelT(r, t)}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div style={{ marginInlineStart: isMobile ? 0 : "auto", marginBottom: isMobile ? 0 : 14 }}>
              <Btn primary type="submit" fullWidth={isMobile} busy={busy}
                   disabled={busy || (!squadOptional && !squadId)}>
                {busy ? t("ros.generating") : t("ros.generate")}
              </Btn>
            </div>
          </form>
        </Panel>
      )}

      <Panel style={isMobile ? { padding: "8px 16px" } : undefined}>
        {loading ? (
          <SkeletonRows rows={3} />
        ) : invites.length === 0 ? (
          <EmptyState compact icon="key" title={t("ros.noinvites")} />
        ) : isMobile ? (
          <List>
            {invites.map((inv) => (
              <InviteRowMobile key={inv.id} invite={inv} squads={squads}
                               canDelete={isAdmin} onDelete={onDeleteInvite} />
            ))}
          </List>
        ) : (
          <table style={{ ...S.table, marginBottom: 0 }}>
            <thead>
              <tr>
                <th style={{ ...S.th, ...CELL_FIRST }}>{t("ros.code")}</th>
                <th style={S.th}>{t("mc.squad")}</th>
                <th style={S.th}>{t("ros.role")}</th>
                <th style={S.th}>{t("ros.status")}</th>
                <th style={{ ...S.th, ...(isAdmin ? null : CELL_LAST) }}>{t("ros.created")}</th>
                {isAdmin && <th style={{ ...S.th, ...CELL_LAST, width: 40 }}></th>}
              </tr>
            </thead>
            <tbody>
              {invites.map((inv, i) => (
                <InviteRowDesktop key={inv.id} invite={inv} squads={squads} last={i === invites.length - 1}
                                  canDelete={isAdmin} onDelete={onDeleteInvite} />
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

// Secondary icon action: no fill, so the copy button stays the obvious one.
// (A function: C is swapped in place when the theme changes.)
const quietIcon = () => ({ background: "transparent", color: C.dim });

// Copies an invite code; the icon confirms in place for a moment.
function CopyCodeButton({ code, size }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(String(code || ""));
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable — the code stays selectable */ }
  }

  return (
    <IconButton
      icon={copied ? "check" : "copy"}
      label={copied ? t("common.copied") : t("common.copy")}
      size={size}
      onClick={copy}
      style={copied ? { color: C.ok } : undefined}
    />
  );
}

function InviteStatus({ used }) {
  const { t } = useI18n();
  return used ? <Badge>{t("ros.used")}</Badge> : <Badge tone="ok">{t("ros.available")}</Badge>;
}

function InviteRowDesktop({ invite, squads, last, canDelete, onDelete }) {
  const { t } = useI18n();
  const sq = squads.find((s) => s.id === invite.squad_id);
  const used = !!invite.used_by;
  const td = last ? { ...S.td, borderBottom: "none", paddingBottom: 4 } : S.td;

  return (
    <tr>
      <td style={{ ...td, ...CELL_FIRST }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 28 }}>
          <Mono style={{ color: used ? C.dim : C.bright, fontWeight: 600, userSelect: "all" }}>{invite.code}</Mono>
          {!used && <CopyCodeButton code={invite.code} size={28} />}
        </span>
      </td>
      <td style={td}>{sq?.name || "—"}</td>
      <td style={td}>{roleLabelT(invite.role, t)}</td>
      <td style={td}><InviteStatus used={used} /></td>
      <td style={{ ...td, color: C.dim, ...(canDelete ? null : CELL_LAST) }}>
        <Num>{fmtWhen(invite.created_at, t)}</Num>
      </td>
      {canDelete && (
        <td style={{ ...td, ...CELL_LAST, textAlign: "end" }}>
          {!used && (
            <IconButton icon="trash" label={t("ros.delete_invite")} size={28}
                        style={quietIcon()} onClick={() => onDelete(invite)} />
          )}
        </td>
      )}
    </tr>
  );
}

function InviteRowMobile({ invite, squads, canDelete, onDelete }) {
  const { t } = useI18n();
  const sq = squads.find((s) => s.id === invite.squad_id);
  const used = !!invite.used_by;

  return (
    <Row
      as="div"
      trailing={!used ? (
        <>
          <CopyCodeButton code={invite.code} size={36} />
          {canDelete && (
            <IconButton icon="trash" label={t("ros.delete_invite")} size={36}
                        style={quietIcon()} onClick={() => onDelete(invite)} />
          )}
        </>
      ) : null}
    >
      <Mono style={{ display: "block", fontSize: 15, lineHeight: 1.4, color: used ? C.dim : C.bright, fontWeight: 600, userSelect: "all" }}>
        {invite.code}
      </Mono>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, minWidth: 0 }}>
        <span style={{ flexShrink: 0, display: "flex" }}><InviteStatus used={used} /></span>
        <span style={{ flex: 1, minWidth: 0, ...T.footnote, color: C.text, ...ELLIPSIS }}>
          {sq?.name || "—"}
          <span aria-hidden style={{ color: C.dimmer, margin: "0 6px" }}>·</span>
          {roleLabelT(invite.role, t)}
        </span>
      </div>
      <div style={{ ...T.caption, color: C.dim, marginTop: 3 }}>
        <Num>{fmtWhen(invite.created_at, t)}</Num>
      </div>
    </Row>
  );
}
