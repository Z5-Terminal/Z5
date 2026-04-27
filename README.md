# Z5 TERMINAL

A field operations platform for team management, mission planning, and training coordination. Built as a lightweight single-page application with a retro military terminal aesthetic.

![React](https://img.shields.io/badge/React-18-blue)
![Vite](https://img.shields.io/badge/Vite-5-purple)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-green)
![License](https://img.shields.io/badge/License-Private-red)

---

## Overview

Z5 Terminal is an internal operations tool designed for small team coordination. It provides role-based access control, squad management, mission checklists with real-time progress tracking, a knowledge base for training materials, and a scheduling calendar — all wrapped in a green-on-black CRT terminal interface.

The platform supports English and Hebrew with full RTL layout.

## Features

- **Role-based access control** — Admin, Officer, Squad Leader, and Operator roles with granular permissions enforced at the database level via Row Level Security.
- **Instructor designation** — Any team member can be flagged as an instructor independently of their squad role, granting access to bootcamp squad missions and training materials.
- **Squad management** — Create and manage squads with active or bootcamp status. Generate single-use invite codes for onboarding new members.
- **Mission planning** — Create operational missions or administrative tasks, assign operators with specific roles (sniper, spotter, team lead, comms, medic), and track per-operator checklist completion in real time.
- **Knowledge base** — Upload and organize training materials by subject and week. Supports bootcamp course structures with a 4-week program layout.
- **Equipment registry** — Personal gear inventory with model and serial number tracking for weapons, optics, radios, NVGs, and custom items.
- **Calendar** — Monthly view with scheduled missions and admin task deadlines.
- **Announcements** — Team-wide or squad-scoped announcements with real-time delivery.
- **Real-time sync** — Live updates across all connected clients via database subscriptions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite |
| Backend | Supabase (Postgres, Auth, Realtime, Storage) |
| Security | Row Level Security policies, SECURITY DEFINER functions |
| Deployment | GitHub Pages via GitHub Actions CI/CD |
| Styling | Inline styles, system monospace fonts, CRT scanline overlay |
| i18n | Built-in EN/HE with RTL support |

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project

### Installation

```bash
git clone https://github.com/Z5-Terminal/Z5.git
cd Z5
npm install
```

### Configuration

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Development

```bash
npm run dev
```

Opens at `http://localhost:5173`

### Production Build

```bash
npm run build
```

Static output in `dist/`.

## First-Run Setup

1. Run the database schema in Supabase SQL Editor.
2. Register the first account — it is automatically promoted to **Admin**.
3. Navigate to **Roster** and create your first squad.
4. Generate invite codes and distribute to team members.
5. New operators register with their invite code and are automatically assigned to the correct squad and role.

## Roles & Permissions

| Role | Scope |
|------|-------|
| **Admin** | Full platform control. Manages all squads, members, missions, and settings. |
| **Officer** | Cross-squad authority. Creates missions, manages squads, generates invites. |
| **Squad Leader** | Manages their own squad. Creates missions and invite codes for squad members. |
| **Operator** | Manages own profile, gear inventory, and completes assigned mission checklists. |
| **Instructor** *(flag)* | Additional designation on any role. Grants visibility into bootcamp squad missions and ability to manage training materials. |

## Project Structure

```
src/
├── main.jsx                — Entry point
├── App.jsx                 — Auth gate and top-level routing
├── supabase.js             — Supabase client init
├── auth.jsx                — Auth provider, role helpers
├── i18n.jsx                — Internationalization (EN/HE)
├── theme.js                — Color palette and style constants
├── ui.jsx                  — Shared UI primitives
├── missionTemplate.js      — Mission types, roles, checklist templates
├── data/
│   ├── missions.js         — Mission CRUD and state queries
│   ├── announcements.js    — Announcement operations
│   └── knowledge.js        — Knowledge base operations
└── screens/
    ├── Auth.jsx            — Login and registration
    ├── Shell.jsx           — Navigation shell
    ├── Home.jsx            — Dashboard with upcoming missions
    ├── Missions.jsx        — Mission list and announcements
    ├── MissionCreate.jsx   — Mission creation form
    ├── Checklist.jsx       — Mission detail and checklist
    ├── Calendar.jsx        — Monthly schedule view
    ├── Roster.jsx          — Squad and member management
    ├── Knowledge.jsx       — Training materials library
    ├── Profile.jsx         — User identity and settings
    └── Gear.jsx            — Equipment registry
```

## Deployment

GitHub Actions automatically builds and deploys to GitHub Pages on every push to `main`.

One-time setup: Repository **Settings → Pages → Source → GitHub Actions**.

## Roadmap

**Phase 1** ✅ — Authentication, squads, roles, gear inventory.

**Phase 2** ✅ — Missions, checklists, calendar, announcements, knowledge base, instructor system, bootcamp squad support, i18n.

**Phase 3** — Training course module: cohorts, lesson scheduling, attendance tracking, trainee progress dashboard.

## License

Private. Internal use only.
