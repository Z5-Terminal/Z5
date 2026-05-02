import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, canCreateInvites, canManageSquads } from "../auth";
import { useI18n } from "../i18n";
import { listMissions, getMissionReadiness } from "../data/missions";
import {
  listRecentAnnouncements, subscribeAnnouncements,
  deleteAnnouncement, updateAnnouncement,
} from "../data/announcements";
import { supabase } from "../supabase";
import { Panel, PageHeader, Btn, Badge, Mono, Input, Textarea, ErrLine } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, FONT_MONO } from "../theme";
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
  const isMobile = useIsMobile();
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

  return (
    <>
      <PageHeader
        title={<><span style={{ marginRight: 8 }}>⌖</span>{t("mis.title")}</>}
        subtitle={t("mis.subtitle")}
        action={showCreate && (
          <select
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v === "announcement") setShowComposer(true);
              else onCreateMission(v);
            }}
            style={{
              background: C.inputBg,
              color: C.bright,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              padding: "6px 10px",
              fontFamily: FONT_MONO,
              fontSize: 13,
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="" disabled>{t("mis.new")}</option>
            <option value="operational">⌖ {t("kind.operational")}</option>
            <option value="admin">◎ {t("kind.admin")}</option>
            <option value="announcement">◈ {t("mis.ann_tab")}</option>
          </select>
        )}
      />

      <Panel connectTop>
        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn small active={kindFilter === "all"} onClick={() => setKindFilter("all")}>
            {t("mis.all")}
          </Btn>
          {MISSION_KINDS.map((k) => (
            <Btn
              key={k.key}
              small
              active={kindFilter === k.key}
              onClick={() => setKindFilter(k.key)}
            >
              {k.icon} {t(`kind.${k.key}`) || k.label}
            </Btn>
          ))}
          <Btn
            small
            active={kindFilter === "announcements"}
            onClick={() => setKindFilter("announcements")}
          >
            ◈ {t("mis.ann_tab")}
          </Btn>
        </div>

        {/* Announcement composer */}
        {showComposer && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
            <AnnouncementComposer onPosted={() => { setShowComposer(false); load(); }} />
          </div>
        )}
      </Panel>

      {loading && (
        <Panel>
          <div style={{ color: C.dim, fontSize: 13 }}>{t("mis.loading")}</div>
        </Panel>
      )}
      {err && (
        <Panel>
          <div style={{ color: C.error, fontSize: 13 }}>{err}</div>
        </Panel>
      )}

      {/* Missions section */}
      {!loading && filteredMissions.length > 0 && (
        <Panel title={
          kindFilter === "admin" ? `◎ ${t("kind.admin")}`
          : kindFilter === "operational" ? `⌖ ${t("kind.operational")}`
          : `⌖ ${t("mis.title")}`
        }>
          {filteredMissions.map((m) => (
            <MissionRow
              key={m.id}
              mission={m}
              squadName={squadName(m.squad_id)}
              readiness={readinessMap[m.id]}
              onOpen={() => onOpenMission(m.id)}
            />
          ))}
        </Panel>
      )}

      {!loading && filteredMissions.length === 0 && !showAnnouncements && (
        <Panel>
          <div style={{ color: C.dim, fontSize: 13 }}>
            {t("mis.empty")}
          </div>
        </Panel>
      )}

      {/* Announcements section */}
      {showAnnouncements && announcements.length > 0 && (
        <Panel title={`◈ ${t("mis.ann_tab")}`}>
          {announcements.map((a) => (
            <AnnouncementRow
              key={a.id}
              a={a}
              canEdit={canManage || (isLead && a.scope === "squad" && a.squad_id === profile?.squad_id)}
              profileId={profile?.id}
              onDeleted={load}
              onUpdated={load}
            />
          ))}
        </Panel>
      )}

      {showAnnouncements && announcements.length === 0 && filteredMissions.length === 0 && !loading && (
        <Panel>
          <div style={{ color: C.dim, fontSize: 13 }}>
            {kindFilter === "announcements" ? t("mis.ann_empty") : t("mis.empty")}
          </div>
        </Panel>
      )}
    </>
  );
}

