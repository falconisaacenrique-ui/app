import { describe, expect, it } from 'vitest';
import { exportICS, importICS } from '../ics';
import type { CalendarEvent } from '../types';

const EVENTS: CalendarEvent[] = [
  {
    id: 'a1',
    title: 'Dentist, with x-rays; maybe',
    date: '2026-06-12',
    time: '15:00',
    notes: 'Bring insurance card',
    color: '#4f46e5',
  },
  { id: 'a2', title: 'Gym', date: '2026-06-10', color: '#64748b', repeat: 'weekly' },
  { id: 'a3', title: 'Rent', date: '2026-06-01', color: '#171717', repeat: 'monthly' },
];

describe('ICS round trip', () => {
  it('exports and re-imports all fields', () => {
    const imported = importICS(exportICS(EVENTS));
    expect(imported).toHaveLength(3);
    expect(imported[0].title).toBe('Dentist, with x-rays; maybe');
    expect(imported[0].date).toBe('2026-06-12');
    expect(imported[0].time).toBe('15:00');
    expect(imported[0].notes).toBe('Bring insurance card');
    expect(imported[1].repeat).toBe('weekly');
    expect(imported[1].time).toBeUndefined();
    expect(imported[2].repeat).toBe('monthly');
  });

  it('parses external calendars with folded lines and UTC stamps', () => {
    const external = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Team',
      '  offsite', // folded line: first space is the fold marker, second is content
      'DTSTART:20260615T090000Z',
      'RRULE:FREQ=DAILY;COUNT=3',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const events = importICS(external);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Team offsite');
    expect(events[0].date).toBe('2026-06-15');
    expect(events[0].time).toBe('09:00');
    expect(events[0].repeat).toBe('daily');
  });

  it('ignores events without a date or title', () => {
    const bad = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:No date\r\nEND:VEVENT\r\nEND:VCALENDAR';
    expect(importICS(bad)).toHaveLength(0);
  });
});
