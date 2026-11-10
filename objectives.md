# JeevanGrid — Objectives

> Citizen-first disaster resilience and emergency operations platform for India.
> One verified loop: **forecast → official alert → citizen report → triage → dispatch → resolve** — in 5 languages, with auditability throughout.

## 1. Vision Statement

To bridge the communication gap between Indian citizens and disaster management authorities during geological, meteorological, and hydrological emergencies — by relaying **verified government warnings**, providing **district-level risk intelligence**, enabling **structured emergency response**, and delivering **inclusive multilingual AI assistance** that never hallucinates safety-critical information.

Product principle: **JeevanGrid relays and contextualizes verified warnings from authoritative sources. It never generates official warnings.**

---

## 2. Key Goals

### G1. Deliver verified early warnings to the last mile
- Ingest NDMA SACHET CAP/RSS (live, keyless) with ETag-cached polling (10-min scheduler), validation, normalization, deduplication on `[source, sourceAlertId]`, and expiry sweeps.
- Serve via `GET /api/alerts/official`, `/nearby`, `/district/:district` with full provenance: issuing authority, source alert ID, original bulletin link, issue/expiry times.
- Fail closed: IMD / CWC / INCOIS adapters yield zero warnings without credentials (`CONFIGURATION_REQUIRED`) — never synthesized.
- District-targeted Web-Push relay (exactly-once per alert × endpoint × action) with "relaying official warning" copy.

### G2. Provide actionable district-level risk intelligence
- Deterministic `riskEngine`: state baselines + seismic zones + flood-prone exposure + live Open-Meteo rain + AQI + USGS quakes → 0–100 score, `overallRiskLevel`, `floodRiskStage`, do's/don'ts.
- Lookup by city, district, PIN, or GPS; Leaflet + OpenStreetMap view with CAP-polygon vs district-marker precision flags.
- Clear separation in API and UI: Official Warnings vs JeevanGrid Risk Intelligence vs Community Reports.

### G3. Structure the citizen-to-responder response pipeline
- Citizen `POST /api/emergency-reports` with GPS + tracking ID (`JG-2026-XXXXX`) → District Officer triage queue → dispatch (`PATCH /incidents/:id/assign`) → Field Responder accept → SitReps (`FieldReport`) → resolve.
- EOC staging bridge: `POST /alerts/official/:id/stage` converts a verified warning into an internal Incident + `STAGED` audit entry.
- Role-based dashboards for 6 roles: Citizen, District Officer, Field Responder, Health Officer, State EOC, Community Volunteer — JWT + `requireRole()` gated.

### G4. Ensure inclusive, multilingual, voice-ready access
- Full UI + AI + voice in 5 languages: English, Hindi (हिन्दी), Marathi (मराठी), Gujarati (ગુજરાતી), Assamese (অসমীয়া).
- Static per-language UI bundles (zero render-time API cost) + central `LanguageService` (IndicTrans2 → Bhashini → safe fallback) + offline `aiLocal` emergency strings.
- Voice input (STT with transcript review) + Listen playback (TTS) per-language via Web Speech API; one-tap emergency dialer (112, 1078, 108, 101, 1091); shelter/hospital directories and safety guides.

### G5. Deploy grounded, fail-safe AI assistance
- Agentic pipeline: intent detection → verified JeevanGrid context (whitelisted tools only) → Nugen disaster model (primary, `temperature: 0.2`) → DeepSeek → local NDMA-aligned engine → safety validation → localized response.
- Emergency-first: immediate danger surfaces **Call 112** before anything else; assistant never invents warnings, beds, or dispatches; every answer labeled with provider + tool-activity transparency.
- Climate-Health Intelligence: deterministic vector / heat (Rothfusz physics) / respiratory / waterborne indicators (0–100, `INSUFFICIENT_DATA` on gaps) + additive Nugen healthcare-India interpretation that can never override math + scenario simulator (`rain25/rain50/heat2/aqi50`, never persisted).

### G6. Guarantee auditability, privacy, and trust
- Every warning lifecycle transition (CREATED / UPDATED / CANCELLED / EXPIRED / STAGED) in `AlertAuditLog`; every triage action traceable.
- Privacy by design: district-level subscriptions only; precise user locations never stored; no personal health data collected.
- Honest capability contracts: `/ai/status`, `/alerts/sources`, `/alerts/system/health` — outages show "temporarily unavailable", never stale or fake data.

### G7. Stay deployable and scalable on public-sector budgets
- Keyless-first telemetry (Open-Meteo, USGS, Nominatim, Overpass, OSM tiles, SACHET); ordered AI/translation fallbacks so the app works with zero keys.
- Stateless Express API + Neon PostgreSQL (Prisma, indexed, forward-only migrations) + static Vite frontend on Vercel CDN; poll-once/serve-many ingestion with in-memory TTL caches.
- Path: 3-state demo → pan-India district rows (no rewrite) → IoT (MQTT/AWS IoT Core as new `iotSource`) → offline-first (Workbox + IndexedDB + Background Sync with queued `JG-ID` writes).

---

## 3. Expected Impact

