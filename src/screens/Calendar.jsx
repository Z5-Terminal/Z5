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
  Panel, PageHeader, Btn, IconButton, Input, Textarea, Select, Field,
  ErrLine, OkLine, List, Row, Tile, Menu, ConfirmDialog, EmptyState, Spinner,
  Num, ViewTransition, ELLIPSIS,
} from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, NUM, R, T } from "../theme";
import { DURATION, MOTION } from "../motion";
import { supabase } from "../supabase";

// Calendar tab: month grid + day view.
// Sources:
//   • missions.scheduled_at / missions.due_at (operations & admin tasks)
//   • schedule_events.starts_at (calendar-only entries)
// Schedule events never appear on Home or Missions — they are calendar-only.

const RISE = `z5-rise ${DURATION.move}ms var(--z5-spring) backwards`;

export default function Calendar() {
  const { profile } = useAuth();
  const { t, lang } = useI18n();
  const locale = lang === "he" ? "he-IL" : "en-US";
  const isMobile = useIsMobile();
  const showCreate = canCreateInvites(profile?.role) || !!profile?.is_instructor;
  const today = useMemo(() => startOfDay(new Date()), []);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(null); // Date | null
  const [events, setEvents] = useState([]);          // unified events (missions + schedule)
  const [loading, setLoading] = useState(true);
  // Which way the month grid enters: "pop" when going back in time,
  // "push" when going forward ("tab" for the very first render).
  const [navKind, setNavKind] = useState("tab");

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

  function prevMonth() { setNavKind("pop");  setCursor(addMonths(cursor, -1)); setSelectedDay(null); setScheduleEditing(null); }
  function nextMonth() { setNavKind("push"); setCursor(addMonths(cursor,  1)); setSelectedDay(null); setScheduleEditing(null); }
  function goToday()   {
    const target = startOfMonth(new Date());
    if (target.getTime() !== cursor.getTime()) {
      setNavKind(target.getTime() < cursor.getTime() ? "pop" : "push");
    }
    setCursor(target);
    setSelectedDay(startOfDay(new Date()));
    setScheduleEditing(null);
  }

  function handleSelectDay(d) {
    setSelectedDay(d);
    setScheduleEditing(null);
  }

  const monthLabel = cursor.toLocaleString(locale, { month: "long", year: "numeric" });
  const monthKey = `${cursor.getFullYear()}-${cursor.getMonth()}`;
  const navSize = isMobile ? 40 : 32;

  const dayList = selectedDay ? (eventsByDay.get(dayKey(selectedDay)) || []) : [];
  const scheduleEvents = dayList.filter((e) => e.source === "schedule");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <PageHeader
        title={t("cal.title")}
        subtitle={t("cal.subtitle")}
        action={<Btn small type="button" onClick={goToday}>{t("cal.today")}</Btn>}
      />

      {/* Month card. Its own min-height keeps the page from jumping while
          months load or a busy day is selected. */}
      <Panel style={{
        display: "flex",
        flexDirection: "column",
        minHeight: isMobile ? 360 : 520,
        padding: isMobile ? "14px 10px 12px" : "18px 22px 16px",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 6 : 8,
          marginBottom: isMobile ? 8 : 12,
          paddingInline: isMobile ? 6 : 0,
          flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, minWidth: 0, ...T.title2, color: C.bright, ...ELLIPSIS }}>
              {monthLabel}
            </h2>
            {loading && <Spinner size={14} style={{ color: C.dimmer }} />}
          </div>
          <IconButton
            icon="chevronBack"
            flip
            size={navSize}
            label={t("cal.prev_month")}
            onClick={prevMonth}
          />
          <IconButton
            icon="chevronForward"
            flip
            size={navSize}
            label={t("cal.next_month")}
            onClick={nextMonth}
          />
        </div>

        <MonthGrid
          cursor={cursor}
          monthKey={monthKey}
          navKind={navKind}
          today={today}
          selectedDay={selectedDay}
          eventsByDay={eventsByDay}
          onSelect={handleSelectDay}
          locale={locale}
          t={t}
        />

        <Legend t={t} />
      </Panel>

      {selectedDay && (
        <Panel
          key={dayKey(selectedDay)}
          title={(
            // Same row height with or without the action, so opening the
            // composer doesn't nudge everything below.
            <span style={{ display: "flex", alignItems: "center", minHeight: isMobile ? 34 : 30, textWrap: "balance" }}>
              {dayHeader(selectedDay, locale)}
            </span>
          )}
          action={showCreate && scheduleEditing !== "new" && (
            <Btn
              small
              primary
              type="button"
              icon="plus"
              onClick={() => setScheduleEditing("new")}
            >
              {t("cal.new_schedule")}
            </Btn>
          )}
          style={{ animation: RISE }}
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
            <EmptyState compact icon="calendar" title={t("cal.schedule_empty")} />
          )}

          {scheduleEvents.length > 0 && (
            <List>
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
            </List>
          )}
        </Panel>
      )}
    </div>
  );
}

