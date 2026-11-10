# JeevanGrid — System Architecture

> Citizen-first disaster resilience and emergency operations platform for India.
> `client/` (React + Vite, Vercel) ↔ `server/` (Express + Prisma + PostgreSQL, Render) ↔ live government + telemetry feeds.

## 0. Big picture

```text
                    ┌──────────────── CLIENT (Vercel) ────────────────┐
                    │ React 18 + Vite + TS + Tailwind + Leaflet       │
                    │ Pages: Landing / Risk / Alerts / Assistant /    │
                    │  Report / Resources / Guides / 5 Dashboards     │
                    │ AuthContext (JWT) · LanguageContext (5 langs)   │
                    │ apiFetch: VITE_API_URL + Bearer + Accept-Language│
                    └───────────────┬─────────────────┬───────────────┘
                                    │ HTTPS /api      │ Web Push (sw.js)
                    ┌───────────────▼─────────────────▼───────────────┐
                    │              SERVER (Render, :5000)              │
                    │ Express · JWT auth · Zod validation · CORS      │
                    │ Routes → Controllers → Services → Prisma        │
                    │ riskEngine · alerts pipeline · health engine    │
                    │ aiOrchestrator (Nugen→DeepSeek→local)           │
                    │ LanguageService · geo/weather/aqi/quake         │
                    │ alertScheduler (in-process, 10-min poll)        │
                    └───────┬─────────────────────────┬───────────────┘
                            │ Prisma Client           │ fetch (ETag, timeouts)
              ┌─────────────▼───────────┐   ┌─────────▼────────────────────────┐
              │ Neon PostgreSQL         │   │ External world                   │
              │ 17 models (users,       │   │ SACHET CAP RSS (official)        │
              │ alerts+provenance,      │   │ IMD/CWC/INCOIS (fail-closed)     │
              │ incidents, facilities,  │   │ Open-Meteo · USGS · Nominatim    │
              │ health assessments…)    │   │ Overpass · Nugen · DeepSeek      │
              └─────────────────────────┘   │ Bhashini / IndicTrans2 (optional)│
                                            └──────────────────────────────────┘
```

Design principles that hold everything together:

1. **Verified data only.** The backend relays government warnings and live telemetry; it never invents warnings, beds, or dispatches.
2. **Fail-closed + graceful degradation.** Missing keys/credentials yield `CONFIGURATION_REQUIRED` / `INSUFFICIENT_DATA` / local-engine answers — never fabricated data, never a crash.
3. **Provenance everywhere.** Every official alert keeps authority, sourceAlertId, original URL, issue/expiry times; every AI/health answer labels its provider and sources.
4. **District granularity for privacy.** Subscriptions, targeting, and dashboards use district/state — precise user locations are never stored.

## 1. Types of users (6 roles, one auth system)

Auth: JWT (`Authorization: Bearer`), `bcryptjs` passwords, `authenticateToken` + `requireRole()` middleware (`server/src/middleware/authMiddleware.ts`). Frontend `AuthContext.tsx` stores `jeevangrid_token`, loads `/auth/me` on boot, supports one-click demo login (`citizen/district/responder/health/state/volunteer@demo.com` / `Password123!`).

| Role | Frontend lands on | What they can do | Key backend gates |
|---|---|---|---|
| **Citizen** (default, self-register) | `/`, `/risk/:location`, `/alerts`, `/assistant`, `/report-emergency`, `/resources`, `/guides` | Check risk, read official alerts, subscribe for district push, report emergency, chat with AI assistant (voice in/out), read guides | Public reads; `POST /emergency-reports`, `POST /alert-subscriptions` (auth) |
| **District Officer** | `/dashboard/district` | Triage queue, dispatch responders, stage official alerts into Incidents, view district aggregates | `PATCH /incidents/:id/...`, `POST /alerts/official/:id/stage`, `GET /alerts/system/health` |
| **Field Responder** | `/dashboard/responder` | Accept assigned incidents, file SitReps (`FieldReport`), mark in-progress/resolved | `POST /field-reports`, assigned-incident scope |
| **Health Officer** | `/dashboard/health` | Climate→Health assessments, scenario simulator (`rain25/rain50/heat2/aqi50`), hospital surge view | `GET /health-intelligence/assess`, `POST /health-intelligence/scenario` |
| **State EOC** | `/dashboard/state` | Cross-district aggregates, manual ingestion trigger, pipeline ops view | `POST /alerts/sync`, `GET /alerts/system/health` |
| **Community Volunteer** | `/dashboard/volunteer` | Volunteer-scoped tasks/aggregates | Dashboard scope filter |

