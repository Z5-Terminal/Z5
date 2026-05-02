import { useCallback, useEffect, useMemo, useState } from "react";
import { listMissionsInRange } from "../data/missions";
import {
  listScheduleEventsInRange,
  createScheduleEvent,
  updateScheduleEvent,
  deleteScheduleEvent,
} from "../data/schedule";
import { useAuth, canCreateInvites, canCreateWholeTeamTask } from "../auth";
import { useI18n } from "../i18n";
import {
  Panel, PageHeader, Btn, Input, Textarea, Field, ErrLine, OkLine,
} from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, FONT_MONO, S } from "../theme";
import { supabase } from "../supabase";

// Calendar tab: month grid + day view.
// Sources:
//   • missions.scheduled_at / missions.due_at (operations & admin tasks)
//   • schedule_events.starts_at (calendar-only entries)
// Schedule events never appear on Home or Missions — they are calendar-only.

const SCHEDULE_TONE = "#55b8ff"; // distinct from mission (green) and admin (yellow)

export default function Calendar() {
  const { profile } = useAuth();
  const { t, dir } = useI18n();
  const isMobile = useIsMobile();
  const showCreate = canCreateInvites(profile?.role) || !!profile?.is_instructor;
  const today = useMemo(() => startOfDay(new Date()), []);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(null); // Date | null
  const [events, setEvents] = useState([]);          // unified events (missions + schedule)
  const [loading, setLoading] = useState(true);

  // Inline schedule composer state (null = closed, "new" = create form,
  // or a schedule-event object = edit form).
  const [scheduleEditing, setScheduleEditing] = useState(null);

  const monthStart = useMemo(() => startOfMonth(cursor), [cursor]);
  const monthEnd   = useMemo(() => endOfMonth(cursor),   [cursor]);

  const load = useCallback(async () => {
    setLoading(true);
    const fromISO = monthStart.toISOString();
    const toISO   = new Date(monthEnd.getTime() + 24 * 3600 * 1000).toISOString();

    const [missionsResp, schedResp] = await Promise.all([
      listMissionsInRange({ fromISO, toISO }),
      listScheduleEventsInRange({ fromISO, toISO }),
    ]);

    const evs = [];
    for (const m of missionsResp.data || []) {
      if (m.kind === "admin") {
        if (m.due_at) evs.push(buildMissionEvent(m, m.due_at, "due"));
      } else {
        if (m.scheduled_at) evs.push(buildMissionEvent(m, m.scheduled_at, "scheduled"));
      }
    }
    for (const s of schedResp.data || []) {
      evs.push(buildScheduleEvent(s));
    }
    setEvents(evs);
    setLoading(false);
  }, [monthStart, monthEnd]);

  useEffect(() => { load(); }, [load]);

  // Subscribe to mission + schedule changes so the calendar stays fresh.
  useEffect(() => {
    const ch = supabase.channel("z5-calendar")
      .on("postgres_changes",
          { event: "*", schema: "public", table: "missions" },
          () => load())
      .on("postgres_changes",
          { event: "*", schema: "public", table: "schedule_events" },
          () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      const key = dayKey(e.when);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.when.getTime() - b.when.getTime());
    }
    return map;
  }, [events]);

  function prevMonth() { setCursor(addMonths(cursor, -1)); setSelectedDay(null); setScheduleEditing(null); }
  function nextMonth() { setCursor(addMonths(cursor,  1)); setSelectedDay(null); setScheduleEditing(null); }
  function goToday()   {
    const t = startOfMonth(new Date());
    setCursor(t);
    setSelectedDay(startOfDay(new Date()));
    setScheduleEditing(null);
  }

  function handleSelectDay(d) {
    setSelectedDay(d);
    setScheduleEditing(null);
  }

  const monthLabel = cursor.toLocaleString([], { month: "long", year: "numeric" }).toUpperCase();

  // Let the page flow naturally — the month grid has its own minHeight so it
  // won't collapse when a day with many events is selected.
  const rootStyle = { display: "flex", flexDirection: "column", minHeight: 0 };

  return (
    <div style={rootStyle}>
      <PageHeader
        title={t("cal.title")}
        subtitle={t("cal.subtitle")}
        action={<Btn small onClick={goToday}>{t("cal.today")}</Btn>}
      />

      <div style={{
        ...S.panel,
        marginBottom: selectedDay ? 16 : 0,
        display: "flex",
        flexDirection: "column",
        padding: isMobile ? "12px 10px" : "18px 22px",
        borderRadius: isMobile ? "0 0 6px 6px" : "0 0 4px 4px",
        minHeight: isMobile ? 360 : 520,
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 10,
          flexShrink: 0,
          direction: dir,
        }}>
          <Btn small onClick={prevMonth}>{t("cal.prev")}</Btn>
          <div style={{
            fontFamily: FONT_MONO,
            color: C.bright,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "1.5px",
          }}>
            {monthLabel}
          </div>
          <Btn small onClick={nextMonth}>{t("cal.next")}</Btn>
        </div>

        <MonthGrid
          cursor={cursor}
          today={today}
          selectedDay={selectedDay}
          eventsByDay={eventsByDay}
          onSelect={handleSelectDay}
          t={t}
        />

        {loading && (
          <div style={{ color: C.dim, fontSize: 11, marginTop: 6, flexShrink: 0 }}>{t("cal.loading")}</div>
        )}
      </div>

      {selectedDay && (() => {
        const list = eventsByDay.get(dayKey(selectedDay)) || [];
        const scheduleEvents = list.filter((e) => e.source === "schedule");

        return (
          <Panel
            title={dayHeader(selectedDay)}
            action={showCreate && (
              <Btn small primary onClick={() => setScheduleEditing("new")}>
                {t("cal.new_schedule")}
              </Btn>
            )}
          >
            {scheduleEditing === "new" && (
              <ScheduleComposer
                mode="create"
                selectedDay={selectedDay}
                profile={profile}
                t={t}
                onDone={() => { setScheduleEditing(null); load(); }}
                onCancel={() => setScheduleEditing(null)}
              />
            )}

            {scheduleEvents.length === 0 && scheduleEditing !== "new" && (
              <div style={{ color: C.dim, fontSize: 13 }}>{t("cal.schedule_empty")}</div>
            )}

            {scheduleEvents.map((e) => {
              const isEditing = scheduleEditing && typeof scheduleEditing === "object"
                && scheduleEditing.id === e.schedule.id;
              if (isEditing) {
                return (
                  <ScheduleComposer
                    key={e.key}
                    mode="edit"
                    initial={e.schedule}
                    selectedDay={selectedDay}
                    profile={profile}
                    t={t}
                    onDone={() => { setScheduleEditing(null); load(); }}
                    onCancel={() => setScheduleEditing(null)}
                  />
                );
              }
              return (
                <ScheduleRow
                  key={e.key}
                  event={e}
                  canManage={canManageScheduleEvent(profile, e.schedule)}
                  onEdit={() => setScheduleEditing(e.schedule)}
                  onDeleted={load}
                  t={t}
                />
              );
            })}
          </Panel>
        );
      })()}
    </div>
  );
}

