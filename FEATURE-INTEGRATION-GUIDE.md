# JeevanGrid Feature Integration Guide

## Overview

This document describes the eight advanced climate-intelligence and anticipatory-disaster-response features added to the JeevanGrid platform for the PCCOE International Grand Challenge 2026. All features extend the existing architecture — they do not rebuild it — and preserve the disaster lifecycle: **Forecast → Official Alert → Citizen Report → Triage → Dispatch → Resolve**.

> **Important**: Demo alerts are labelled `SIMULATION`. They must never be presented as official warnings. The platform uses a **fail-closed** gate: unverifiable data is excluded, and stale alerts (90-minute freshness from SACHET RSS) are marked stale to protect users.

---

## Architecture Overview

- **Backend**: Node.js + Express + Prisma ORM + PostgreSQL
- **Frontend**: React + React Router + Tailwind CSS + Leaflet map
- **Authentication**: JWT tokens, RBAC roles (`CITIZEN`, `DISTRICT_OFFICER`, `STATE_EOC`, `HEALTH_OFFICER`, `FIELD_RESPONDER`, `COMMUNITY_VOLUNTEER`)
- **API**: All routes mounted under `/api/...`; JSON body limit 12 MB global
- **Data Stores**:
  - Prisma models: `disasterAlert`, `communityReport`, `impactAssessment`, `playbookActivation`, `satelliteLayer`, `alertAcknowledgement`, `auditLog`
  - IndexedDB offline queue (client-side) + service worker caching
- **External APIs** (server-side only, with timeouts & graceful degradation):
  - **WorldPop v3** — population demographics (`POST /population`, `POST /groups`)
  - **OpenRouteService** — routing/evacuation routes (backend-only key)
  - **Cloudinary** — signed photo uploads
  - **Copernicus Data Space Ecosystem** — catalogue metadata search (manual GeoJSON import only)
  - **SACHET RSS feed** — official India warnings (fail-closed 90-min freshness gate)

---

## Feature Summaries

### Feature 1 — Impact & Exposure Assessment
- **Purpose**: Estimate exposed population, children, elderly, hospitals, schools, and road segments inside a selected geometry.
- **Backend**: `impactAssessmentService.ts` → `impactRoutes.ts` → Prisma cache + WorldPop + OpenStreetMap counts
- **Key endpoints**:
  - `POST /api/impact/assess` — body: `{alertId|geometry|location, district, state, hazardType, isSimulation}`
  - `GET /api/impact/assessments?district=…&take=8` — cached history
- **Frontend**: `ImpactAssessmentPanel` in District Dashboard; modes: official alert, location text, drawn polygon, GeoJSON file upload
- **Data & Limitations**:
  - Population from WorldPop gridded estimates (data year noted; may be unavailable)
  - Infrastructure counts from OpenStreetMap **fallback to local registry only**; never invent numbers
  - Area and density calculated; precision badges show source
  - **Always displayed caveat**: "These are estimated exposure figures. They are not casualty counts, damage assessments, or confirmation that any facility is operating."
  - Simulation flag labelled SIMULATION; assessment does not count as verified exposure

### Feature 2 — Community Intelligence & Corroboration
- **Purpose**: Collect citizen reports, detect duplicates, track verification state, enable officer corroboration and decisions.
- **Backend**: `communityIntelligenceService.ts` → `communityRoutes.ts`
  - Duplicate detection: proximity (<500 m) + time window (3 hrs) + deterministic rules
  - Corroboration threshold: 2 independent corroborations → status `CORROBORATED`
  - Officer-only actions: `VERIFY`, `REJECT`, `RESOLVE` (require audit note)
  - Privacy: volunteer sees masked data; officer sees contact phone only in follow-up
- **Key endpoints**:
  - `POST /api/community/reports` — create report (idempotency key)
  - `GET /api/community/reports?district=…` — list with filters
  - `POST /api/community/reports/:id/corroborate` — add corroboration note
  - `POST /api/community/reports/:id/verify` / `/reject` / `/resolve` — officer actions
  - `GET /api/community/summary?district=…&days=7` — counts, timeline, byCategory