/* ── Mission row with progress ── */
function MissionRow({ mission, squadName, readiness, onOpen }) {
  const { t } = useI18n();
  const tone = MISSION_STATUS_TONES[mission.status] || "default";
  const label = t(`status.${mission.status}`) || MISSION_STATUS_LABELS[mission.status] || mission.status;
  const kind = mission.kind || "operational";
  const icon = MISSION_KIND_ICONS[kind] || "⌖";
  const when = kind === "admin"
    ? `${t("common.due")} ${formatWhen(mission.due_at)}`
    : formatWhen(mission.scheduled_at);
  const squadText = mission.squad_id ? squadName : t("mis.wholeteam");

  const pct = readiness?.pct ?? null;
  const isComplete = mission.status === "complete";
  const barColor = isComplete ? C.ok : pct === 100 ? C.ok : pct >= 50 ? C.warn : C.error;

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        all: "unset",
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        boxSizing: "border-box",
        padding: "14px 8px",
        borderBottom: `1px solid ${C.border}`,
        cursor: "pointer",
      }}
    >
      <span aria-hidden style={{
        color: kind === "admin" ? C.warn : C.bright,
        fontSize: 18,
        width: 20,
        textAlign: "center",
        flexShrink: 0,
      }}>{icon}</span>

      <div style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}>
        <div style={{
          color: C.bright,
          fontWeight: 600,
          fontSize: 15,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {mission.name}
        </div>
        <div style={{
          color: C.dim,
          fontSize: 12,
          display: "flex",
          gap: 10,
          alignItems: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          <Mono style={{ color: C.text }}>{squadText}</Mono>
          <span style={{ color: C.dimmer }}>·</span>
          <span style={{ fontFamily: FONT_MONO }}>{when}</span>
          {mission.location && (
            <>
              <span style={{ color: C.dimmer }}>·</span>
              <span style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>{mission.location}</span>
            </>
          )}
        </div>

        {/* Progress bar */}
        {pct !== null && readiness.total > 0 && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 2,
          }}>
            <div style={{
              flex: 1,
              maxWidth: 120,
              height: 4,
              background: C.border,
              borderRadius: 2,
              overflow: "hidden",
            }}>
              <div style={{
                width: `${pct}%`,
                height: "100%",
                background: barColor,
                borderRadius: 2,
                transition: "width 300ms",
              }} />
            </div>
            <span style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              color: barColor,
              fontWeight: 600,
              minWidth: 32,
            }}>
              {pct}%
            </span>
          </div>
        )}
      </div>

      <Badge tone={tone}>{label}</Badge>
      <span style={{ color: C.dimmer, fontSize: 14 }}>›</span>
    </button>
  );
}

/* ── Announcement row with edit / delete ── */
function AnnouncementRow({ a, canEdit, profileId, onDeleted, onUpdated }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(a.title || "");
  const [editBody, setEditBody] = useState(a.body || "");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [err, setErr] = useState("");

  const canModify = canEdit || a.posted_by === profileId;

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
    if (!confirmDel) { setConfirmDel(true); return; }
    setBusy(true); setErr("");
    const { error } = await deleteAnnouncement(a.id);
    setBusy(false);
    if (error) { setErr(String(error.message || error)); return; }
    onDeleted?.();
  }

  if (editing) {
    return (
      <div style={{ padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: C.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>{t("ann.title_label")}</div>
          <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder={t("ann.title_ph")} maxLength={80} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: C.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>{t("ann.body")}</div>
          <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={4} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn small primary disabled={busy || !editBody.trim()} onClick={handleSave}>
            {busy ? t("mis.saving") : t("mis.save")}
          </Btn>
          <Btn small onClick={() => { setEditing(false); setEditTitle(a.title || ""); setEditBody(a.body || ""); }}>
            {t("mis.cancel")}
          </Btn>
        </div>
        <ErrLine>{err}</ErrLine>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 8px", borderBottom: `1px solid ${C.border}` }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        marginBottom: 4,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: C.dim, fontSize: 14 }}>◈</span>
          <span style={{ color: C.bright, fontSize: 13, fontWeight: 600 }}>
            {a.title || t("common.announcement")}
          </span>
        </div>
        <Badge tone={a.scope === "global" ? "bright" : "default"}>
          {(a.scope || "global").toUpperCase()}
        </Badge>
      </div>
      <div style={{
        color: C.text,
        fontSize: 13,
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
      }}>
        {a.body}
      </div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 6,
      }}>
        <div style={{
          color: C.dimmer,
          fontSize: 11,
          fontFamily: FONT_MONO,
        }}>
          {formatWhen(a.posted_at)}
        </div>
        {canModify && (
          <div style={{ display: "flex", gap: 6 }}>
            <Btn small onClick={() => setEditing(true)}>{t("mis.edit")}</Btn>
            <Btn
              small
              onClick={handleDelete}
              style={confirmDel ? { color: C.error, borderColor: C.error } : {}}
              disabled={busy}
            >
              {busy ? "…" : confirmDel ? t("mis.confirm_delete") : t("mis.delete")}
            </Btn>
            {confirmDel && !busy && (
              <Btn small onClick={() => setConfirmDel(false)}>{t("mis.cancel")}</Btn>
            )}
          </div>
        )}
      </div>
      <ErrLine>{err}</ErrLine>
    </div>
  );
}

function formatWhen(ts) {
  if (!ts) return "TBD";
  const d = new Date(ts);
  return d.toLocaleString([], {
    month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).toUpperCase();
}
