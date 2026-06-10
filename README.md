# LifeHub — Daily Life Command Center

A private, offline-first web app (PWA) that helps you navigate your daily life. All data
is stored locally in your browser — no account, no server, no tracking.

## Goal

See [GOAL.md](GOAL.md) — the full product goal this app implements.

## Features

- **Daily dashboard** — a unified timeline of today's events, reminders, and due tasks
  in time order, plus habit and budget summaries.
- **Quick add** — one button, natural language: "dentist tomorrow 3pm" becomes an
  event, "remind me to call mom 9am" a reminder, "buy groceries friday" a task.
- **Calendar** — month and week views with color-coded, repeating events
  (daily/weekly/monthly), event notes, due tasks shown on their day, and
  ICS import/export to sync with Google/Apple/Outlook calendars.
- **Tasks** — due dates, priorities, repeats (completing reschedules), and editing.
- **Notes** — a notepad with pinning and auto-save.
- **Reminders** — one-off or repeating, with notifications via the service worker.
- **Habits** — daily or n-times-a-week targets, streaks, and a 12-week heatmap.
- **Budget** — expense logging with categories, month-by-month history, monthly budget
  bar, and a configurable currency.
- **Search** — across notes, tasks, events, reminders, and expenses.
- **Undo** — every delete shows an undo toast.
- **Weekly review** — tasks completed vs. slipped, habit consistency, weekly
  spending, and a preview of the week ahead.
- **Backup & transfer** — export/import all data as JSON, or as a password-encrypted
  (AES-GCM) file safe to move between devices through any channel; storage
  persistence is requested so the browser protects your data.
- **PWA** — installable, offline-capable, hash-routed so the back button works.

## Design

Ultra-minimalist: white/black surfaces, generous whitespace, thin typography, Lucide
line icons (no emojis), and a single indigo accent used sparingly. Dark mode follows
the system preference.

## Running it

```bash
npm install
npm run dev      # development server
npm run build    # production build (outputs to dist/)
npm run preview  # serve the production build locally
```

To install it on your phone, open the deployed app in your browser and choose
"Add to Home Screen" / "Install app".

## Tech

React 19 + TypeScript + Vite + lucide-react. State persists to `localStorage`; a
service worker caches assets for offline use. No backend required — `dist/` can be
hosted on any static host (GitHub Pages, Netlify, Vercel, …).