## 2. Frontend — `client/` (Vercel, Root Directory = `client`)

- **Shell:** `App.tsx` → `BrowserRouter` + `LanguageProvider` + `AuthProvider` + `Header` (nav + language dropdown + demo role switcher) + `Routes` + `Footer` + global `EmergencyModal` (one-tap 112/1078/108/101 dialer).
- **Citizen pages:** `LandingPage` (hero + city/GPS lookup) → `RiskDashboardPage` (gauge, rainfall, staging, Leaflet map) → `AlertsPage` (official list, severity/district filters, provenance drawer, map markers, Notify-me subscribe, EOC Stage button) → `EmergencyReportPage` (GPS + `JG-2026-XXXXX` tracking ID) → `AssistantPage` (chat, suggested questions, tool-activity transparency, mic/Listen voice) → `ResourcesPage` (shelters/hospitals) → `GuidesPage`/`GuideDetailPage`.
- **Dashboards:** `District / Responder / Health / StateEoc / Volunteer` — each calls `GET /dashboards/:scope` + its domain APIs; Health additionally calls health-intelligence assess/scenario and renders vector/heat/respiratory/waterborne cards.
- **Shared pieces:** `api/client.ts` (`apiFetch` adds JWT + `Accept-Language`, picks `VITE_API_URL/api` in prod else Vite `/api` proxy → `:5000`), `i18n/` (en/hi/mr/gu/as static dictionaries, `localStorage: jeevangrid.language`, no per-render API), `components/ai/` (i18n strings, `useSpeechRecognition`/`useSpeechSynthesis` via Web Speech API, structured messages), `LeafletMap`/`MapLayerControl`, `utils/push.ts` + `public/sw.js` (district subscription → permission → VAPID push subscribe).
- **Build:** `tsc && vite build` → `client/dist`; `client/vercel.json` provides SPA `/(.*) → /index.html` rewrites. Local dev needs no env file; Vercel sets `VITE_API_URL=https://<render-host>/api`.

## 3. Backend — `server/` (Render, Root Directory = `server`)

`server/src/index.ts` boots Express (`cors(*)`, `express.json()`), mounts 20 route groups, starts `startAlertScheduler()`, exposes `GET /api/health`.

| Mount | Purpose | Representative calls |
|---|---|---|
| `/api/auth` | register/login/me + demo roles | `POST /login`, `GET /me` |
| `/api/risk` | deterministic risk analysis | `GET /:location` |
| `/api/weather`, `/api/aqi`, `/api/earthquakes` | live telemetry passthrough + cache | `GET ?location=` |
| `/api/alerts` | legacy bulletins + official pipeline + EOC ops | `GET /`, `GET /official…`, `POST /official/:id/stage`, `POST /sync`, `GET /sources` |
| `/api/alert-subscriptions`, `/api/push/*` | district subs + Web Push endpoints | `POST /alert-subscriptions`, `POST /push-subscriptions` |
| `/api/emergency-reports`, `/api/incidents`, `/api/field-reports` | citizen report → triage → dispatch → SitRep → resolve | `POST /emergency-reports`, `PATCH /incidents/:id/assign` |
| `/api/resources`, `/api/facilities`, `/api/geo`, `/api/advisories`, `/api/guides` | shelters/hospitals, geocode/reverse-geocode/overlays, bulletin links, safety guides | `GET /resources/shelters` |
| `/api/dashboards/:scope` | role aggregates | `GET /district`, `/health`, `/state` |
| `/api/ai` | orchestrated chat, legacy chat, status, STT contract, tool log | `POST /chat {messages, location, coords, language}` |
| `/api/health-intelligence` | climate→health assess + scenario (gated) | `GET /assess?location=&nugen=`, `POST /scenario` |
| `/api` (language) | detect/translate/list (dynamic content only) | `POST /language/translate` |

Controllers validate with Zod (message/coordinate/language/audio limits) and shape responses; services do the work; `utils/prisma.ts` is the single DB client.

