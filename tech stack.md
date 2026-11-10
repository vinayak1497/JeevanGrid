# JeevanGrid — Complete Tech Stack Audit

Source-verified from `package.json`, `server/.env.example`, `prisma/schema.prisma`, `server/src/*`, `client/src/*`, `vite/tailwind/vercel` configs.

## 1. Hosting / Infra / DevOps

| Tech | Why this only |
|---|---|
| **GitHub (`vinayak1497/JeevanGrid`, branch `main`)** | Single source of truth; Vercel + Render both auto-deploy from `main`. No other remote — avoids deploy drift. |
| **Vercel — frontend (`client/`, Root Directory=`client`)** | Native Vite SPA hosting with `client/vercel.json` `/(.*) → /index.html` rewrites. Chosen over Netlify because zero-config Vite detection + preview per push. |
| **Render — backend (`server/`, Node 18+/22)** | Long-lived container needed for in-process `startAlertScheduler()` (10-min SACHET poll). Chosen over serverless because cron-less ingestion + WebSocket-ready + `/api/health` health checks. Build: `npm install && npx prisma generate && npm run build`, Start: `node dist/index.js`, plus `prisma migrate deploy` per release. |
| **Neon PostgreSQL (`provider="postgresql"`, `DATABASE_URL`)** | Serverless Postgres with `sslmode=require`; survives Render restarts unlike SQLite. Chosen over Supabase/PlanetScale for Prisma-first branching + free-tier PostGIS-ready growth. |
| **Prisma ORM 5.22 + Prisma Client + Migrations** | One schema → types + SQL + 4 tracked migrations (`init`, `alert_provenance`, `subscriptions_push`, `health_assessments`). Chosen over raw SQL/Drizzle for end-to-end type safety + forward-only `migrate deploy` on Render. |
| **npm monorepo + `concurrently`** | Root `install:all / dev / build / seed` fans out to `server/` + `client/`. Chosen over Turborepo/Nx — zero overhead for a 2-package repo. |
| **`.env.example` only (real `.env` git-ignored)** | `server/.env`, `client/.env`, `*.db`, `dist/` never committed. Secrets stay on Render dashboard; browser only sees `VITE_API_URL` + VAPID public key. |

## 2. Frontend Core — `client/`

| Tech | Why this only |
|---|---|
| **React 18.3 + React-DOM + TypeScript 5.7** | Concurrent UI + strict types for dashboards/maps/AI chat. Chosen over Vue/Svelte for ecosystem (Leaflet/Recharts bindings) + evaluator familiarity. |
| **Vite 6 + `@vitejs/plugin-react` (`tsc && vite build`)** | Sub-second HMR on `:3000`, `/api → :5000` proxy in dev, `dist/` on Vercel. Chosen over CRA/Next.js — no SSR needed, keeps bundle static + CSP-simple. |
| **React Router 6.28 (SPA)** | `/`, `/risk/:loc`, `/alerts`, `/assistant`, `/dashboards/*`, auth pages. Chosen over TanStack Router — stable, works with Vercel SPA rewrites. |
| **Tailwind 3.4 + PostCSS + Autoprefixer + `clsx` + `tailwind-merge`** | Utility styling with custom `surface/primary/tertiary` government-calm tokens + Inter/Plus Jakarta fonts. Chosen over MUI/Bootstrap to keep emergency UI calm, lightweight, fully themeable. |
| **Framer Motion 11 + Lucide-React** | Accessible page transitions + crisp iconography (no emoji/flags). Chosen over CSS-only — physics-based motion with reduced-motion respect. |
| **Leaflet 1.9 + React-Leaflet 4 + OpenStreetMap tiles** | Offline-friendly disaster maps, CAP polygon vs district-marker rendering, `MapLayerControl`. Chosen over Mapbox/Google — free, no API key, sovereign-data friendly. |
| **Recharts 2.15** | Rainfall, risk-gauge, health-indicator charts. Chosen over D3/Chart.js — React-native declarative charts, smallest learning curve. |
| **Typed `apiFetch` (`VITE_API_URL` + JWT + `Accept-Language`)** | One wrapper adds token + language header + error shaping. Local dev uses relative `/api`; Vercel sets `VITE_API_URL=https://<render>/api`. Avoids axios — native fetch is enough. |

