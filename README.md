# JeevanGrid — Safer People. Stronger Communities.

> Citizen-first disaster resilience and emergency operations platform for India.

[![Stack](https://img.shields.io/badge/stack-React%20%7C%20Express%20%7C%20Prisma-blue)](#tech-stack)
[![Languages](https://img.shields.io/badge/languages-EN%20%7C%20HI%20%7C%20MR%20%7C%20GU%20%7C%20AS-green)](#multilingual-system)
[![Database](https://img.shields.io/badge/database-SQLite%20(Prisma)-lightgrey)](#tech-stack)
[![Deploy](https://img.shields.io/badge/frontend-Vercel%20ready-black)](#deployment)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#license)

<p align="center">
  <a href="https://jeevangrid-one.vercel.app">
    <img src="https://img.shields.io/badge/🚀%20LIVE%20DEMO-Try%20the%20Prototype-00C853?style=for-the-badge" alt="Live Demo">
  </a>
</p>

JeevanGrid bridges the communication gap between Indian citizens and disaster management
authorities during geological, meteorological, and hydrological emergencies — with live
risk intelligence, official alert bulletins, rapid incident triage, role-based operational
dashboards, and a multilingual AI safety assistant with voice input/output.

**Design language:** calm, government-grade, emergency-ready. Off-white surfaces, deep
navy/forest typography, restrained emergency red. No decoration that competes with safety.

---

## Table of contents

- [Features](#features)
- [Multilingual system](#multilingual-system)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [Demo accounts](#demo-accounts)
- [Evaluation walkthrough](#evaluation-walkthrough)
- [Deployment](#deployment)
- [Security notes](#security-notes)
- [Project status](#project-status)
- [Data attribution](#data-attribution)
- [License](#license)

---

## Features

**Citizen experience**

- Disaster forecast lookup by city, district, or PIN code, plus GPS detection
- District-level risk intelligence: risk score, hazard staging, rainfall outlook, do's/don'ts
- Interactive Leaflet + OpenStreetMap view with state/district GeoJSON boundaries
- Live weather (Open-Meteo), air quality, and USGS earthquake telemetry
- Official multi-hazard alert bulletins with severity staging
- One-tap emergency dialer (112, 1078, 108, 101, 1091) and relief shelter / hospital directories
- Incident reporting with live GPS and official tracking IDs (`JG-2026-XXXXX`)

**AI Safety Assistant**

- Agentic pipeline: intent detection → verified JeevanGrid context → Nugen / DeepSeek / local engine → safety validation → localized response
- The assistant reasons over supplied data only — it never invents warnings, shelters, hospital beds, or dispatches
- Emergency-first behavior: immediate danger surfaces **Call 112** before anything else
- Voice input (speech-to-text with transcript review) and Listen/playback (text-to-speech) in all 5 languages
- Suggested questions, tool-activity transparency, and official-source labeling

**Operations**

- Role-based dashboards: District Officer, Field Responder, Health Officer, State EOC, Community Volunteer
- Incident triage queue, responder dispatch, field SitReps, hospital surge and shelter occupancy views
- One-click demo role switching for evaluators

---

## Multilingual system

 Citizens select a language once in the header — the entire experience follows, including the AI assistant.

| Language | Native name | UI | AI responses | Voice in/out |
|---|---|---|---|---|
| English | English | Yes | Yes | Yes |
| Hindi | हिन्दी | Yes | Yes | Yes |
| Marathi | मराठी | Yes | Yes | Yes |
| Gujarati | ગુજરાતી | Yes | Yes | Yes |
| Assamese | অসমীয়া | Yes | Yes | Yes |

How it is built:

- **Static UI** (`client/src/i18n/`): typed per-language dictionaries behind semantic keys
  (`nav.home`, `hero.checkRisk`, `emergency.call112`). No translation API on render; English fallback; persisted to `localStorage: jeevangrid.language`.
- **Central language service** (`server/src/services/language/`): provider abstraction
  (`IndicTrans2 → Bhashini → safe fallback → English original`) with caching, Hinglish-tolerant
  detection, and graceful degradation — a provider outage never breaks the app.
- **AI localization**: LLM replies are instructed into the user's language; the offline safety
  engine ships static 5-language chrome (`aiLocal.ts`) so emergencies stay localized with zero providers.
- **Voice**: browser speech recognition/synthesis per-language (fast path); server STT/TTS
  contracts exist (`POST /api/ai/transcribe`, `POST /api/speech/synthesize`) and honestly report
  `503/501` until a server provider is credentialed.
- Official warnings keep severity, area, times, source, and numbers verbatim — only surrounding chrome is localized. Numbers, units, coordinates, phone numbers, and IDs are never translated.

---

## Architecture

```text
┌──────────────┐      ┌─────────────────────────────────┐
│  client/     │      │  server/                        │
│  React + Vite│─────▶│  Express + Prisma (SQLite)      │
│  :3000 (dev) │ /api │  :5000 (dev)                    │
└──────────────┘      └─────────────────────────────────┘
        │                        │
        │   LanguageService      │  AI Orchestrator
        │   translate/detect     │  intent → tools → LLM/local
        │                        │  Nugen · DeepSeek · local engine
        ▼                        ▼
  ┌──────────────────────────────────────────────┐
  │  Live data: Open-Meteo · USGS · Overpass/OSM │
  │  Official: SACHET/NDMA · IMD · INCOIS (linked)│
  └──────────────────────────────────────────────┘
```

---

## Project structure

```text
JeevanGrid/
├── client/                        # Frontend (React 18 + Vite + TypeScript + Tailwind)
│   ├── public/hero-bg/            # Hero carousel imagery
│   ├── src/
│   │   ├── api/client.ts          # Typed fetch wrapper (JWT, Accept-Language, VITE_API_URL)
│   │   ├── i18n/                  # Global language system
│   │   │   ├── languages.ts       # Codes, native names, detection + persistence
│   │   │   ├── dictionaries.ts    # en/hi/mr/gu/as static UI bundles
│   │   │   └── LanguageContext.tsx# Provider, useLanguage(), t()
│   │   ├── components/
│   │   │   ├── Header.tsx         # Global nav + language dropdown
│   │   │   ├── LanguageSelector.tsx# Premium accessible language menu
│   │   │   ├── Footer.tsx / EmergencyModal.tsx
│   │   │   ├── LeafletMap.tsx / MapLayerControl.tsx
│   │   │   └── ai/                # Assistant UI: i18n, voice hooks, structured messages
│   │   ├── context/AuthContext.tsx# JWT auth + demo role switching
│   │   ├── pages/                 # Landing, RiskDashboard, Assistant, Alerts, Guides,
│   │   │                         # Resources, EmergencyReport, Login/Register
│   │   └── pages/dashboards/      # District, Responder, Health, StateEOC, Volunteer
│   ├── index.html / vite.config.ts# Port 3000, /api proxy, Indic font loading
│   └── .env.example               # VITE_API_URL (production backend URL)
├── server/                        # Backend (Node + Express + TypeScript)
│   ├── prisma/schema.prisma       # SQLite schema: users, alerts, incidents, facilities…
│   ├── prisma/seed.ts             # Realistic Indian demo data + demo users
│   └── src/
│       ├── index.ts               # App bootstrap, CORS, route mounting, /api/health
│       ├── routes/                # auth, risk, weather, aqi, alerts, incidents,
│       │                         # emergency-reports, field-reports, resources, guides,
│       │                         # dashboards, geo, facilities, advisories, ai, language
│       ├── controllers/           # Request validation + response shaping
│       ├── services/              # riskEngine, weather/aqi/quake, geo, facilities,
│       │                         # nugen/deepseek, aiOrchestrator, speechService
│       └── services/language/     # LanguageService + providers + aiLocal strings
├── Assets/                        # Source design assets (geo JSON, hero backgrounds)
├── Sitich/                        # Early design explorations (reference only)
├── vercel.json                    # Frontend deploy config (Vercel + Vite)
├── package.json                   # Monorepo scripts (dev / install:all / build / seed)
└── README.md
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Leaflet + OpenStreetMap, Recharts |
| Backend | Node.js, Express, TypeScript, Prisma ORM, JWT, bcryptjs |
| Database | SQLite (`server/prisma/dev.db`, local dev only — never committed) |
| AI | Nugen aligned inference → DeepSeek → local NDMA-aligned engine (ordered fallback) |
| Language | Static UI bundles + LanguageService (IndicTrans2 / Bhashini adapters, graceful fallback) |
| Speech | Web Speech API (client fast path); server STT/TTS contracts ready |

---

## Quick start

**Prerequisites:** Node.js 18+ (22 recommended), npm 9+.

```bash
# 1. Clone
git clone https://github.com/vinayak1497/JeevanGrid.git
cd JeevanGrid

# 2. Install everything (root + server + client)
npm run install:all

# 3. Configure backend (required: JWT + database)
cp server/.env.example server/.env
# then edit server/.env — at minimum set JWT_SECRET to a long random string

# 4. Seed demo data (alerts, hospitals, shelters, users)
npm run seed

# 5. Run both servers (backend :5000, frontend :3000)
npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend health | http://localhost:5000/api/health |

Run separately if you prefer isolated logs:

```bash
npm run dev --prefix server   # backend only
npm run dev --prefix client   # frontend only
```

---

## Environment variables

Backend — copy `server/.env.example` to `server/.env` (this file is git-ignored and must never be committed):

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | No (default 5000) | Backend listen port |
| `DATABASE_URL` | Yes | Prisma connection, e.g. `file:./dev.db` |
| `JWT_SECRET` | **Yes** | Long random secret for auth tokens |
| `DEMO_MODE` | No | `true` enables demo role switching |
| `NUGEN_API_KEY` / `NUGEN_ENDPOINT` | No | Nugen aligned inference (primary AI) |
| `DEEPSEEK_API_KEY` | No | DeepSeek fallback (also reads legacy `Deepseek`) |
| `OPEN_METEO_BASE_URL` | No | Weather provider base URL |
| `AIR_QUALITY_API_KEY` | No | Air-quality provider key |
| `USGS_EARTHQUAKE_API_URL` | No | Earthquake feed |
| `OVERPASS_API_URL` | No | Live facility POIs |
| `SACHET_BASE_URL` / `INCOIS_BASE_URL` | No | Official bulletin links |
| `INDICTRANS_BASE_URL` | No | Self-hosted IndicTrans2 endpoint (else skipped) |
| `BHASHINI_API_KEY` / `BHASHINI_BASE_URL` | No | Bhashini translation (else skipped) |
| `STT_PROVIDER` | No | Server speech-to-text provider id |

Frontend — copy `client/.env.example` to `client/.env` when needed:

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | Production only | Backend base URL (local dev uses the Vite `/api` proxy) |

> Without AI keys the assistant runs fully on the local safety engine — every feature still works.

---

## API reference

Base URL: `/api` (dev) or `$VITE_API_URL` (production).

| Method & path | Description |
|---|---|
| `GET /api/health` | Service status |
| `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me` | Auth (JWT) |
| `GET /api/risk/:location` | Risk score, hazards, staging, contacts |
| `GET /api/weather?location=` · `GET /api/aqi?location=` | Live telemetry |
| `GET /api/alerts` | Active bulletins (filterable) |
| `POST /api/emergency-reports` · `GET /api/incidents` · `PATCH /api/incidents/:id/...` | Triage pipeline |
| `GET /api/resources/shelters` · `GET /api/resources/hospitals` | Facilities |
| `POST /api/ai/chat` (`{messages, location?, coords?, language?}`) | Orchestrated assistant |
| `GET /api/ai/status` · `POST /api/ai/transcribe` | Capability status, STT contract |
| `GET /api/languages` · `POST /api/language/detect` · `POST /api/language/translate` | Language service |
| `POST /api/speech/synthesize` | Server TTS contract (501 until configured) |
| `GET /api/dashboards/:scope` | District / health / state / volunteer aggregates |

---

## Demo accounts

Password for all demo accounts: `Password123!`

| Role | Email | Lands on |
|---|---|---|
| Citizen | `citizen@demo.com` | `/`, `/risk/Mumbai` |
| District Officer | `district@demo.com` | `/dashboard/district` |
| Field Responder | `responder@demo.com` | `/dashboard/responder` |
| Health Officer | `health@demo.com` | `/dashboard/health` |
| State EOC | `state@demo.com` | `/dashboard/state` |
| Community Volunteer | `volunteer@demo.com` | `/dashboard/volunteer` |

A demo switcher bar in the header swaps roles in one click.

---

## Evaluation walkthrough

Under 3 minutes, end to end:

1. Open `http://localhost:3000`, switch the header language to Marathi — the UI follows.
2. Enter `Mumbai`, hit **Check Risk** — gauge, rainfall, staging, map.
3. Open **AI Assistant**, ask about flooding (or tap the mic and speak) — localized reply with sources.
4. Press **Listen** to hear it; switch to Hindi mid-session and continue with the same context.
5. **Report Emergency** → switch to District Officer → dispatch a responder → switch to Field Responder → accept, file SitRep, resolve.
6. Inspect Health (`/dashboard/health`) and State EOC (`/dashboard/state`) aggregates.

---

## Deployment

**Frontend → Vercel (ready now)**

This repo ships a root `vercel.json` (Vite build from `client/`, output `client/dist`).

1. Import `vinayak1497/JeevanGrid` in Vercel.
2. Keep the defaults from `vercel.json` (no extra configuration needed).
3. Add environment variable `VITE_API_URL=https://<your-backend>/api`.
4. Deploy. Every push to `main` redeploys automatically.

**Backend → Render / Railway / Fly (recommended)**

The Express API runs anywhere Node 18+ runs:

```bash
# on the host
npm install --prefix server
npx prisma generate --schema server/prisma/schema.prisma
npm run build --prefix server
# start: node server/dist/index.js
```

Set all required env vars on the host (see table above), use a managed Postgres by
changing `provider` + `DATABASE_URL` if you outgrow SQLite, then point the Vercel
`VITE_API_URL` at it. For a Vercel-only footprint, the API can later be split into
serverless functions — the route/controller/service separation already supports that.

---

## Security notes

- `server/.env` (real keys) and `*.db` files are git-ignored and **never committed**. Only `.env.example` templates ship.
- All AI/language provider secrets stay server-side; the browser only ever sees `VITE_API_URL`.
- Audio uploads, language codes, message lengths, and coordinates are validated; translation/speech failures degrade to safe fallbacks, never stack traces.
- The AI never claims to dispatch rescue teams and never rewrites official warnings.

---

## Project status

**Working today:** full citizen loop (forecast → alerts → report → triage → resolve), 5-language UI + AI + voice, role dashboards, live weather/AQI/quake feeds, honest provider fallbacks.

**Configured interface / awaiting credentials:** IndicTrans2 + Bhashini adapters, server STT/TTS providers.

**Roadmap:** per-user language preference sync, RTL-ready layout pass, Postgres migration guide, Vercel serverless split, Bhashini STT/TTS wiring, E2E language-matrix tests.

---

## Data attribution

JeevanGrid complements — never replaces — official authorities: NDMA, IMD, CWC, State EOCs/SEOCs.
Live telemetry: Open-Meteo, USGS Earthquake Hazards Program, OpenStreetMap/Overpass, CPCB-aligned AQI.
During active red alerts, always follow directives from local state authorities first.

---

## License

MIT — see [LICENSE](LICENSE) for details. Built for public safety.