- **Frontend**: `CommunityIntelligencePanel` in District Dashboard; filters by status, search, category bars, recent reports table, officer actions
- **Data & Limitations**:
  - AI classification is **advisory only** — never sets `OFFICER_VERIFIED`
  - Duplicate detection uses deterministic rules, not AI verification
  - Assistance requests and vulnerable groups are advisory; officer must independently confirm
  - PII (phone) only visible to officer role; volunteers see masked data

### Feature 3 — AI Structured Extraction (Voice / Text)
- **Purpose**: Extract emergency details from citizen transcript using Nugen/DeepSeek, with deterministic multilingual fallback when external models fail.
- **Backend**: `structuredExtractionService.ts` → `voiceReportController.ts` → `POST /api/ai/extract-emergency`
  - Attempt Nugen first, then DeepSeek, then deterministic fallback
  - Zod-validated output: `incidentType`, `urgency`, `peopleAffected`, `description`, `locationText`, `vulnerablePersons`, `requiredAssistance`, `language`, `confidence`
  - Fallback extracts via regex rules for Marathi, Hindi, Gujarati, Bengali, Assamese
- **Key endpoints**:
  - `POST /api/ai/extract-emergency` — body: `{transcript, language}`
- **Frontend**: `EmergencyReportPage` voice panel; transcript textarea; "Extract into form" button; shows provider + confidence badge; user must review every field before submitting
- **Data & Limitations**:
  - `Nugen` endpoint fails with TLS name mismatch → deterministic fallback active
  - `DeepSeek` returns HTTP 401 → fallback active
  - Extraction confidence labelled LOW/MEDIUM/HIGH; always reviewed by human
  - Never auto-verify or auto-dispatch based on extraction output

### Feature 4 — Playbook Templates & Activation
- **Purpose**: Maintain six named playbook templates, support activation from official warnings or manual initiation, and track task completion with evidence.
- **Backend**: `playbookService.ts` → `playbookController.ts`
  - Six templates: `FLOODING`, `FIRE`, `MEDICAL`, `STRANDED`, `LANDSLIDE`, `INFRASTRUCTURE`
  - Trigger policies: `OFFICIAL_ALERT` + severity threshold, `RISK_SCORE` ≥ 60, `SIMULATION` (training only)
  - Activation stores `templateId`, `triggerType`, `triggerSummary`, `isSimulation`, `district`, `state`
  - Tasks per activation: `PENDING` → `IN_PROGRESS` → `COMPLETED` (evidence required); `OVERDUE` tracked
  - Only an authorised officer can verify/invalidate; AI cannot activate
- **Key endpoints**:
  - `GET /api/playbooks/templates` — all templates
  - `GET /api/playbooks?district=…` / `POST /api/playbooks/activate` — list / activate
  - `GET /api/playbooks/summary?district=…` — active, overdue, completed counts
  - `PATCH /api/playbooks/tasks/:id` — update status + evidence
  - `POST /api/playbooks/demo-scenario` — labelled SIMULATION for training
- **Frontend**: `PlaybookPanel` in District Dashboard; suggestions cards, manual activation, task list with evidence textarea, role filtering
- **Data & Limitations**:
  - Playbooks are **internal preparedness checklists**; they do **not** issue official warnings, order evacuations, or dispatch teams
  - Only a human officer can decide and communicate a real evacuation
  - Manual activation requires at least 3-character evidence before marking complete
  - Simulation label excluded from verified routing evidence

### Feature 5 — Evacuation Route Planning
- **Purpose**: Compute safe evacuation routes avoiding verified hazards, rank shelters, and provide honest fallback when external routing is unavailable.
- **Backend**: `evacuationRoutingService.ts` → `evacuationRoutes.ts`
  - ORS GeoJSON polygon avoidance (verified hazard polygons)
  - Shelter ranking: capacity, distance from centre, occupancy
  - Honest fallback: if ORS fails, return "routing unavailable — use local knowledge; do not declare roads safe"