### Core services and how they interact

- **geoService:** deterministic gazetteer (city aliases, state coords) + live Nominatim (`resolveLocationLive`) → canonical `{city, district, state, lat, lng, zoom, granularity}`. Every location-dependent flow (risk, weather, health, nearby alerts) starts here.
- **openMeteoService / aqiService / usgsService / weatherService / overpassService / geoOverlaysService:** keyless-first live data with timeouts + 10–15 min caches + multi-endpoint fallbacks (Overpass tries configured → kumi → de). Failures return `null` → callers degrade, never throw.
- **riskEngineService:** `geo → weather + AQI + quakes + hospitals/shelters` → `dataNormalization.computeRiskScore` (state baseline + seismic zone + flood-prone + live rain/AQI) → `{riskScore 0–100, overallRiskLevel, floodRiskStage, activeHazards, whatToDo/whatNotToDo, nearest facilities, disclaimer}`. Powers Risk pages, AI context, and health flood input.
- **Alerts pipeline (`services/alerts/`):** `alertScheduler` (10-min SACHET poll + hourly expiry, in-process so Render needs no cron) → `alertIngestionService.syncAllSources` → per-source fetchers (`sachetSource` with ETag/`If-None-Match`/304 + CAP XML detail; `imd/cwc/incois` fail-closed without keys) → `alertValidationService` (identifier/issue-time/provenance required) → `alertNormalizationService` (severity/event/area/centroid/state hints, DISTRICT vs EXACT precision) → `alertDeduplicationService` (stable `[source, sourceAlertId]`) → reconcile Alert/Update/Cancel → Prisma `DisasterAlert` → `alertExpirationService` + freshness windows (LIVE vs STALE) → `officialAlertQuery` (`/official`, `/nearby` centroid+text match, `/district/:district`, `/:id`) → `alertNotificationService` (exactly-once per alert×endpoint×action via `AlertNotificationLog`, relay-only copy) → EOC staging creates internal `Incident` + `AlertAuditLog`. `AlertSourceState` + `AlertFeedCache` + `getAlertSystemHealth` give the ops view.
- **Health intelligence:** `healthAssessmentService` reuses geo + Open-Meteo + riskEngine + hospital registry (no duplication) → `ClimateHealthRiskEngine` (vector/heat/respiratory/waterborne, Rothfusz heat-index, `INSUFFICIENT_DATA` on gaps) → structured evidence → `nugenHealthService` additive interpretation (strict JSON schema, model cascade, 25s timeout, never throws) → persist `HealthAssessment` + 15-min cache. Scenarios adjust live baselines and are never persisted.
- **AI orchestrator:** `intent → safety/policy → whitelisted tools → context assembly → Nugen → DeepSeek → local NDMA engine → validation → localized structured reply` (`headline, sections, actions, sources, provider label`). Emergency intents bypass LLMs; every tool call is logged; consequential actions are suggested, never executed. `GET /ai/status` honestly reports provider health.
- **LanguageService:** `IndicTrans2 → Bhashini → safe fallback → English original`, hashed cache, Hinglish-tolerant detection; static UI never hits it; `aiLocal.ts` keeps emergency chrome localized with zero providers. Server STT/TTS contracts return `503/501` until credentialed; browser Web Speech API is the fast path.

## 4. Database — Neon PostgreSQL via Prisma

Grouped by lifecycle:

- **Identity/ops:** `User` (6 roles) → `assignedIncidents`, `fieldReports`.
- **Official warnings:** `DisasterAlert` (full CAP provenance + `isVerified/isLive/isDemoData`, unique `[source, sourceAlertId]`) + `AlertSourceState` (per-source health/ETag/counters) + `AlertFeedCache` (304 handling) + `AlertAuditLog` (CREATED/UPDATED/CANCELLED/EXPIRED…).
- **Delivery:** `AlertSubscription` (district-only, unique `[userId, district]`) + `PushSubscription` (VAPID endpoint) + `AlertNotificationLog` (unique `[source, sourceAlertId, endpointHash, action]`).
- **Triage:** `EmergencyReport (JG-IDs)` 1–1 `Incident` 1–N `FieldReport`; `Incident.assignedTo → User`.
- **Capacity/knowledge:** `Hospital` (beds/ICU/oxygen), `Shelter` (capacity/occupancy), `Resource`, `SafetyGuide` (before/during/after, dos/donts, kit), `WeatherSnapshot`.
- **Health:** `HealthAssessment` (inputs snapshot, risk scores JSON, Nugen interpretation JSON, confidence, `isScenario`).