// ---------- Month grid ------------------------------------------------

function MonthGrid({ cursor, monthKey, navKind, today, selectedDay, eventsByDay, onSelect, locale, t }) {
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
        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
        gap: 2,
        marginBottom: 2,
        flexShrink: 0,
      }}>
        {dayNames.map((d) => (
          <div key={d} style={{
            ...T.caption,
            fontWeight: 500,
            color: C.dimmer,
            textAlign: "center",
            padding: "4px 0",
          }}>
            {d}
          </div>
        ))}
      </div>
      {/* The month slides in from the side it was asked for. The clip
          keeps that travel inside the card; the small bleed leaves room
          for focus rings on the edge cells. */}
      <div style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        margin: -5,
        padding: 5,
      }}>
        <ViewTransition
          viewKey={monthKey}
          kind={navKind}
          style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
        >
          <div style={{
            flex: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            gridTemplateRows: `repeat(6, minmax(${isMobile ? 48 : 54}px, 1fr))`,
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
                  label={d.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" })}
                  inMonth={inMonth}
                  isToday={isToday}
                  isSelected={!!isSelected}
                  events={dayEvents}
                  onClick={() => onSelect(startOfDay(d))}
                  isMobile={isMobile}
                />
              );
            })}
          </div>
        </ViewTransition>
      </div>
    </div>
  );
}

// One day: the date in a round mark (today = filled ink, selected = soft
// fill) with up to three event dots underneath.
function DayCell({ date, label, inMonth, isToday, isSelected, events, onClick, isMobile }) {
  const size = isMobile ? 34 : 30;
  const mark = isToday
    ? { background: C.tint, color: C.onTint, fontWeight: 700 }
    : isSelected
      ? { background: C.fill, color: C.bright, fontWeight: 600 }
      : { background: "transparent", color: inMonth ? C.text : C.dimmer, fontWeight: 400 };
  return (
    <button
      type="button"
      data-press="scale"
      aria-label={label}
      aria-pressed={isSelected}
      aria-current={isToday ? "date" : undefined}
      onClick={onClick}
      style={{
        all: "unset",
        boxSizing: "border-box",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        minHeight: 0,
        minWidth: 0,
        borderRadius: R.md,
      }}
    >
      <span style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: R.pill,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...T.callout,
        lineHeight: 1,
        ...NUM,
        ...mark,
        // Today that is also the selected day gets a ring, so selection
        // stays visible on the filled mark.
        boxShadow: isToday && isSelected ? `0 0 0 2px ${C.panel}, 0 0 0 3.5px ${C.tint}` : "none",
        transition: `background-color ${MOTION.quick}, color ${MOTION.quick}`,
      }}>
        {date.getDate()}
      </span>
      <span aria-hidden style={{
        height: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        opacity: inMonth ? 1 : 0.45,
      }}>
        {events.slice(0, 3).map((e, i) => (
          <span
            key={i}
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: dotColor(e),
            }}
          />
        ))}
        {events.length > 3 && (
          <Num style={{ ...T.caption2, fontSize: 10, lineHeight: 1, color: C.dim }}>
            +{events.length - 3}
          </Num>
        )}
      </span>
    </button>
  );
}

function dotColor(e) {
  if (e.source === "schedule") return C.schedule;
  if (e.kind === "admin") return C.warn;
  return C.ok;
}

// What the three dot colors mean.
function Legend({ t }) {
  const items = [
    { color: C.ok,       label: t("kind.operational") },
    { color: C.warn,     label: t("kind.admin") },
    { color: C.schedule, label: t("cal.schedule_section") },
  ];
  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      columnGap: 16,
      rowGap: 4,
      marginTop: 10,
      flexShrink: 0,
      ...T.caption,
      color: C.dim,
    }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span aria-hidden style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: it.color,
            flexShrink: 0,
          }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

// ---------- Schedule row -----------------------------------------------

