import { useCallback, useEffect, useState } from "react";
import { useAuth, roleLabelT } from "../auth";
import { useI18n, fmtWhen } from "../i18n";
import { Panel, PageHeader, Btn, List, EmptyState, SkeletonRows } from "../ui";
import {
  listMyUpcomingMissions, getMyChecklistState, getMission,
} from "../data/missions";
import { listRecentAnnouncements, subscribeAnnouncements } from "../data/announcements";
import { OPERATOR_ROLE_LABELS, sectionsForRole } from "../missionTemplate";
import { MissionRow, AnnouncementItem } from "./Missions";

export default function Home({ onOpenMission, onGoMissions, isBootcamp, squadId }) {
  const { profile } = useAuth();
  const { t } = useI18n();
  const greeting = greet(t);

  const [missions, setMissions] = useState([]);
  const [missionProgress, setMissionProgress] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);

    const { data: upcoming } = await listMyUpcomingMissions(profile.id, {
      limit: 5, role: profile.role, isInstructor: !!profile.is_instructor,
    });
    setMissions(upcoming || []);

    const progress = {};
    for (const m of upcoming || []) {
      if ((m.kind || "operational") === "admin") {
        progress[m.id] = { checked: m.my_done ? 1 : 0, total: 1 };
        continue;
      }
      const [{ items }, { data: st }] = await Promise.all([
        getMission(m.id).then((r) => ({ items: r.items || [] })),
        getMyChecklistState(m.id, profile.id),
      ]);
      const applicable = sectionsForRole(m.my_role);
      const mine = items.filter((it) => applicable.has(it.section));
      const stateMap = new Map((st || []).map((s) => [s.item_id, !!s.checked]));
      const checked = mine.reduce((n, it) => n + (stateMap.get(it.id) ? 1 : 0), 0);
      progress[m.id] = { checked, total: mine.length };
    }
    setMissionProgress(progress);

    const { data: ann } = await listRecentAnnouncements({ limit: 5 });
    const filteredAnn = isBootcamp && squadId
      ? (ann || []).filter((a) => a.scope === "squad" && a.squad_id === squadId)
      : (ann || []);
    setAnnouncements(filteredAnn);

    setLoading(false);
  }, [profile?.id, isBootcamp, squadId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsub = subscribeAnnouncements(() => {
      listRecentAnnouncements({ limit: 5 }).then(({ data }) => {
        const filtered = isBootcamp && squadId
          ? (data || []).filter((a) => a.scope === "squad" && a.squad_id === squadId)
          : (data || []);
        setAnnouncements(filtered);
      });
    });
    return () => { unsub && unsub(); };
  }, [isBootcamp, squadId]);

  const hasMissions      = missions.length > 0;
  const hasAnnouncements = announcements.length > 0;
  const isEmpty          = !loading && !hasMissions && !hasAnnouncements;

  return (
    <>
      <PageHeader
        title={`${greeting}, ${profile?.callsign || "Operator"}`}
        subtitle={`${t("prof.role")}: ${roleLabelT(profile?.role, t)}${profile?.squad_id ? "" : " · " + t("home.nosquad")}`}
      />

      {isEmpty && (
        <Panel>
          <EmptyState icon="checkCircle" title={t("home.empty_title")}>
            {t("home.empty")}
          </EmptyState>
        </Panel>
      )}

      {hasMissions && (
        <Panel
          title={t("home.upcoming")}
          action={<Btn small type="button" onClick={onGoMissions} iconEnd="chevronForward" iconFlip>{t("home.viewall")}</Btn>}
        >
          <List>
            {missions.map((m) => {
              const p = missionProgress[m.id] || { checked: 0, total: 0 };
              const pct = p.total ? Math.round((p.checked / p.total) * 100) : 0;
              const kind = m.kind || "operational";
              return (
                <MissionRow
                  key={m.id}
                  mission={m}
                  when={kind === "admin"
                    ? `${t("common.due")} ${formatWhen(m.due_at)}`
                    : formatWhen(m.scheduled_at)}
                  extra={m.my_role ? (OPERATOR_ROLE_LABELS[m.my_role] || m.my_role) : null}
                  pct={pct}
                  detail={`${p.checked}/${p.total}`}
                  onOpen={() => onOpenMission && onOpenMission(m.id)}
                />
              );
            })}
          </List>
        </Panel>
      )}

      {hasAnnouncements && (
        <Panel title={t("home.announcements")}>
          <List>
            {announcements.map((a) => (
              <AnnouncementItem key={a.id} a={a} />
            ))}
          </List>
        </Panel>
      )}

      {loading && !hasMissions && !hasAnnouncements && (
        <Panel>
          <SkeletonRows rows={4} />
        </Panel>
      )}
    </>
  );
}

function formatWhen(ts) {
  return fmtWhen(ts, null) || "—";
}

function greet(t) {
  const h = new Date().getHours();
  if (h < 5)  return t("home.late");
  if (h < 12) return t("home.morning");
  if (h < 18) return t("home.afternoon");
  return t("home.evening");
}
