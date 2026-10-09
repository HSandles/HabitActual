import { diffDays, type ISODate } from './dates';
import { taskLabel, type Challenge } from './model';

// Daily reminders are added to the phone's own calendar, so no server is needed.

interface ReminderPlan {
  title: string;
  details: string;
  /** "YYYYMMDDTHHMMSS" in the phone's local time */
  start: string;
  end: string;
  rrule: string;
}

function plan(ch: Challenge, from: ISODate, endDate: ISODate | null, time: string): ReminderPlan {
  const [h, m] = time.split(':').map(Number);
  const date = from.replaceAll('-', '');
  const stamp = (hh: number, mm: number) => `${date}T${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}00`;
  const endMin = h * 60 + m + 15;
  const count = endDate ? diffDays(from, endDate) + 1 : null;
  return {
    title: `HabitActual: ${ch.name}`,
    details: `Today's tasks:\n${ch.tasks.map((t) => `- ${taskLabel(t)}`).join('\n')}\n\nTick them off in HabitActual: ${location.origin}${location.pathname}`,
    start: stamp(h, m),
    end: stamp(Math.min(23, Math.floor(endMin / 60)), endMin >= 24 * 60 ? 59 : endMin % 60),
    rrule: count ? `RRULE:FREQ=DAILY;COUNT=${count}` : 'RRULE:FREQ=DAILY',
  };
}

const escapeIcs = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** RFC 5545 asks for lines of at most 75 octets. */
const fold = (line: string) => line.match(/.{1,70}/gu)?.join('\r\n ') ?? line;

export function buildIcs(ch: Challenge, from: ISODate, endDate: ISODate | null, time: string): string {
  const p = plan(ch, from, endDate, time);
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HabitActual//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${ch.id}-${from}@habitactual`,
    `DTSTAMP:${now}`,
    `DTSTART:${p.start}`,
    `DTEND:${p.end}`,
    p.rrule,
    `SUMMARY:${escapeIcs(p.title)}`,
    `DESCRIPTION:${escapeIcs(p.details)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(p.title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].map(fold).join('\r\n') + '\r\n';
}

export function googleCalendarUrl(ch: Challenge, from: ISODate, endDate: ISODate | null, time: string): string {
  const p = plan(ch, from, endDate, time);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: p.title,
    details: p.details,
    dates: `${p.start}/${p.end}`,
    recur: p.rrule,
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
