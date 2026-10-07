import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, canCreateInvites, canManageSquads } from "../auth";
import { useI18n, fmtWhen } from "../i18n";
import { listMissions, getMissionReadiness } from "../data/missions";
import {
  listRecentAnnouncements, subscribeAnnouncements,
  deleteAnnouncement, updateAnnouncement,
} from "../data/announcements";
import { supabase } from "../supabase";
import {
  Panel, PageHeader, Btn, Badge, Mono, Num, Input, Textarea, Field, ErrLine,
  Row, List, Chip, ChipRow, Menu, IconButton, Progress, EmptyState, SkeletonRows,
  ConfirmDialog, IconTile, Truncate, ELLIPSIS,
} from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, T } from "../theme";
import { DURATION } from "../motion";
import {
  MISSION_STATUS_LABELS, MISSION_STATUS_TONES,
  MISSION_KINDS, MISSION_KIND_ICONS,
} from "../missionTemplate";
import AnnouncementComposer from "./AnnouncementComposer";

function canCreateMissions(role, profile) {
  return canCreateInvites(role) || !!profile?.is_instructor;
}

export default function Missions({ onOpenMission, onCreateMission, isBootcamp, squadId }) {
  const { profile } = useAuth();
  const { t } = useI18n();
  const [missions, setMissions] = useState([]);
  const [squads, setSquads] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [showComposer, setShowComposer] = useState(false);
  // missionId → { checked, total, pct }
  const [readinessMap, setReadinessMap] = useState({});

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const missionOpts = isBootcamp && squadId
      ? { squadId, limit: 100 }
      : { limit: 100 };
    const [{ data, error }, { data: sq }, { data: ann }] = await Promise.all([
      listMissions(missionOpts),
      supabase.from("squads").select("*").order("name"),
      listRecentAnnouncements({ limit: 20 }),
    ]);
    if (error) setErr(String(error.message || error));

    // Instructors also see missions for all bootcamp squads
    let allMissions = data || [];
    if (profile?.is_instructor && !isBootcamp) {
      const bootcampSquadIds = (sq || []).filter((s) => s.is_bootcamp).map((s) => s.id);
      if (bootcampSquadIds.length > 0) {
        const { data: bcMissions } = await supabase
          .from("missions")
          .select("*")
          .in("squad_id", bootcampSquadIds)
          .order("scheduled_at", { ascending: true, nullsFirst: false });
        if (bcMissions) {
          const map = new Map(allMissions.map((m) => [m.id, m]));
          for (const m of bcMissions) map.set(m.id, m);
          allMissions = Array.from(map.values());
        }
      }
    }

    setMissions(allMissions);
    setSquads(sq || []);
    const filteredAnn = isBootcamp && squadId
      ? (ann || []).filter((a) => a.scope === "squad" && a.squad_id === squadId)
      : (ann || []);
    setAnnouncements(filteredAnn);
    setLoading(false);

    // Fetch readiness for each mission in parallel
    if (allMissions.length > 0) {
      const results = await Promise.all(
        allMissions.map(async (m) => {
          // Admin tasks: simple done/not-done per user
          if ((m.kind || "operational") === "admin") {
            const { data: ops } = await supabase
              .from("mission_operators")
              .select("done")
              .eq("mission_id", m.id);
            if (!ops || ops.length === 0) return { id: m.id, checked: 0, total: 0, pct: 0 };
            const done = ops.filter((o) => o.done).length;
            return { id: m.id, checked: done, total: ops.length, pct: Math.round((done / ops.length) * 100) };
          }
          const { data: rd } = await getMissionReadiness(m.id);
          if (!rd || rd.length === 0) return { id: m.id, checked: 0, total: 0, pct: 0 };
          const totalChecked = rd.reduce((s, r) => s + (r.checked_items || 0), 0);
          const totalItems   = rd.reduce((s, r) => s + (r.total_items || 0), 0);
          const pct = totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0;
          return { id: m.id, checked: totalChecked, total: totalItems, pct };
        })
      );
      const map = {};
      for (const r of results) map[r.id] = r;
      setReadinessMap(map);
    }
  }, [isBootcamp, squadId, profile?.is_instructor]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel("z5-missions-list")
      .on("postgres_changes",
          { event: "*", schema: "public", table: "missions" },
          () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  useEffect(() => {
    const unsub = subscribeAnnouncements(() => {
      listRecentAnnouncements({ limit: 20 }).then(({ data }) => {
        const filtered = isBootcamp && squadId
          ? (data || []).filter((a) => a.scope === "squad" && a.squad_id === squadId)
          : (data || []);
        setAnnouncements(filtered);
      });
    });
    return unsub;
  }, [isBootcamp, squadId]);

  const squadName = (id) => squads.find((s) => s.id === id)?.name || "—";
  const showCreate = canCreateMissions(profile?.role, profile);
  const canManage = canManageSquads(profile?.role);
  const isLead = profile?.role === "squad_leader";

  // Filtered missions
  const filteredMissions = useMemo(() => {
    if (kindFilter === "announcements") return [];
    return missions.filter((m) => kindFilter === "all" || (m.kind || "operational") === kindFilter);
  }, [missions, kindFilter]);

  // Show announcements in "all" or "announcements" filter
  const showAnnouncements = kindFilter === "all" || kindFilter === "announcements";
  // First load only — realtime refreshes keep the list on screen.
  const firstLoad = loading && missions.length === 0 && announcements.length === 0;
  const nothing = !loading && filteredMissions.length === 0
    && !(showAnnouncements && announcements.length > 0);

  const createItems = [
    { key: "operational", label: t("kind.operational"), icon: MISSION_KIND_ICONS.operational, onSelect: () => onCreateMission("operational") },
    { key: "admin", label: t("kind.admin"), icon: MISSION_KIND_ICONS.admin, onSelect: () => onCreateMission("admin") },
    { key: "announcement", label: t("mis.ann_tab"), icon: "megaphone", onSelect: () => setShowComposer(true) },
  ];

  return (
    <>
      <PageHeader
        title={t("mis.title")}
        subtitle={t("mis.subtitle")}
        action={showCreate && (
          <Menu
            items={createItems}
            trigger={(p) => <Btn small primary type="button" icon="plus" {...p}>{t("mis.new")}</Btn>}
          />
        )}
      />

      <ChipRow style={{ marginTop: 6 }}>
        <Chip active={kindFilter === "all"} onClick={() => setKindFilter("all")}>
          {t("mis.all")}
        </Chip>
        {MISSION_KINDS.map((k) => (
          <Chip
            key={k.key}
            icon={k.icon}
            active={kindFilter === k.key}
            onClick={() => setKindFilter(k.key)}
          >
            {t(`kind.${k.key}`)}
          </Chip>
        ))}
        <Chip
          icon="megaphone"
          active={kindFilter === "announcements"}
          onClick={() => setKindFilter("announcements")}
        >
          {t("mis.ann_tab")}
        </Chip>
      </ChipRow>

      {/* Announcement composer — appears in place, right under the
          control that opened it. */}
      {showComposer && (
        <Panel
          title={t("mis.ann_new")}
          action={<Btn small type="button" onClick={() => setShowComposer(false)}>{t("mis.cancel")}</Btn>}
          style={{ animation: `z5-rise ${DURATION.move}ms var(--z5-spring) backwards` }}
        >
          <AnnouncementComposer onPosted={() => { setShowComposer(false); load(); }} />
        </Panel>
      )}

      {err && <ErrLine>{err}</ErrLine>}

      {firstLoad && (
        <Panel>
          <SkeletonRows rows={4} />
        </Panel>
      )}

      {/* Missions section */}
      {!firstLoad && filteredMissions.length > 0 && (
        <Panel title={
          kindFilter === "admin" ? t("kind.admin")
          : kindFilter === "operational" ? t("kind.operational")
          : t("mis.title")
        }>
          <List>
            {filteredMissions.map((m) => {
              const kind = m.kind || "operational";
              const rd = readinessMap[m.id];
              return (
                <MissionRow
                  key={m.id}
                  mission={m}
                  squadText={m.squad_id ? squadName(m.squad_id) : t("mis.wholeteam")}
                  when={kind === "admin"
                    ? `${t("common.due")} ${formatWhen(m.due_at)}`
                    : formatWhen(m.scheduled_at)}
                  pct={rd && rd.total > 0 ? rd.pct : null}
                  onOpen={() => onOpenMission(m.id)}
                />
              );
            })}
          </List>
        </Panel>
      )}

      {/* Announcements section */}
      {!firstLoad && showAnnouncements && announcements.length > 0 && (
        <Panel title={t("mis.ann_tab")}>
          <List>
            {announcements.map((a) => (
              <AnnouncementItem
                key={a.id}
                a={a}
                canModify={canManage
                  || (isLead && a.scope === "squad" && a.squad_id === profile?.squad_id)
                  || a.posted_by === profile?.id}
                onDeleted={load}
                onUpdated={load}
              />
            ))}
          </List>
        </Panel>
      )}

      {nothing && (
        <Panel>
          <EmptyState
            icon={kindFilter === "announcements" ? "megaphone" : "target"}
            title={kindFilter === "announcements" ? t("mis.ann_empty") : t("mis.empty")}
          />
        </Panel>
      )}
    </>
  );
}

