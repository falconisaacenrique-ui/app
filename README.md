# LifeHub — Daily Life Command Center

A private, offline-first web app (PWA) that helps you navigate your daily life. All data
is stored locally in your browser — no account, no server, no tracking.

## Goal

> Build a local-first, installable web app featuring a daily dashboard, calendar with
> events, notepad, reminders with notifications, to-do lists, a habit tracker with
> streaks, and an expense/budget tracker — everything needed to organize a day in one
> place.

## Features

- **🏠 Dashboard** — today at a glance: events, due tasks, upcoming reminders, habit
  progress, and monthly spending.
- **📅 Calendar** — month view with color-coded events and times.
- **✅ Tasks** — to-dos with due dates, priorities, and overdue highlighting.
- **📝 Notes** — a notepad with pinning and auto-save.
- **⏰ Reminders** — date/time reminders with browser notifications when due.
- **🔥 Habits** — daily habit tracking with streaks and a 7-day week view.
- **💰 Budget** — expense logging, category breakdown, and a monthly budget bar.
- **📲 PWA** — installable to your phone/desktop home screen and works offline.
- **🌙 Dark mode** — follows your system preference automatically.

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

React 19 + TypeScript + Vite. State persists to `localStorage`; a service worker caches
assets for offline use. No backend required — `dist/` can be hosted on any static host
(GitHub Pages, Netlify, Vercel, …).
