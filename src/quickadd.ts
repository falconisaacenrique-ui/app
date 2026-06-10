/**
 * Natural-language quick-add parser.
 * "dentist tomorrow 3pm"        -> event tomorrow at 15:00
 * "remind me to call mom 9am"   -> reminder today 09:00
 * "buy groceries friday"        -> task due next Friday
 * "write journal"               -> task
 */
import { toDateStr } from './utils';

export interface ParsedQuickAdd {
  kind: 'task' | 'event' | 'reminder';
  text: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function parseQuickAdd(input: string, now: Date = new Date()): ParsedQuickAdd {
  let text = input.trim();
  let kind: ParsedQuickAdd['kind'] = 'task';
  let date: string | undefined;
  let time: string | undefined;

  const reminderMatch = text.match(/^(remind me to|remind me|reminder:?|remind)\s+/i);
  if (reminderMatch) {
    kind = 'reminder';
    text = text.slice(reminderMatch[0].length);
  }

  // Time: "3pm", "3:30 pm", "15:00", "at 9"
  const timeMatch =
    text.match(/\b(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?\b/i) ??
    text.match(/\b(?:at\s+)?(\d{1,2})\s*(am|pm)\b/i);
  if (timeMatch) {
    let hours: number;
    let minutes: number;
    let meridiem: string | undefined;
    if (timeMatch.length === 4) {
      hours = Number(timeMatch[1]);
      minutes = Number(timeMatch[2]);
      meridiem = timeMatch[3]?.toLowerCase();
    } else {
      hours = Number(timeMatch[1]);
      minutes = 0;
      meridiem = timeMatch[2]?.toLowerCase();
    }
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    if (hours <= 23 && minutes <= 59) {
      time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      text = (text.slice(0, timeMatch.index) + text.slice(timeMatch.index! + timeMatch[0].length)).trim();
    }
  }

  // Date words
  const lower = () => text.toLowerCase();
  if (/\btoday\b/.test(lower())) {
    date = toDateStr(now);
    text = text.replace(/\btoday\b/i, '').trim();
  } else if (/\btomorrow\b/.test(lower())) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    date = toDateStr(d);
    text = text.replace(/\btomorrow\b/i, '').trim();
  } else {
    for (let i = 0; i < WEEKDAYS.length; i++) {
      const full = WEEKDAYS[i];
      const re = new RegExp(`\\b(?:on\\s+|next\\s+)?(${full}|${full.slice(0, 3)})\\b`, 'i');
      const m = text.match(re);
      if (m) {
        const d = new Date(now);
        const delta = (i - d.getDay() + 7) % 7 || 7; // next occurrence, never today
        d.setDate(d.getDate() + delta);
        date = toDateStr(d);
        text = (text.slice(0, m.index) + text.slice(m.index! + m[0].length)).trim();
        break;
      }
    }
    if (!date) {
      // "jun 12" / "june 12"
      const m = text.match(/\b([a-z]{3,9})\s+(\d{1,2})\b/i);
      if (m) {
        const monthIdx = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
        const day = Number(m[2]);
        if (monthIdx >= 0 && day >= 1 && day <= 31) {
          const d = new Date(now.getFullYear(), monthIdx, day);
          if (toDateStr(d) < toDateStr(now)) d.setFullYear(d.getFullYear() + 1);
          date = toDateStr(d);
          text = (text.slice(0, m.index) + text.slice(m.index! + m[0].length)).trim();
        }
      }
    }
  }

  if (kind === 'reminder') {
    if (!date) date = toDateStr(now);
    if (!time) time = '09:00';
  } else if (time) {
    kind = 'event';
    if (!date) date = toDateStr(now);
  }

  text = text.replace(/\s{2,}/g, ' ').replace(/\s+(at|on)$/i, '').trim();
  return { kind, text, date, time };
}