- **Key endpoints**:
  - `POST /api/evacuation/route` — body: `{startLat,lng, endLat,lng, hazardPolygons, district, state}`
  - `GET /api/evacuation/shelters?district=…` — ranked list
- **Frontend**: Evacuation tab in Resources Page; ORS route result with avoid-polygon; shelter list with capacity badges; note "routing is advisory only; verify ground conditions"
- **Data & Limitations**:
  - ORS key must stay backend-only; client never sees it
  - Avoid-polygon uses GeoJSON Polygon/MultiPolygon with `[lng,lat]` coordinate order
  - Shelter capacity recorded as registry value; `capacityDataAvailable: false` — never live availability
  - **Never** declare any road safe; routing is advisory

### Feature 6 — Offline & Field Reports
- **Purpose**: Enable citizen reports from offline/low-connectivity contexts, with idempotent submission, and IndexedDB queue sync when connection restores.
- **Backend**: `emergencyReportController.ts` — Zod validation, idempotency key, duplicate suppression, privacy shaping, audits
- **Frontend**: 
  - `OfflineQueue` service (IndexedDB) + `OfflineSyncManager` component
  - `EmergencyReportPage` with photo compress upload, voice extraction, idempotency key, enqueue-on-failure
  - Submission: if server 5xx/timeout → queue locally; retry button syncs when online
- **Key endpoints**:
  - `POST /api/emergency-reports` — create report (idempotency, duplicate suppression)
  - `GET /api/emergency-reports?district=…` — list (role-filtered)
- **Data & Limitations**:
  - Reports start **UNVERIFIED**; submission does **not** dispatch a team
  - Idempotency key prevents duplicate DB rows on retry
  - Photo upload via Cloudinary; report still works without photo if storage unavailable
  - Voice extraction preview only; never auto-sent

### Feature 7 — Alert Acknowledgement & Assistance Follow-up
- **Purpose**: Collect citizen acknowledgements of official warnings, track responses, and enable officer assistance follow-up (no automatic dispatch).
- **Backend**: `acknowledgementService.ts` → `acknowledgementRoutes.ts`
  - `POST /api/alert-acknowledgements` — record response + optional note
  - `POST /api/alert-acknowledgements/:id/incident` — convert to operational follow-up incident (officer only)
  - Summary: total acknowledgements, distinct responders, assistance requests, push delivery measured (not proof of read/understood)
- **Key endpoints**:
  - `POST /api/alert-acknowledgements` — `{alertId, response, note}`
  - `GET /api/alert-acknowledgements/summary?district=…&days=30` — counts, byResponse, assistanceQueue, privacyNote
  - `POST /api/alert-acknowledgements/:id/incident` — create follow-up (officer only)
- **Frontend**: 
  - `AlertsPage` acknowledgement buttons per official alert (5 response options)
  - `AcknowledgementPanel` in District Dashboard; assistance queue, response breakdown, convert-to-incident button
  - Simulation-labelled demo alerts in AlertsPage for training
- **Data & Limitations**:
  - Acknowledgement **is not** a verified incident and does **not** dispatch a team
  - Push delivery count measured separately; **not** proof a citizen read/understood the warning
  - Converting an acknowledgement creates an operational follow-up at district level; no verification of precise location, no auto-dispatch
  - Assistance follow-up queue only for responses `NEED_ASSISTANCE` or `CANNOT_EVACUATE`

### Feature 8 — Satellite Layer import & Copernicus Catalogue
- **Purpose**: Manual GeoJSON product import from pre-processed satellite data, with provenance metadata and verification status. No automatic flood or damage detection.
- **Backend**: `satelliteLayerService.ts` → `satelliteRoutes.ts`
  - `POST /api/satellite/layers` — import GeoJSON (Polygon/MultiPolygon/FeatureCollection, max 20,000 points)
  - `GET /api/satellite/layers?district=…` — list imported layers per district
  - `GET /api/satellite/status` — provider configured / capabilities
  - `POST /api/satellite/catalogue/search` — bbox + date + collection search (metadata only)