### 3.1 Efficiency
- **Faster warning dissemination:** district push + map + filters replace forwarded screenshots and rumor chains; tap-through to original bulletin cuts verification time from minutes to seconds.
- **Structured triage under load:** `JG-ID` reports → dispatch → SitReps → resolve replaces unstructured phone/WhatsApp chaos; role gates prevent citizens, responders, and officers blocking each other during peak events.
- **Decision-ready health briefings:** health officers get *why it matters / who is exposed / what to do first* + confidence + data gaps instead of raw temperature/AQI tables; scenario presets enable rehearsal without data pollution.
- **Low-latency safety paths:** emergency intents bypass LLMs; weather/AQI/health caches (10–15 min) and ETag `304` handling keep repeated district queries off providers and DB.

### 3.2 Cost Reduction
- **Zero mandatory paid APIs:** core loop runs on free/keyless feeds; Nugen/DeepSeek, IndicTrans2/Bhashini, VAPID keys only make the system smarter — never keep it alive.
- **Free-tier-friendly infra:** Vercel static hosting + single always-on Render instance (in-process scheduler, no cron service) + Neon serverless Postgres; deployable in an afternoon (`install:all → migrate deploy → seed → dev`).
- **Reduced operational overhead:** single backend serves collectors, SEOCs, health departments, and volunteers with separated views; exactly-once push semantics prevent notification-storm costs; one disaster-aligned + one healthcare model replace dozens of per-hazard, per-language rule trees.

### 3.3 Accessibility
- **5-language UI + AI + voice** (EN/HI/MR/GU/AS) with Hinglish-tolerant detection, persisted preference, and mid-session switching — serves rural, low-literacy, and field users, not just English-speaking EOCs.
- **Multiple input modes:** city/district/PIN text, GPS detection, mic input, Listen playback, one-tap dialer, shelter/hospital directories.
- **Graceful degradation:** static UI bundles + offline emergency strings + browser-voice fast path + honest `503/501` server contracts keep safety info available with no providers, low bandwidth, or partial outages.
- **Zero-friction onboarding:** demo accounts + one-click role switching for evaluation and NDRF/collector training; citizen self-registration stays open.

### 3.4 Sustainability & Resilience
- **Institutional memory:** persisted `HealthAssessment` rows build district environmental-health evidence for heat-action plans, monsoon preparedness, and hospital surge planning; audit logs enable post-disaster review and better SOPs.
- **Environmental footprint:** cached reads, edge-served static frontend, and poll-once ingestion minimize compute, bandwidth, and provider calls at scale.
- **Ecosystem foundation:** clean district-keyed data enables parametric insurance pilots, school/hospital safety certification, and CSR-funded shelter capacity programs; IoT-ready and offline-first paths avoid future rewrites.
- **Trust sustainability:** fail-closed design + provenance everywhere + additive-only LLM contracts preserve citizen and officer trust across false-alarm, stale-data, and outage scenarios.

---

## 4. End Beneficiaries

| Beneficiary | How JeevanGrid serves them |
|---|---|
| **Citizens (primary)** | Risk lookup, official alerts with provenance, district push subscriptions, emergency reporting with tracking IDs, AI safety assistant in their language with voice, shelters/hospitals, helplines, safety guides |
| **Rural / low-literacy / differently-abled users** | Multilingual voice in/out, calm government-grade UI, one-tap 112 dialer, no English or typing requirement for core safety actions |
| **Students & educational institutions** | Multilingual safety guides (before/during/after, dos/don'ts, kits), risk awareness via demo, future school safety certification data |
| **District Collectors / District Officers** | Triage queue, responder dispatch, alert-staging into Incidents, district aggregates, pipeline ops view (`/alerts/system/health`) |
| **Field Responders (NDRF/SDRF, fire, police, medical)** | Assigned-incident scope, accept / in-progress / SitRep / resolve workflow optimized for field use |
| **Health Officers & hospitals** | Climate→Health assessments, scenario simulator, hospital surge and bed/oxygen views, evidence-based preparedness briefings |
| **State EOCs / SEOCs & NDMA ecosystem** | Cross-district aggregates, manual ingestion trigger, audit logs, fail-closed IMD/CWC/INCOIS integration path, SACHET relay layer that complements (never replaces) official authorities |
| **Community Volunteers & NGOs** | Scoped tasks/aggregates, district subscription model, verifiable relay copy for community dissemination |
| **Industries & insurers (secondary)** | District-keyed risk/health evidence base for business continuity planning, parametric insurance pilots, and CSR shelter-capacity programs |
| **Government & policymakers** | Auditable warning + response dataset for accountability, climate-health planning, and state-to-national scale-up without architectural rewrite |

---

## 5. Measurable Success Criteria

1. Complete loop demonstrable in < 3 minutes: Mumbai risk → official warning + provenance → district subscribe → `JG-ID` report → triage → dispatch → SitRep → resolve → Health/State aggregates.
2. Zero hallucinated warnings/beds/dispatches in AI and health paths (enforced by validation + tests).
3. Full functionality with zero provider keys (local safety engine + deterministic scores + English fallback).
4. 5-language parity across UI, AI responses, and voice I/O.
5. Stale/unavailable states always labeled; LIVE lists never contain expired or demo-gated rows in production.

---

## 6. Alignment with National Priorities

- **NDMA / SACHET / IMD / CWC / INCOIS:** relay-first integration that strengthens last-mile delivery of the existing warning chain.
- **Digital India / Bhashini:** India-stack translation path + 5-language citizen access.
- **National Health Mission / Heat Action Plans:** climate→health indicators for preventive action.
- **Disaster Management Act workflow:** district → state → national hierarchy mirrored in roles and dashboards.