// ---------- Month grid ------------------------------------------------

function MonthGrid({ cursor, today, selectedDay, eventsByDay, onSelect, t }) {
  const isMobile = useIsMobile();
  const first = startOfMonth(cursor);
  // Grid starts on Sunday of the week containing the 1st.
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }

  const dayNames = [t("cal.sun"),t("cal.mon"),t("cal.tue"),t("cal.wed"),t("cal.thu"),t("cal.fri"),t("cal.sat")];

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 2,
        marginBottom: 4,
        flexShrink: 0,
      }}>
        {dayNames.map((d) => (
          <div key={d} style={{
            color: C.dimmer,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.8px",
            textAlign: "center",
            padding: "4px 0",
          }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{
        flex: 1,
        minHeight: 0,
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gridTemplateRows: "repeat(6, minmax(0, 1fr))",
        gap: 2,
      }}>
        {cells.map((d) => {
          const inMonth = d.getMonth() === first.getMonth();
          const isToday = sameDay(d, today);
          const isSelected = selectedDay && sameDay(d, selectedDay);
          const dayEvents = eventsByDay.get(dayKey(d)) || [];
          return (
            <DayCell
              key={d.toISOString()}
              date={d}
              inMonth={inMonth}
              isToday={isToday}
              isSelected={isSelected}
              events={dayEvents}
              onClick={() => onSelect(startOfDay(d))}
              isMobile={isMobile}
            />
          );
        })}
      </div>
    </div>
  );
}

function DayCell({ date, inMonth, isToday, isSelected, events, onClick, isMobile }) {
  const hasEvents = events.length > 0;
  const bg = isSelected
    ? C.navActiveBg
    : isToday
      ? C.progressTrack
      : "transparent";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        padding: isMobile ? 4 : 6,
        background: bg,
        border: `1px solid ${isSelected ? C.bright : isToday ? C.borderBright : C.border}`,
        borderRadius: 3,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 0,
        minWidth: 0,
        overflow: "hidden",
        opacity: inMonth ? 1 : 0.35,
      }}
    >
      <div style={{
        color: isToday ? C.bright : C.text,
        fontSize: isMobile ? 12 : 13,
        fontWeight: isToday ? 700 : 500,
        lineHeight: 1,
        textAlign: "right",
      }}>
        {date.getDate()}
      </div>
      {hasEvents && (
        <div style={{
          display: "flex",
          gap: 2,
          justifyContent: "center",
          flexWrap: "wrap",
        }}>
          {events.slice(0, 3).map((e, i) => (
            <span
              key={i}
              aria-hidden
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: dotColor(e),
              }}
            />
          ))}
          {events.length > 3 && (
            <span style={{
              color: C.dim,
              fontSize: 9,
              lineHeight: 1,
            }}>
              +{events.length - 3}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function dotColor(e) {
  if (e.source === "schedule") return SCHEDULE_TONE;
  if (e.kind === "admin") return C.warn;
  return C.ok;
}

// ---------- Schedule row -----------------------------------------------

function ScheduleRow({ event, canManage, onEdit, onDeleted, t }) {
  const isMobile = useIsMobile();
  const s = event.schedule;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    const { error } = await deleteScheduleEvent(s.id);
    setBusy(false);
    if (!error) { setConfirming(false); onDeleted && onDeleted(); }
  }

  const timeStr = format24(event.when);
  const endStr  = event.ends ? format24(event.ends) : null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      width: "100%",
      boxSizing: "border-box",
      padding: "10px 4px",
      borderBottom: `1px solid ${C.border}`,
    }}>
      {/* Time */}
      <div style={{
        fontFamily: FONT_MONO,
        color: SCHEDULE_TONE,
        fontSize: 13,
        fontWeight: 700,
        flexShrink: 0,
        lineHeight: 1.3,
        textAlign: "right",
      }}>
        {timeStr}
        {endStr && (
          <div style={{ color: C.dim, fontWeight: 600, fontSize: 11 }}>
            {endStr}
          </div>
        )}
      </div>

      {/* Title + details */}
      <div style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}>
        <div style={{
          color: C.bright,
          fontWeight: 600,
          fontSize: 14,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {s.title || "—"}
        </div>
        {(s.location || s.notes) && (
          <div style={{
            color: C.dim,
            fontSize: 11,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {s.location && <>{s.location}</>}
            {s.location && s.notes && <> · </>}
            {s.notes && <>{s.notes}</>}
          </div>
        )}
      </div>

      {/* Actions — compact, right-aligned */}
      {canManage && (
        <div style={{
          display: "flex",
          gap: 4,
          flexShrink: 0,
        }}>
          {confirming ? (
            <>
              <Btn small onClick={() => setConfirming(false)}>✕</Btn>
              <Btn small primary onClick={handleDelete} disabled={busy}>
                {t("sch.confirm_delete")}
              </Btn>
            </>
          ) : (
            <>
              <Btn small onClick={onEdit}>✎</Btn>
              <Btn small onClick={() => setConfirming(true)}>✕</Btn>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Schedule composer (inline) ---------------------------------

function ScheduleComposer({ mode, initial, selectedDay, profile, t, onDone, onCancel }) {
  const isAdminOfficer = canCreateWholeTeamTask(profile?.role);
  const isInstr = !!profile?.is_instructor;

  const [title, setTitle] = useState(initial?.title || "");
  const [startsAt, setStartsAt] = useState(() =>
    initial?.starts_at
      ? isoToLocalInput(initial.starts_at)
      : dateToLocalInput(selectedDay || new Date(), 9)
  );
  const [endsAt, setEndsAt] = useState(() =>
    initial?.ends_at
      ? isoToLocalInput(initial.ends_at)
      : dateToLocalInput(selectedDay || new Date(), 10)
  );

  // Auto-adjust end time when start time changes: keep end 1h after start
  function handleStartChange(val) {
    const oldStart = startsAt ? new Date(startsAt).getTime() : 0;
    const oldEnd   = endsAt   ? new Date(endsAt).getTime()   : 0;
    const gap = oldEnd > oldStart ? oldEnd - oldStart : 3600000; // default 1h
    setStartsAt(val);
    if (val) {
      const newEnd = new Date(new Date(val).getTime() + gap);
      setEndsAt(isoToLocalInput(newEnd.toISOString()));
    }
  }
  const [location, setLocation] = useState(initial?.location || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  // Scope: "" = whole team, or a squad id
  const [squadId, setSquadId] = useState(() => {
    if (initial) return initial.squad_id || "";
    return isAdminOfficer ? "" : (profile?.squad_id || "");
  });

  const [squads, setSquads] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("squads").select("*").order("name");
      const allowed = isAdminOfficer
        ? (data || [])
        : isInstr
          ? (data || []).filter((s) => s.id === profile?.squad_id || s.is_bootcamp)
          : (data || []).filter((s) => s.id === profile?.squad_id);
      setSquads(allowed);
    })();
  }, [isAdminOfficer, profile?.squad_id]);

  async function save() {
    setErr(""); setOk("");
    const name = title.trim();
    if (!name) { setErr(t("sch.err_title")); return; }
    if (!startsAt) { setErr(t("sch.err_starts_at")); return; }

    const startsISO = new Date(startsAt).toISOString();
    const endsISO = endsAt ? new Date(endsAt).toISOString() : null;
    if (endsISO && new Date(endsISO).getTime() <= new Date(startsISO).getTime()) {
      setErr(t("sch.err_ends_before"));
      return;
    }

    setBusy(true);
    if (mode === "edit") {
      const { error } = await updateScheduleEvent(initial.id, {
        title: name, location, notes,
        startsAt: startsISO, endsAt: endsISO,
        squadId: squadId || null,
      });
      setBusy(false);
      if (error) { setErr(error.message); return; }
      setOk(t("sch.updated"));
      onDone && onDone();
    } else {
      const { error } = await createScheduleEvent({
        title: name, location, notes,
        startsAt: startsISO, endsAt: endsISO,
        squadId: squadId || null,
      });
      setBusy(false);
      if (error) { setErr(error.message); return; }
      setOk(t("sch.created"));
      onDone && onDone();
    }
  }

  return (
    <div style={{
      padding: "8px 4px 12px",
      borderBottom: `1px solid ${C.border}`,
      marginBottom: 8,
      maxWidth: "100%",
      boxSizing: "border-box",
    }}>
      <Field label={t("sch.title")}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("sch.title_ph")} />
      </Field>
      <Field label={t("sch.starts_at")}>
        <Input type="datetime-local" value={startsAt} onChange={(e) => handleStartChange(e.target.value)} />
      </Field>
      <Field label={t("sch.ends_at")}>
        <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
      </Field>
      <Field label={t("sch.location")}>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("sch.location_ph")} />
      </Field>
      <Field label={t("sch.notes")}>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("sch.notes_ph")} />
      </Field>
      {squads.length > 0 && (
        <Field label={t("sch.squad")}>
          <select
            value={squadId}
            onChange={(e) => setSquadId(e.target.value)}
            style={{ ...S.input, fontSize: 15 }}
          >
            {isAdminOfficer && <option value="">{t("sch.whole_team")}</option>}
            {squads.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
      )}

      {err && <ErrLine>{err}</ErrLine>}
      {ok  && <OkLine>{ok}</OkLine>}

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <Btn small primary onClick={save} disabled={busy}>
          {busy ? t("sch.saving") : t("sch.save")}
        </Btn>
        <Btn small onClick={onCancel} disabled={busy}>{t("sch.cancel")}</Btn>
      </div>
    </div>
  );
}

// ---------- Permission helper -----------------------------------------

function canManageScheduleEvent(profile, event) {
  if (!profile) return false;
  if (profile.role === "admin" || profile.role === "officer") return true;
  if (profile.role === "squad_leader"
      && event.squad_id
      && event.squad_id === profile.squad_id) {
    return true;
  }
  // Instructors can manage schedule events they created
  if (profile.is_instructor && event.created_by === profile.id) return true;
  return false;
}

// ---------- Date helpers + event builders -----------------------------

function buildMissionEvent(mission, ts, role) {
  const when = new Date(ts);
  return {
    source: "mission",
    key:    `m:${mission.id}:${role}`,
    mission,
    when,
    kind:   mission.kind || "operational",
  };
}
function buildScheduleEvent(schedule) {
  return {
    source: "schedule",
    key:    `s:${schedule.id}`,
    schedule,
    when:   new Date(schedule.starts_at),
    ends:   schedule.ends_at ? new Date(schedule.ends_at) : null,
  };
}
function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function startOfMonth(d) { const x = new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
function endOfMonth(d) {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() + 1);
  x.setDate(0);
  x.setHours(23,59,59,999);
  return x;
}
function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}
function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function formatTime(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
// 24h format: "08:00", "14:30" — consistent, no AM/PM.
function format24(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function dayHeader(d) {
  return d.toLocaleDateString([], {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  }).toUpperCase();
}
// Build a "YYYY-MM-DDTHH:MM" string for <input type="datetime-local"> from a Date + hour.
function dateToLocalInput(date, hour = 9) {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// Convert stored ISO (timestamptz) to the local input format.
function isoToLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