- **Frontend**: `SatellitePanel` in District Dashboard; import form (event, area, district, source, dates, product ref, precision, verification, simulation flag, GeoJSON file); map preview; layer list; catalogue search collapsible
- **Data & Limitations**:
  - **Manual import prototype** — operator must have downloaded/processed a product and converted to GeoJSON
  - No automatic flood or damage detection from imagery
  - Every layer stores source, observation date, processing date, geometry precision, verification status, simulation flag
  - Catalogue search returns metadata only; does **not** produce flood extents or automatic classifications
  - Verification status `UNVERIFIED` / `VERIFIED` set manually by officer
  - Simulation layers visibly labelled and excluded from verified routing evidence

---

## Environment Setup

Create a `.env` file in `server/` with the following variables (all **backend-only** except where noted). Values marked `OPTIONAL` may be omitted; the code degrades gracefully.

```dotenv
# === Core ===
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NODE_ENV=development

# === Authentication / RBAC ===
# JWT secret used by express middleware; keep confidential
JWT_SECRET=change-this-to-a-secure-random-string

# === WorldPop (Population Demographics) ===
# OPTIONAL: if omitted, the platform uses a built-in gridded estimate for India.
# See: https://worldpop.org/
WORLDPOP_API_KEY=   # optional

# === OpenRouteService (Routing / Evacuation) ===
# OPTIONAL backend-only key; never commit to client.
# Required for ORS avoid-polygon routing; fallback is honest "unavailable".
ORS_API_KEY=   # optional

# === Cloudinary (Photo Uploads) ===
CLOUDINARY_CLOUD_NAME=demo
CLOUDINARY_API_KEY=1234567890abcdef
CLOUDINARY_API_SECRET=your-cloudinary-secret

# === Copernicus Data Space Ecosystem ===
# OPTIONAL: credentials for catalogue metadata search.
# Manual GeoJSON import works without these.
COPERNICUS_CLIENT_ID=
COPERNICUS_CLIENT_SECRET=

# === SACHET RSS Feed (Official India Warnings) ===
# Auto-ingested; no credentials needed. Fail-closed 90-minute freshness gate applies.
SACHET_RSS_URL=https://rss.india.gov.in/relief/rss_india.xml

# === Feature flags (optional) ===
# Set to false to disable a feature without removing code.
IMPACT_FEATURE_ENABLED=true
COMMUNITY_FEATURE_ENABLED=true
PLAYBOOK_FEATURE_ENABLED=true
ROUTING_FEATURE_ENABLED=true
ACKNOWLEDGEMENT_FEATURE_ENABLED=true
SATELLITE_FEATURE_ENABLED=true
```

> **Note**: The `server/.env` already has these values configured for the demo deployment. Do **not** create a `.env.local`; the platform reads only from `server/.env`.

---

## Testing

### Running the Stack
```bash
# From repo root
npm run dev          # starts both server (port 5000) and client (port 3000)
```

### Health Check
- `GET http://localhost:5000/api/health` → `{ status: 'ok' }`

### Feature-Specific Smoke Tests
| Feature | Endpoint / Action | Expected |
|---------|-------------------|----------|
| Impact | `POST /api/impact/assess` with valid geometry | 200 + exposure metrics; SIMULATION badge if `isSimulation:true` |
| Community | `POST /api/community/reports` with all fields | 201 + report ID; duplicate suppression on retry |
| AI Extraction | `POST /api/ai/extract-emergency` with transcript | 200 + extracted fields + provider + confidence |
| Playbooks | `GET /api/playbooks/templates` | 200 + 6 template objects |
| Routing | `POST /api/evacuation/route` | 200 + ORS GeoJSON or honest fallback message |
| Offline | Submit report offline → `navigator.onLine` false → queue | Item stored in IndexedDB; retry syncs when back online |
| Acknowledgement | `POST /api/alert-acknowledgements` with response | 200 + acknowledgement recorded; summary updates |
| Satellite | `POST /api/satellite/layers` with valid GeoJSON | 200 + layer recorded with metadata; SIMULATION badge if checked |

