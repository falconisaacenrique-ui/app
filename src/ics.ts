/**
 * Minimal iCalendar (RFC 5545) import/export so LifeHub events round-trip
 * with Google Calendar, Apple Calendar, Outlook, etc.
 */
import type { CalendarEvent, Repeat } from './types';
import { uid } from './utils';

const REPEAT_TO_FREQ: Record<Repeat, string> = {
  daily: 'DAILY',
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
};

function escapeICS(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function unescapeICS(s: string): string {
  return s
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

export function exportICS(events: CalendarEvent[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LifeHub//EN'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.id}@lifehub`);
    const date = e.date.replace(/-/g, '');
    if (e.time) {
      lines.push(`DTSTART:${date}T${e.time.replace(':', '')}00`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${date}`);
    }
    lines.push(`SUMMARY:${escapeICS(e.title)}`);
    if (e.notes) lines.push(`DESCRIPTION:${escapeICS(e.notes)}`);
    if (e.repeat) lines.push(`RRULE:FREQ=${REPEAT_TO_FREQ[e.repeat]}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export function importICS(text: string): CalendarEvent[] {
  // Unfold continuation lines (lines starting with whitespace).
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const events: CalendarEvent[] = [];
  let cur: Partial<CalendarEvent> | null = null;

  for (const line of unfolded.split(/\r?\n/)) {
    if (line === 'BEGIN:VEVENT') {
      cur = { color: '#4f46e5' };
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur?.title && cur.date) {
        events.push({
          id: uid(),
          title: cur.title,
          date: cur.date,
          time: cur.time,
          notes: cur.notes,
          color: cur.color!,
          repeat: cur.repeat,
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const name = line.slice(0, idx).split(';')[0].toUpperCase();
    const value = line.slice(idx + 1);
    if (name === 'SUMMARY') cur.title = unescapeICS(value);
    else if (name === 'DESCRIPTION') cur.notes = unescapeICS(value);
    else if (name === 'DTSTART') {
      const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
      if (m) {
        cur.date = `${m[1]}-${m[2]}-${m[3]}`;
        if (m[4]) cur.time = `${m[4]}:${m[5]}`;
      }
    } else if (name === 'RRULE') {
      const f = value.match(/FREQ=(DAILY|WEEKLY|MONTHLY)/i);
      if (f) cur.repeat = f[1].toLowerCase() as Repeat;
    }
  }
  return events;
}