/* ── Mission row ─────────────────────────────────────────────────────
   Shared by Missions and Home. Leading kind icon, title, one meta line,
   an optional progress line, status badge and a chevron.
     squadText — optional scope (squad name / whole team)
     when      — preformatted date string
     extra     — optional extra meta fragment (e.g. my role)
     pct       — 0–100, or null to hide the progress line
     detail    — optional text beside the percentage (e.g. "12/24")      */
export function MissionRow({ mission, squadText, when, extra, pct, detail, onOpen }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const tone = MISSION_STATUS_TONES[mission.status] || "default";
  const label = t(`status.${mission.status}`) || MISSION_STATUS_LABELS[mission.status] || mission.status;
  const kind = mission.kind || "operational";
  const badge = <Badge tone={tone}>{label}</Badge>;
  const meta = [
    // Squad names are codes (ALPHA, BRAVO) → mono; "Whole team" is prose.
    squadText
      ? (mission.squad_id
          ? <Mono key="s" style={{ color: C.text }}>{squadText}</Mono>
          : <span key="s" style={{ color: C.text }}>{squadText}</span>)
      : null,
    when ? <Num key="w">{when}</Num> : null,
    mission.location ? <span key="l">{mission.location}</span> : null,
    extra ? <span key="x">{extra}</span> : null,
  ].filter(Boolean);

  return (
    <Row
      onClick={onOpen}
      chevron
      align="center"
      leading={<KindTile kind={kind} />}
      trailing={isMobile ? null : badge}
    >
      <div style={{ ...T.body, fontWeight: 600, color: C.bright }}>
        <Truncate>{mission.name}</Truncate>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, minWidth: 0 }}>
        {isMobile && <span style={{ flexShrink: 0, display: "flex" }}>{badge}</span>}
        <div style={{ flex: 1, minWidth: 0, ...T.footnote, color: C.dim, ...ELLIPSIS }}>
          {meta.map((node, i) => (
            <span key={i}>
              {i > 0 && <span aria-hidden style={{ color: C.dimmer, margin: "0 6px" }}>·</span>}
              {node}
            </span>
          ))}
        </div>
      </div>
      {pct !== null && pct !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7 }}>
          <Progress
            value={pct}
            tone={mission.status === "cancelled" ? "ink" : "auto"}
            height={5}
            style={{ flex: 1, maxWidth: 220, opacity: mission.status === "cancelled" ? 0.4 : 1 }}
          />
          <span style={{ ...T.caption, color: pct >= 100 ? C.ok : C.dim, fontWeight: 600 }}>
            <Num>{detail ? `${detail} · ${pct}%` : `${pct}%`}</Num>
          </span>
        </div>
      )}
    </Row>
  );
}