## 3. Backend Core — `server/`

| Tech | Why this only |
|---|---|
| **Node.js 18+ (22 rec.) + Express 4.21 + TypeScript + `tsx watch`** | Single-language full-stack, fast cold start on Render. Chosen over Fastify/Nest — minimal boilerplate, route/controller/service split already serverless-portable. |
| **`dotenv` + `cors(*)` + `express.json()`** | Env-driven config + open citizen read APIs. `*` CORS is intentional — official warnings are public; writes stay JWT-gated. |
| **`zod` validation** | Coordinates, language codes, message lengths, audio uploads validated at controller edge. Chosen over Joi/Yup — TS-inferred schemas, zero decorators. |
| **`jsonwebtoken` + `bcryptjs` + role middleware** | JWT auth with 6 roles (Citizen, District/Health/State-EOC, Responder, Volunteer). Chosen over Passport/Auth0 — self-hosted, demo-switcher compatible, no external dependency. |
| **`web-push` (VAPID)** | Official-warning push relay (`VAPID_PUBLIC/PRIVATE/SUBJECT`). Chosen over FCM/APNs — browser-native, no vendor lock-in; app works with keys absent. |

## 4. Data Layer — 17 Prisma Models

`User, DisasterAlert (+AlertSourceState, AlertFeedCache, AlertAuditLog), AlertSubscription, PushSubscription, AlertNotificationLog, EmergencyReport, Incident, FieldReport, Hospital, Shelter, Resource, SafetyGuide, WeatherSnapshot, HealthAssessment` — district-level targeting only, precise user locations never stored. Seed (`tsx prisma/seed.ts`) creates demo users (`Password123!`), hospitals/shelters, clearly-flagged `isDemoData` alerts rejected from official APIs in production (`ENABLE_DEMO_ALERTS=false` enforced backend-side).

## 5. AI Stack

| Tech | Why this only |
|---|---|
| **Nugen aligned inference (`NUGEN_API_KEY/ENDPOINT`, `NUGEN_HEALTH_MODEL=nugen-healthcare-india`)** | Primary LLM — India-aligned safety tuning. Chosen over OpenAI for data-residency + disaster-domain alignment. |
| **DeepSeek (`DEEPSEEK_API_KEY`, legacy `Deepseek` fallback)** | Ordered fallback when Nugen unreachable. Chosen as cheap second brain — never primary, keeps assistant alive offline-budget. |
| **Local NDMA-aligned engine + `aiOrchestrator` (intent → tools → LLM → validation)** | Deterministic safety layer reasons over verified JeevanGrid context only; surfaces **Call 112** first, never invents warnings/beds/dispatches. Guarantees usefulness with zero keys. |
| **`nugenHealthService` + `ClimateHealthRiskEngine`** | Vector/heat (Rothfusz physics)/respiratory/waterborne 0-100 scores + additive Nugen interpretation that can never override math; `INSUFFICIENT_DATA` instead of fabrication; scenario presets `rain25/rain50/heat2/aqi50` never persisted. |

## 6. Multilingual System (EN/HI/MR/GU/AS)

| Tech | Why this only |
|---|---|
| **Static UI bundles (`i18n/dictionaries.ts` + `LanguageContext`, `localStorage:jeevangrid.language`)** | Zero-latency render, English fallback, no per-render API cost. Chosen over i18next — typed keys (`nav.home`), tiny footprint. |
| **`LanguageService`: IndicTrans2 → Bhashini → safe fallback** | Self-hosted `INDICTRANS_BASE_URL` first (free/private), then `BHASHINI_*` (govt stack), then English-original. Cached, Hinglish-tolerant, never throws — outage degrades, never breaks. |
| **Web Speech API (browser fast-path) + server `speechService`/`STT_PROVIDER` contracts** | `useSpeechRecognition/useSpeechSynthesis` per-language (`en-IN/hi-IN/mr-IN/gu-IN/as-IN`) with transcript review; server returns honest `503/501` until credentialed. Chosen to ship voice today with zero server bill. |