Migrations are tracked (`prisma/migrations/*`) and applied with `prisma migrate deploy` on each Render release — never reset prod data. `prisma/seed.ts` creates demo users/facilities and clearly-flagged demo alerts (rejected from official reads when `ENABLE_DEMO_ALERTS=false`).

## 5. How a single API call travels (all calls follow this)

```text
Component calls apiFetch('/risk/Mumbai')
  → headers: Content-Type + Accept-Language (from localStorage) + Bearer JWT (if logged in)
  → Vite proxy (/api → :5000) locally, or https://<render>/api in prod
  → Express route → authenticateToken? → requireRole? → Zod validation
  → controller → service(s) → [live fetch | Prisma | Nugen] → shaped JSON
  → frontend renders + caches language choice; errors degrade to safe fallback UI
```

## 6. End-to-end flows (why the pieces make sense together)

1. **Risk lookup:** Landing input/GPS → `geo.resolve` → parallel weather/AQI/quakes + facility lookup → `riskEngine` score/staging → Risk page (gauge + map + do/don'ts) + persisted `WeatherSnapshot`. One location resolution feeds every downstream card.
2. **Official warning delivery:** Scheduler ingests SACHET (ETag-cached) → validated/normalized/deduped → Alerts page (filters, provenance drawer, map) → citizen Notify-me creates district sub (+ optional push endpoint) → new/updated alerts fan out exactly once → District/EOC Stages alert → internal Incident appears in triage. Citizens see relayed truth; officers get actionable work items; auditors get logs.
3. **Report → resolve:** Citizen `POST /emergency-reports` (JG-ID) → District triage → dispatch (`PATCH /incidents/:id/assign`) → Responder accepts → files SitReps → resolves; Health/State dashboards aggregate counts/beds/surge live.
4. **AI help:** Assistant sends `{messages, location, coords, language}` → orchestrator gathers live context → Nugen/DeepSeek/local answers with sources + Call-112-first on danger → voice playback in the same language; mid-session language switch keeps context.
5. **Health preparedness:** Health dashboard → `assess` (deterministic scores + Nugen briefing + provenance) → officer runs `scenario` presets to rehearse +25%/+50% rain, +2°C, +50 AQI without polluting stored data.

## 7. External data & AI (keyless-first, fail-closed)

Live: Open-Meteo forecast + AQ/CAMS, USGS FDSN quakes, Nominatim geocode, Overpass POIs/overlays, OSM tiles. Official: SACHET CAP RSS/XML (live, keyless); IMD/CWC/INCOIS credentialed adapters (yield zero warnings until keyed). AI: Nugen disaster + healthcare-India models (primary, server-side keys), DeepSeek fallback, local NDMA engine last resort. Language: IndicTrans2/Bhashini adapters (optional). Nothing critical requires a key to demo.

## 8. Deployment & environments

- **Local:** `npm run install:all` → `cp server/.env.example server/.env` (set `JWT_SECRET`, `DATABASE_URL`) → `prisma migrate deploy` → `npm run seed` → `npm run dev` (`:5000` + `:3000`).
- **Vercel (frontend):** Root `client`, build `npm run build`, output `dist`, env `VITE_API_URL=https://<render>/api`.
- **Render (backend):** Root `server`, build `npm install && npx prisma generate && npm run build`, start `node dist/index.js`, health `/api/health`, `prisma migrate deploy` per release, envs at minimum `DATABASE_URL` (Neon), `JWT_SECRET`, `ENABLE_DEMO_ALERTS=false`. Scheduler runs in-process; serverless hosts would call `POST /alerts/sync` instead. VAPID/AI keys optional — features degrade cleanly without them.

## 9. Why this architecture works

Separation (route/controller/service), single clients (`apiFetch`, `prisma`), shared location truth (`geoService`), cached live data, audited official data, gated AI/health paths, and district-level privacy let a citizen, a responder, and an EOC operator use the same backend without stepping on each other — and let Vercel + Render deploy it without special cases.