// Icon tile that identifies the kind of a mission / item.
export function KindTile({ kind, icon, size = 38 }) {
  return <IconTile icon={icon || MISSION_KIND_ICONS[kind] || "target"} dim={kind === "admin"} size={size} />;
}

/* ── Announcement ────────────────────────────────────────────────────
   Read-only by default (Home); with canModify it gets a ⋯ menu to edit
   in place or delete (confirmed in a dialog).                          */
export function AnnouncementItem({ a, canModify, onDeleted, onUpdated }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(a.title || "");
  const [editBody, setEditBody] = useState(a.body || "");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    setBusy(true); setErr("");
    const { error } = await updateAnnouncement(a.id, {
      title: editTitle.trim(),
      body: editBody.trim(),
    });
    setBusy(false);
    if (error) { setErr(String(error.message || error)); return; }
    setEditing(false);
    onUpdated?.();
  }

  async function handleDelete() {
    setBusy(true); setErr("");
    const { error } = await deleteAnnouncement(a.id);
    setBusy(false);
    setConfirmDel(false);
    if (error) { setErr(String(error.message || error)); return; }
    onDeleted?.();
  }

  if (editing) {
    return (
      <div style={{ padding: "12px 0" }}>
        <Field label={t("ann.title_label")}>
          <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder={t("ann.title_ph")} maxLength={80} />
        </Field>
        <Field label={t("ann.body")}>
          <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={4} />
        </Field>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn small primary type="button" disabled={busy || !editBody.trim()} busy={busy} onClick={handleSave}>
            {busy ? t("mis.saving") : t("mis.save")}
          </Btn>
          <Btn small type="button" onClick={() => { setEditing(false); setEditTitle(a.title || ""); setEditBody(a.body || ""); }}>
            {t("mis.cancel")}
          </Btn>
        </div>
        <ErrLine>{err}</ErrLine>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0" }}>
      <KindTile icon="megaphone" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 26 }}>
          <div style={{ flex: 1, minWidth: 0, ...T.body, fontWeight: 600, color: C.bright, overflowWrap: "anywhere" }}>
            {a.title || t("common.announcement")}
          </div>
          <Badge tone={a.scope === "squad" ? "default" : "bright"}>
            {a.scope === "squad" ? t("ann.squad") : t("ann.global")}
          </Badge>
          {canModify && (
            <Menu
              items={[
                { key: "edit", label: t("mis.edit"), icon: "pencil", onSelect: () => setEditing(true) },
                { key: "delete", label: t("mis.delete"), icon: "trash", danger: true, onSelect: () => setConfirmDel(true) },
              ]}
              trigger={(p) => <IconButton icon="ellipsis" label={t("mis.more")} size={28} {...p} />}
            />
          )}
        </div>
        <div style={{ ...T.callout, color: C.text, whiteSpace: "pre-wrap", overflowWrap: "anywhere", marginTop: 2 }}>
          {a.body}
        </div>
        <div style={{ ...T.caption, color: C.dimmer, marginTop: 6 }}>
          <Num>{formatWhen(a.posted_at)}</Num>
        </div>
        <ErrLine>{err}</ErrLine>
      </div>
      <ConfirmDialog
        open={confirmDel}
        title={t("mis.ann_delete_title")}
        message={t("mis.ann_delete_body")}
        confirmLabel={t("mis.delete")}
        cancelLabel={t("mis.cancel")}
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDel(false)}
      />
    </div>
  );
}

function formatWhen(ts) {
  return fmtWhen(ts, null) || "—";
}