## 7. Live Telemetry APIs (keyless-first)

| API / Data | Why this only |
|---|---|
| **Open-Meteo Forecast + Air-Quality/CAMS (`OPEN_METEO_BASE_URL`, `OPEN_METEO_AQ_BASE_URL`)** | Free, no key, WMO-code mapping + 10/15-min cache. Chosen over OpenWeatherMap (keyed, metered) — keeps citizen risk lookup free at scale. |
| **USGS Earthquake Hazards FDSN (`USGS_EARTHQUAKE_API_URL`)** | Global authoritative quake feed. Chosen because India has no open real-time quake API — USGS is the scientific standard. |
| **Nominatim Geocoding + Overpass API (`OVERPASS_API_URL` + `overpass.kumi` fallbacks)** | City/district/PIN + GPS → lat/lon + live hospitals/shelters POIs. Chosen over Google Places — free OSM stack matches Leaflet tiles. |
| **OpenWeatherMap (legacy fallback in `weatherService`)** | Only used if `WEATHER_API_KEY` set. Retained for evaluator environments where Open-Meteo blocked. |

## 8. Official Government Warning Sources (fail-closed)

| Source | Why this only |
|---|---|
| **NDMA SACHET CAP RSS + CAP XML (`SACHET_FEED_URL`, ETag/`If-None-Match`, 10-min scheduler)** | Only live keyless official all-hazard feed for India. Full pipeline: fetch → parse → validate → normalize → dedup (`[source,sourceAlertId]`) → reconcile Alert/Update/Cancel → expiry sweep → `/api/alerts/official*` → map + subscriptions + EOC staging + `AlertAuditLog`. |
| **IMD (`IMD_API_BASE_URL/KEY`) / CWC (`CWC_API_KEY`) / INCOIS (`INCOIS_API_KEY`) adapters** | Credentialed district warnings / flood / tsunami. Implemented fail-closed — without keys they report `CONFIGURATION_REQUIRED` and yield zero warnings, never synthesized. Respects authority + prevents hallucinated red alerts. |
| **Bulletin links (`SACHET_BASE_URL`, `INCOIS_BASE_URL`)** | Link-out, never scrape. Preserves provenance (authority, sourceAlertId, issue/expiry, original URL). |

## 9. Internal Backend APIs (`/api/*`)

`auth, risk/:location, weather, aqi, earthquakes, alerts (+official/nearby/district/:id/:id/stage/sync/sources), alert-subscriptions, push/*, emergency-reports, incidents, field-reports, resources/shelters/hospitals, facilities, geo (+overlays), advisories, guides, dashboards/:scope, ai/chat|status|transcribe, languages|language/*, speech/synthesize, health-intelligence/assess|scenario, system/health (EOC), health` — reads public, writes/EOC/Health-gated, every official row carries source traceability.

## 10. Static / Reference Data

| Data | Why this only |
|---|---|
| **`Assets/geo/states.json + district.json` (name metadata only)** | District text-matching for targeting; boundaries never invented — CAP polygons render EXACT, LGD codes render as “District-level area”. |
| **`Assets/Hero_Section_Bg/*` + `Sitich/` explorations** | Calm gov-grade hero imagery; early mocks kept out of bundle as reference. |
| **Canonical helplines (112, 1078, 108, 101, 1070, 1077, 1906)** | Single `helplinesService.ts` truth used by AI + EmergencyModal one-tap dialer. Hardcoded because these numbers change by gazette, not API. |
