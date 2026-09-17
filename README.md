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

<p align="center">
  <a href="https://www.youtube.com/watch?v=Q66ZIVpUxCY">
    <img
      src="https://img.shields.io/badge/YouTube-Prototype%20Demo-FF0000?style=for-the-badge&logo=youtube&logoColor=white"
      alt="Watch JeevanGrid Prototype Demo on YouTube"
    />
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
- [Early Warning System](#early-warning-system)
- [Climate-Health Intelligence](#climate-health-intelligence)
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
│  React + Vite│─────▶│  Express + Prisma (PostgreSQL)  │
│  :3000 (dev) │ /api │  :5000 (dev)                    │
└──────────────┘      └─────────────────────────────────┘
        │                        │
        │   LanguageService      │  AI Orchestrator
        │   translate/detect     │  intent → tools → LLM/local
        │                        │  Nugen · DeepSeek · local engine
        ▼                        ▼
  ┌──────────────────────────────────────────────┐
  │  Live data: Open-Meteo · USGS · Overpass/OSM │
  │  Official: SACHET/NDMA CAP feed (ingested) · │
  │  IMD/CWC/INCOIS (fail-closed when unconfigured)│
  └──────────────────────────────────────────────┘
```

> Product claim: **JeevanGrid relays and contextualizes verified warnings from
> authoritative government sources.** It never claims 100% accuracy and never
> generates official warnings.

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
│   │   ├── pages/dashboards/      # District, Responder, Health, StateEOC, Volunteer
│   │   ├── utils/push.ts          # Web-Push subscribe helper (district alerts)
│   │   ├── public/sw.js           # Push service worker (official-warning delivery)
│   │   ├── index.html / vite.config.ts# Port 3000, /api proxy, Indic font loading
│   │   └── .env.example               # VITE_API_URL (production backend URL)
├── server/                        # Backend (Node + Express + TypeScript)
│   ├── prisma/schema.prisma       # PostgreSQL: users, alerts, incidents, facilities…
│   ├── prisma/migrations/         # Tracked Postgres migrations (migrate deploy on release)
│   ├── prisma/seed.ts             # Demo users/facilities + clearly-flagged demo alerts
│   └── src/
│       ├── index.ts               # App bootstrap, CORS, route mounting, /api/health
│       ├── routes/                # auth, risk, weather, aqi, alerts, incidents,
│       │                         # emergency-reports, field-reports, resources, guides,
│       │                         # dashboards, geo, facilities, advisories, ai, language,
│       │                         # subscriptions (alert + push), health-intelligence
│       ├── controllers/           # Request validation + response shaping
│       │                         # (alerts, officialAlerts, subscriptions, systemHealth,
│       │                         # healthIntelligence, dashboards, facilities, geo…)
│       ├── services/              # riskEngine, weather/aqi/quake, geo, facilities,
│       │                         # nugen/deepseek, aiOrchestrator, speechService
│       ├── services/ai/           # nugenHealthService (additive interpretation only)
│       ├── services/health/       # ClimateHealthRiskEngine + healthAssessmentService + tests
│       ├── services/alerts/       # Early-warning pipeline: ingestion, validation,
│       │                         # normalization, dedup, expiry, scheduler, sources,
│       │                         # notifications, officialAlertQuery, tests
│       └── services/language/     # LanguageService + providers + aiLocal strings
├── Assets/                        # Source design assets (geo JSON, hero backgrounds)
├── Sitich/                        # Early design explorations (reference only)
├── client/vercel.json             # SPA fallback rewrites (Vercel Root Directory = client/)
├── package.json                   # Monorepo scripts (dev / install:all / build / seed)
└── README.md
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Leaflet + OpenStreetMap, Recharts |
| Backend | Node.js, Express, TypeScript, Prisma ORM, JWT, bcryptjs, web-push |
| Database | PostgreSQL (Neon managed; `provider = "postgresql"` in `schema.prisma`) |
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
# and DATABASE_URL to your Postgres connection (Neon in production)

# 4. Apply migrations + seed demo data (alerts, hospitals, shelters, users)
npx prisma migrate deploy --schema server/prisma/schema.prisma
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
| `DATABASE_URL` | Yes | Prisma Postgres connection, e.g. `postgresql://user:password@host:5432/neondb?sslmode=require` (Neon in production) |
| `JWT_SECRET` | **Yes** | Long random secret for auth tokens |
| `DEMO_MODE` | No | `true` enables demo role switching |
| `NUGEN_API_KEY` / `NUGEN_ENDPOINT` | No | Nugen aligned inference (primary AI) |
| `NUGEN_HEALTH_MODEL` | No (default `nugen-healthcare-india`) | Healthcare-domain model for Climate-Health interpretation (falls back safely, never required) |
| `DEEPSEEK_API_KEY` | No | DeepSeek fallback (also reads legacy `Deepseek`) |
| `OPEN_METEO_BASE_URL` | No | Weather provider base URL |
| `AIR_QUALITY_API_KEY` | No | Air-quality provider key |
| `USGS_EARTHQUAKE_API_URL` | No | Earthquake feed |
| `OVERPASS_API_URL` | No | Live facility POIs |
| `SACHET_BASE_URL` / `INCOIS_BASE_URL` | No | Official bulletin links |
| `SACHET_ENABLED` / `SACHET_FEED_URL` / `SACHET_POLL_MINUTES` | No (defaults: on / official RSS / 10) | SACHET CAP ingestion tuning |
| `IMD_ENABLED` / `IMD_API_BASE_URL` / `IMD_API_KEY` | No | Credentialed IMD warnings (fail-closed without) |
| `CWC_ENABLED` / `CWC_API_KEY` / `INCOIS_ENABLED` / `INCOIS_API_KEY` | No | CWC / INCOIS sources (fail-closed without) |
| `ENABLE_DEMO_ALERTS` | **Yes — `false` in production** | Backend-enforced demo exclusion from official APIs |
| `INDICTRANS_BASE_URL` | No | Self-hosted IndicTrans2 endpoint (else skipped) |
| `BHASHINI_API_KEY` / `BHASHINI_BASE_URL` | No | Bhashini translation (else skipped) |
| `STT_PROVIDER` | No | Server speech-to-text provider id |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | No | Web-Push delivery (`npx web-push generate-vapid-keys`); app works without |

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
| `GET /api/alerts` | Legacy bulletins (demo-gated, expiry-enforced) |
| `GET /api/alerts/official?state=&district=&hazardType=&severity=` | Verified official warnings (fail-closed) |
| `GET /api/alerts/official/nearby?lat=&lon=&radiusKm=` | Location-aware official warnings |
| `GET /api/alerts/official/district/:district` | District-targeted official warnings |
| `GET /api/alerts/official/:id` | Single verified warning (gated) |
| `POST /api/alerts/official/:id/stage` (EOC) | Stage district response → internal Incident + audit |
| `POST /api/alerts/sync` (EOC) | Manual ingestion trigger (worker polls regardless) |
| `GET /api/alerts/sources` | Source health (no-warnings vs unavailable) |
| `GET /api/alerts/system/health` (EOC) | Pipeline ops view: sync, ETag, counts, audit |
| `GET/POST /api/alert-subscriptions` · `DELETE /api/alert-subscriptions/:id` | District warning subscriptions (auth) |
| `GET /api/push/vapid-public-key` · `POST/DELETE /api/push-subscriptions` | Web-Push endpoints (auth for write) |
| `POST /api/emergency-reports` · `GET /api/incidents` · `PATCH /api/incidents/:id/...` | Triage pipeline |
| `GET /api/resources/shelters` · `GET /api/resources/hospitals` | Facilities |
| `POST /api/ai/chat` (`{messages, location?, coords?, language?}`) | Orchestrated assistant |
| `GET /api/ai/status` · `POST /api/ai/transcribe` | Capability status, STT contract |
| `GET /api/health-intelligence/assess?location=&nugen=` (Health/District/EOC) | Live Climate-Health assessment: deterministic indicators + additive Nugen interpretation |
| `POST /api/health-intelligence/scenario` (Health/District/EOC) | Preparedness simulator (`rain25/rain50/heat2/aqi50`); always labeled scenario, never persisted |
| `GET /api/languages` · `POST /api/language/detect` · `POST /api/language/translate` | Language service |
| `POST /api/speech/synthesize` | Server TTS contract (501 until configured) |
| `GET /api/dashboards/:scope` | District / health / state / volunteer aggregates |

---

## Early Warning System

JeevanGrid does not generate or alter official warnings. It ingests authoritative
warning data, preserves source provenance, verifies freshness, maps affected areas,
and provides a citizen/EOC delivery layer.

```text
SACHET CAP RSS (+ CAP XML detail)
  → fetchSachetFeed (ETag / If-None-Match, 304 = no reprocess)
  → parse (RSS items + CAP XML) → validate (identifier, issue time, provenance)
  → normalize (severity/event/area mapping, centroid, state hints)
  → deduplicate (stable sourceAlertId) → reconcile (Alert/Update/Cancel)
  → PostgreSQL (DisasterAlert, unique [source, sourceAlertId])
  → expire sweep + freshness windows (LIVE vs STALE)
  → /api/alerts/official (+ nearby / district / :id)
  → Alerts UI (map markers, filters, provenance drawer)
  → district subscriptions + Web-Push relay
  → EOC staging (Incident + STAGED audit entry)
```

- **Sources:** NDMA SACHET CAP/RSS (live, keyless). IMD / CWC / INCOIS adapters are
  fail-closed: without credentials they report `CONFIGURATION_REQUIRED` and yield
  zero warnings — nothing is synthesized.
- **Polling:** in-process scheduler (`alertScheduler`, default every 10 min via
  `SACHET_POLL_MINUTES`, min 5) + hourly expiry sweep + `POST /api/alerts/sync`
  (EOC roles). ETag caching means unchanged feeds cost one cheap 304.
- **Lifecycle:** ACTIVE → UPDATED (same `sourceAlertId`, no duplicates) →
  CANCELLED / EXPIRED. Every transition writes `AlertAuditLog`.
- **Geography:** CAP polygons render as source geometry (`geometryPrecision:
  EXACT`); district/LGD-style identifiers render as **District-level area**
  markers — boundaries are never invented. `Assets/geo` ships name metadata only.
- **Targeting:** `/official/nearby` combines centroid proximity with
  reverse-geocoded district/state text matching; `/official/district/:district`
  serves subscriptions and dashboards.
- **Notifications:** district-level `AlertSubscription` + Web-Push endpoints
  (`PushSubscription`). NEW/UPDATED warnings fan out exactly once per
  alert × endpoint × action (`AlertNotificationLog`). Every push states
  JeevanGrid is **relaying** an official warning. Without VAPID keys the app
  functions normally.
- **Fail-closed UX:** source outages show “Official alert source temporarily
  unavailable”; stale rows are withheld from LIVE lists and counted separately.
- **Separation:** Official Warnings / JeevanGrid Risk Intelligence / Community
  Reports are never mixed in the UI or the API.
- **Limitations:** district identifiers depend on source text quality; SACHET
  rows without area detail resolve to state or “District-level area”; earthquake
  feeds are observed events, never predictions.

---

## Climate-Health Intelligence

Environmental health-risk indicators for Health Officers — **not diagnoses, not
forecasts, not official warnings.** Deterministic calculations always run; the
Nugen healthcare model only adds interpretation and can never override scores.

```text
geoService → Open-Meteo weather/AQI + 72h rain → riskEngine flood staging
  → ClimateHealthRiskEngine (vector / heat / respiratory / waterborne, 0-100)
  → Nugen interpretation (additive, labeled, fail-safe)
  → HealthAssessment row (PostgreSQL) + 15-min cache
  → /api/health-intelligence/assess → Health dashboard cards
```

- **Indicators:** vector-borne, heat stress (Rothfusz heat-index physics),
  respiratory (AQI/PM), waterborne (rainfall + flood stage). Missing inputs yield
  `INSUFFICIENT_DATA` — never a fabricated score.
- **Vulnerability context:** nearby hospitals/beds from the facility registry.
  Demographics are reported as unavailable, never estimated. No personal health
  data is collected or stored.
- **Scenario simulator:** `POST /api/health-intelligence/scenario` with presets
  `rain25 | rain50 | heat2 | aqi50`. Responses are always labeled `scenario: true`
  and are never persisted.
- **Access:** `HEALTH_OFFICER`, `DISTRICT_OFFICER`, `STATE_EOC` only.
- **Config:** optional `NUGEN_HEALTH_MODEL` (default `nugen-healthcare-india`);
  without keys or on provider failure the deterministic assessment is returned
  with a clearly-labeled unavailable interpretation.

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
7. **Early warnings:** open **Alerts** → source-health panel → an alert card →
   Source alert ID + issue/expiry times → **View Original Bulletin** → map marker →
   district chip filter → **Notify me** (subscribe) → sign in as District Officer →
   **Stage for District Response** → see the incident in `/dashboard/district`.

---

## Deployment

**Frontend → Vercel**

The frontend lives in `client/` (Vite + React). SPA fallback rewrites ship in
`client/vercel.json`.

1. Import `vinayak1497/JeevanGrid` in Vercel.
2. Set **Root Directory = `client`** (required — this is a monorepo).
3. Keep the detected Vite defaults: Build Command `npm run build`
   (`tsc && vite build`), Output Directory `dist`.
4. Add environment variable `VITE_API_URL=https://<your-backend>/api`.
5. Deploy. Every push to `main` redeploys automatically.

Do not add a root `vercel.json` — Vercel must build from `client/` so the
`dist` output and `/index.html` SPA rewrites resolve correctly. Local dev needs
no env file (Vite proxies `/api` → `http://localhost:5000`).

**Backend → Render (recommended)**

The Express API lives in `server/` (Node 18+, TypeScript, Prisma + PostgreSQL).
The alert ingestion worker runs in-process (`startAlertScheduler`), so one
always-on instance is enough — no extra cron.

Render settings (Root Directory = `server/`):

- Build Command:
  `npm install && npx prisma generate && npm run build`
- Start Command: `node dist/index.js`
- Health Check Path: `/api/health`
- On each release, run once:
  `npx prisma migrate deploy --schema prisma/schema.prisma`
  (never reset production data; new migrations in
  `server/prisma/migrations/` apply forward-only).

Set all required env vars on the host (see table above), at minimum
`DATABASE_URL` (Neon Postgres), `JWT_SECRET` (long random string), and
`ENABLE_DEMO_ALERTS=false` in production. Without AI/VAPID keys the app still
runs (local safety engine + stored subscriptions; push delivery resumes once
VAPID keys are set via `npx web-push generate-vapid-keys`). Then point the
Vercel `VITE_API_URL` at the Render URL (`https://<service>.onrender.com/api`).
On serverless hosts, call `POST /api/alerts/sync` (EOC) or keep one always-on
instance for the scheduler. For a Vercel-only footprint, the API can later be
split into serverless functions — the route/controller/service separation
already supports that.

---

## Security notes

- `server/.env` (real keys) and `*.db` files are git-ignored and **never committed**. Only `.env.example` templates ship.
- All AI/language provider secrets, VAPID private keys and database credentials stay server-side; the browser only ever sees `VITE_API_URL` (the VAPID *public* key is served intentionally via `/api/push/vapid-public-key`).
- Manual ingestion (`POST /api/alerts/sync`), system health and alert staging require EOC roles; health-intelligence assess/scenario require Health/District/EOC roles; official reads stay public.
- Audio uploads, language codes, message lengths, and coordinates are validated; translation/speech failures degrade to safe fallbacks, never stack traces.
- The AI never claims to dispatch rescue teams and never rewrites official warnings.

---

## Project status

**Working today:** full citizen loop (forecast → alerts → report → triage → resolve), 5-language UI + AI + voice, role dashboards, live weather/AQI/quake feeds, honest provider fallbacks, end-to-end early-warning pipeline (SACHET ingestion → verification → map → district targeting → push relay → EOC staging → audit), Climate-Health Intelligence (deterministic vector/heat/respiratory/waterborne indicators + additive Nugen interpretation + scenario simulator, Health-Officer gated).

**Configured interface / awaiting credentials:** IndicTrans2 + Bhashini adapters, server STT/TTS providers, credentialed IMD/CWC/INCOIS warning APIs (fail-closed until keyed).

**Roadmap:** per-user language preference sync, RTL-ready layout pass, Vercel serverless split, Bhashini STT/TTS wiring, E2E language-matrix tests.

---

## Data attribution

JeevanGrid complements — never replaces — official authorities: NDMA, IMD, CWC, State EOCs/SEOCs.
Official warnings: NDMA SACHET CAP/RSS feed (`https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml`),
relayed with full provenance (issuing authority, source alert ID, original bulletin link, issue/expiry times).
Live telemetry: Open-Meteo, USGS Earthquake Hazards Program, OpenStreetMap/Overpass/Nominatim, CPCB-aligned AQI.
During active red alerts, always follow directives from local state authorities first.

---

## License

MIT — see [LICENSE](LICENSE) for details. Built for public safety.