### Test Commands
```bash
# Server unit / integration tests (if configured)
npm test --prefix server

# Client vitest / component tests
npm test --prefix client

# Build both (already verified)
npm run build --prefix server
npm run build --prefix client
```

### Known Test Issues
- **Overpass heavily rate-limited** → infrastructure counts degrade to local registry with explicit warning banner
- **SACHET RSS last updated Nov 8** → 90-min freshness gate marks rows STALE; intended fail-closed behaviour (official alerts page may show 0 LIVE if feed stale)
- **Nugen TLS error** + **DeepSeek 401** → deterministic fallback active; extraction still works via fallback rules
- **Cloudinary/Copernicus online** — untested with real credentials; mock/demo mode works

---

## Limitations & Future Work

| Area | Current Status | Planned Improvement |
|------|---------------|---------------------|
| **Official warning freshness** | 90-min gate marks stale → fail-closed | Extend freshness window; add manual refresh button |
| **Overpass counts** | Rate-limited → local registry fallback | Cache longer; integrate alternative OSM data source |
| **WorldPop data year** | May be unavailable; noted in UI | Add secondary source (GHS population) |
| **OpenRouteService key** | Backend-only; may fail | Add map-based manual route drawing fallback |
| **Cloudinary uploads** | Requires valid credentials | Add local fallback: base64 blob store (not recommended for production) |
| **Copernicus catalogue** | Metadata search only; no automatic detection | Build product download pipeline (future sprint) |
| **AI extraction** | Nugen/DeepSeek unreliable → fallback only | Evaluate newer models (e.g., OpenAI function calling) when available |
| **Playbook auto-activation** | Requires officer; AI cannot trigger | Add risk‑score threshold auto‑trigger (behind feature flag) |
| **Acknowledgement delivery proof** | Push count ≠ read/understood | Add optional read-receipt via Web Push `data` payload (opt-in) |
| **Shelter capacity live** | Recorded registry value only | Integrate real-time shelter management system (future) |
| **Multilingual fallback** | Deterministic regex rules for 5 languages | Expand to more languages; add user‑submitted phrase lists |

---

## Conventions Used in This Codebase

- **RBAC**: Role-based access control enforced in backend middleware (`requireRole`). Frontend panels appear only for authorised roles.
- **Simulation labelling**: Any feature that may involve demo or training data explicitly adds a `SIMULATION` badge or label. Never present simulation data as official.
- **Fail‑closed**: Gates that exclude unverifiable data (stale alerts, missing API keys, unauthenticated requests) rather than fabricating values.
- **Advisory AI**: All AI/rule outputs are labelled advisory; they never set `OFFICER_VERIFIED` or dispatch teams.
- **Idempotency**: Keys (`crypto.randomUUID()`) prevent duplicate rows on retry; backend validates and rejects duplicate creation.
- **Privacy shaping**: Sensitive fields (phone, exact GPS) are masked for non‑officer roles; audit trails log all status changes.
- **No auto-dispatch**: No feature auto-generates official warnings, declares roads safe, or dispatches teams. Human officer decision required at every step.

---

## Credits & Acknowledgments

- PCCOE International Grand Challenge 2026 — project brief and validation
- WorldPop v3 for gridded population data
- OpenRouteService for routing APIs
- Cloudinary for signed media uploads
- Copernicus Data Space Ecosystem for satellite metadata
- SACHET RSS feed for official India warning dissemination
- All contributors to the JeevanGrid open‑source ecosystem