function ScheduleRow({ event, canManage, onEdit, onDeleted, t }) {
  const isMobile = useIsMobile();
  const s = event.schedule;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleDelete() {
    if (busy) return;
    setBusy(true); setErr("");
    const { error } = await deleteScheduleEvent(s.id);
    setBusy(false);
    setConfirming(false);
    if (error) { setErr(String(error.message || error)); return; }
    onDeleted && onDeleted();
  }

  const timeStr = format24(event.when);
  const endStr  = event.ends ? format24(event.ends) : null;

  return (
    <>
      <Row
        as="div"
        leading={(
          <div style={{ minWidth: 44, textAlign: "start" }}>
            <Num style={{ display: "block", ...T.callout, fontWeight: 600, color: C.schedule }}>
              {timeStr}
            </Num>
            {endStr && (
              <Num style={{ display: "block", ...T.caption, color: C.dim }}>
                {endStr}
              </Num>
            )}
          </div>
        )}
        trailing={canManage ? (
          <Menu
            items={[
              { key: "edit", label: t("sch.edit"), icon: "pencil", onSelect: onEdit },
              { key: "delete", label: t("sch.delete"), icon: "trash", danger: true, onSelect: () => setConfirming(true) },
            ]}
            trigger={(p) => (
              <IconButton icon="ellipsis" label={t("common.more")} size={isMobile ? 34 : 28} {...p} />
            )}
          />
        ) : null}
      >
        <div style={{ ...T.body, fontWeight: 600, color: C.bright, overflowWrap: "anywhere" }}>
          {s.title || "—"}
        </div>
        {(s.location || s.notes) && (
          <div style={{ ...T.footnote, color: C.dim, marginTop: 1, overflowWrap: "anywhere" }}>
            {s.location && <>{s.location}</>}
            {s.location && s.notes && <span aria-hidden style={{ color: C.dimmer, margin: "0 6px" }}>·</span>}
            {s.notes && <>{s.notes}</>}
          </div>
        )}
        <ErrLine>{err}</ErrLine>
      </Row>
      <ConfirmDialog
        open={confirming}
        title={t("sch.delete_title")}
        message={t("sch.delete_body")}
        confirmLabel={t("sch.delete")}
        cancelLabel={t("sch.cancel")}
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

// ---------- Schedule composer (inline) ---------------------------------

function ScheduleComposer({ mode, initial, selectedDay, profile, t, onDone, onCancel }) {
  const isMobile = useIsMobile();
  const isAdminOfficer = canCreateWholeTeamTask(profile?.role);
  const isInstr = !!profile?.is_instructor;

  const [title, setTitle] = useState(initial?.title || "");
  const [startsAt, setStartsAt] = useState(() =>
    initial?.starts_at
      ? isoToLocalInput(initial.starts_at)
      : dateToLocalInput(selectedDay || new Date(), currentHour())
  );
  const [endsAt, setEndsAt] = useState(() =>
    initial?.ends_at
      ? isoToLocalInput(initial.ends_at)
      : dateToLocalInput(selectedDay || new Date(), currentHour() + 1)
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
      // In edit mode the form stands in for its row inside the list; a
      // new entry sits above the list.
      padding: mode === "edit" ? "10px 0" : "2px 0 12px",
      animation: RISE,
    }}>
      <Tile padding={isMobile ? "14px 12px 12px" : "16px 16px 14px"}>
        <Field label={t("sch.title")}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("sch.title_ph")} />
        </Field>
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))",
          columnGap: 14,
        }}>
          <Field label={t("sch.starts_at")}>
            <Input type="datetime-local" value={startsAt} onChange={(e) => handleStartChange(e.target.value)} />
          </Field>
          <Field label={t("sch.ends_at")}>
            <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </Field>
        </div>
        <Field label={t("sch.location")}>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("sch.location_ph")} />
        </Field>
        <Field label={t("sch.notes")}>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("sch.notes_ph")}
            style={{ height: 88 }}
          />
        </Field>
        {squads.length > 0 && (
          <Field label={t("sch.squad")}>
            <Select value={squadId} onChange={(e) => setSquadId(e.target.value)}>
              {isAdminOfficer && <option value="">{t("sch.whole_team")}</option>}
              {squads.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
          <Btn small primary type="button" onClick={save} disabled={busy} busy={busy}>
            {busy ? t("sch.saving") : t("sch.save")}
          </Btn>
          <Btn small type="button" onClick={onCancel} disabled={busy}>{t("sch.cancel")}</Btn>
        </div>

        <ErrLine>{err}</ErrLine>
        <OkLine>{ok}</OkLine>
      </Tile>
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
// 24h format: "08:00", "14:30" — consistent, no AM/PM.
function format24(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function dayHeader(d, locale = "en-US") {
  return d.toLocaleDateString(locale, {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}
// Build a "YYYY-MM-DDTHH:MM" string for <input type="datetime-local"> from a Date + hour.
function dateToLocalInput(date, hour = 9) {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// Current local hour rounded down (so 11:40 → 11). Used as the default
// time when creating new schedule entries / missions.
function currentHour() {
  return new Date().getHours();
}
// Convert stored ISO (timestamptz) to the local input format.
function isoToLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
