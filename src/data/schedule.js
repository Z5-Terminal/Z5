// Z5 :: schedule_events data layer
// Lightweight calendar entries (meetings, ranges, meals, admin blocks).
// These appear ONLY on the Calendar — not on Home, not on Missions.
import { supabase } from "../supabase";

// Events whose starts_at falls inside [fromISO, toISO). Used by Calendar.
export async function listScheduleEventsInRange({ fromISO, toISO } = {}) {
  if (!fromISO || !toISO) return { data: [], error: null };
  const { data, error } = await supabase
    .from("schedule_events")
    .select("*")
    .gte("starts_at", fromISO)
    .lt("starts_at", toISO)
    .order("starts_at", { ascending: true });
  return { data: data || [], error };
}

export async function createScheduleEvent({
  title, location, notes, startsAt, endsAt, squadId,
}) {
  const payload = {
    title:     title || "",
    location:  location || "",
    notes:     notes || "",
    starts_at: startsAt,
    ends_at:   endsAt || null,
    squad_id:  squadId || null,
  };
  const { data, error } = await supabase
    .from("schedule_events")
    .insert(payload)
    .select()
    .maybeSingle();
  return { data, error };
}

export async function updateScheduleEvent(id, fields) {
  const payload = {};
  if (fields.title     !== undefined) payload.title     = fields.title;
  if (fields.location  !== undefined) payload.location  = fields.location;
  if (fields.notes     !== undefined) payload.notes     = fields.notes;
  if (fields.startsAt  !== undefined) payload.starts_at = fields.startsAt;
  if (fields.endsAt    !== undefined) payload.ends_at   = fields.endsAt;
  if (fields.squadId   !== undefined) payload.squad_id  = fields.squadId;
  const { error } = await supabase
    .from("schedule_events")
    .update(payload)
    .eq("id", id);
  return { error };
}

export async function deleteScheduleEvent(id) {
  const { error } = await supabase
    .from("schedule_events")
    .delete()
    .eq("id", id);
  return { error };
}

export function subscribeScheduleEvents(onChange) {
  const ch = supabase.channel("z5-schedule-events")
    .on("postgres_changes",
        { event: "*", schema: "public", table: "schedule_events" },
        onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
