# Citizen Incident Lifecycle Implementation Plan

> **For the implementer:** Execute this plan inline in the current worktree. Extend the existing Prisma/Express/React implementation. Do not reset, reseed, or delete existing records. Do not add a second database, auth system, assistant, incident table, or realtime service.

**Goal:** Make a citizen report submitted through the existing AI Assistant persist to PostgreSQL, move through DDMA verification/assignment, field response, and DDMA resolution review, with append-only audit history, scoped authorization, honest location handling, and automatic dashboard refresh.

**Architecture:** The existing Neon PostgreSQL database through Prisma remains the system of record. `EmergencyReport` records the citizen submission and `Incident` remains the operational ticket. A new `IncidentEvent` table is the append-only lifecycle ledger. Existing Express routes gain explicit role/assignment checks. The existing assistant conversation renders a guided report flow; no second chatbot exists. Existing Leaflet maps and polling transport are reused.

**Tech stack:** React 18 + Vite + TypeScript, Express + TypeScript + Zod, Prisma 5 + PostgreSQL (Neon), Leaflet/react-leaflet, existing JWT auth.

---

## Task 1: Extend the schema additively

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/20261110120000_incident_lifecycle/migration.sql`

Add to `EmergencyReport`: `reportedByUserId`, `reporterType`, `reportSource`, `originalDescription`, `aiSummary`, `accuracyM`, `locationSource`, `locationCapturedAt`, `locationConfirmed`, `locality`, `vulnerablePersonsInfo`, `isDemo`, and relation to `User`.
Add to `Incident`: `referenceCode` (required unique), reporter/source fields, `verifiedById`, `verifiedAt`, `duplicateSuspected`, `duplicateOfReference`, `assignedById`, `assignedAt`, `assignmentNotes`, `resolutionSubmittedAt`, `resolutionReviewedById`, `resolutionReviewedAt`, `resolutionDecision`, `resolutionReviewNotes`, `resolvedAt`, `closedAt`, location metadata, `isDemo`, and `events`.
Add `IncidentEvent`: incidentId, optional actorUserId, actorRole, eventType, previousStatus, newStatus, description, JSON metadata string, createdAt; indexes on incident/time, event type, actor.
Extend `FieldReport`: `reportType`, `situationAfter`, `remainingProblems`, `peopleAssisted`, `actionTaken`, `arrivalAccuracyM`, `distanceFromIncidentM`.
Add user relations for reported, verified, assigned-by, reviewed incidents and events.

**Migration safety:** Add nullable columns first, backfill `Incident.referenceCode` with a deterministic `JG-LEGACY-<md5 prefix>`, then set NOT NULL and add the unique index. All other changes are additive. Apply with `npx prisma migrate deploy`, then `npx prisma generate`.

**Verification:** `npx prisma validate`; `npx prisma migrate status`; `npx prisma generate`.

## Task 2: Add lifecycle domain service and reference generation

**Files:**
- Create: `server/src/services/incidents/incidentLifecycleService.ts`
- Modify: `server/src/utils/idGenerator.ts`
- Create: `server/src/services/incidents/__tests__/incidentLifecycle.test.ts`

Implement:
- `INCIDENT_STATUSES` and terminal/active sets.
- `generateIncidentReference()`: `JG-<year>-<six crypto-random unambiguous uppercase chars>`.
- `generateEmergencyReportId()`: same non-guessable shape.
- `appendIncidentEvent(tx, event)`: append only; no update/delete helper.
- `recordTransition(tx, incident, actor, action, metadata)`.
- Pure transition table for DDMA and responder actions.
- Scope helpers: `canViewIncident`, `canManageIncident`, `canRespondToIncident`.

Responder actions: `ACCEPT` (`ASSIGNED`→`ACCEPTED`), `EN_ROUTE`, `ARRIVE` (`ON_SITE`), `START` (`IN_PROGRESS`), `SUBMIT_RESOLUTION` (`RESOLVED_PENDING_REVIEW`).
DDMA actions: `VERIFY`, `REJECT`, `MARK_DUPLICATE`, `ASSIGN`, `APPROVE_RESOLUTION`, `REJECT_RESOLUTION`, `REOPEN`.

**Tests:** transitions reject invalid states, assignment scope, reference format, and aid/role checks. Run `tsx --test`.

## Task 3: Make citizen submission atomic, idempotent, and typed

**Files:**
- Modify: `server/src/services/community/communityIntelligenceService.ts`
- Modify: `server/src/controllers/emergencyReportController.ts`
- Modify: `server/src/routes/emergencyReportRoutes.ts`
- Modify: `server/src/middleware/authMiddleware.ts`

Implement `optionalAuth` that identifies a logged-in citizen but still permits guests. Server derives `reporterType` (`GUEST` / `AUTHENTICATED_CITIZEN`) and `reportedByUserId`; never trust those from the body.

Extend create schema for `reportSource`, `originalDescription`, `aiSummary`, `accuracyM`, `locationSource`, `locationCapturedAt`, `locationConfirmed`, `locality`, `vulnerablePersonsInfo`. Validate coordinates as a pair, accuracy `0..100000`, and ISO location capture time. Accept legacy calls without new fields.

Create report + incident + `IncidentEvent` in one `$transaction`. Always create an incident, including duplicate-suspected reports (status `DUPLICATE_SUSPECTED`). Return `reportId`, `incidentId`, `incidentReference`, `verificationStatus`, `incidentStatus`, `createdAt`, and explicit non-dispatch wording. Protect the idempotency race by returning the existing report on unique-key conflict.

Rate limit `POST /emergency-reports` per IP. Require authentication for report reads; scope reads to DDMA jurisdiction, assigned responder, or report owner. Remove public `GET /emergency-reports/:id`.

**Verification:** API validation tests for coordinates, missing fields, duplicate key, guest/auth reporter typing, and read authorization.

## Task 4: Add scoped DDMA and responder APIs

**Files:**
- Rewrite: `server/src/controllers/incidentController.ts`
- Rewrite: `server/src/routes/incidentRoutes.ts`
- Modify: `server/src/controllers/fieldReportController.ts`
- Modify: `server/src/routes/fieldReportRoutes.ts`
- Modify: `server/src/controllers/communityController.ts`
- Modify: `server/src/routes/communityRoutes.ts`

Endpoints:
- `GET /incidents`: responder sees only own assignments; DDMA district/state scope; citizen sees own reports only.
- `GET /incidents/:id`: same scope, includes report, events, field reports, verifier, assigner, resolution reviewer.
- `PATCH /incidents/:id/verify` (DDMA; note required)
- `PATCH /incidents/:id/reject` (DDMA; reason required)
- `PATCH /incidents/:id/duplicate` (DDMA; note required)
- `PATCH /incidents/:id/assign` (DDMA; responder must be active, in jurisdiction, and same district)
- `PATCH /incidents/:id/responder-action` (assigned responder only; ACCEPT/EN_ROUTE/START)
- `POST /incidents/:id/check-in` (assigned responder; GPS/manual, accuracy, note, calculated distance)
- `POST /incidents/:id/resolution` (assigned responder; resolution fields; status only `RESOLVED_PENDING_REVIEW`)
- `POST /incidents/:id/review-resolution` (DDMA; approve/reject/reopen)
- `GET /incidents/responders` (DDMA; workload counts)

Extend `/field-reports` for situation updates only, enforcing assignment and creating lifecycle events. Preserve `markCompleted` behavior only by converting it to `RESOLVED_PENDING_REVIEW`, never `RESOLVED`. Change community verification to DDMA/state only and jurisdiction-scope community reads.

All writes update the report status in the same transaction where relevant and append an immutable event with actor ID, role, previous/new status, notes, and metadata.

## Task 5: Dashboard data + polling API contract

**Files:**
- Modify: `server/src/controllers/dashboardController.ts`

District dashboard:
- Filter incidents, responders, reports, hospitals, and shelters to the officer's district; `STATE_EOC` may view its state.
- Include `report`, `assignedTo`, `assignedBy`, `verifiedBy`, `resolutionReviewedBy`, ordered `events`, and ordered `fieldReports`.
- Return source/reporter/location metadata and resolution review fields.
- Stats: unverified/new, verified, active field, pending resolution, resolved, rejected/duplicate, affected civilians, responder workload.
- Responders include active assignment count and current status.

State EOC dashboard must use the same incident includes.

## Task 6: Honest citizen location context on landing

**Files:**
- Modify: `client/src/context/AssistantContext.tsx`
- Create: `client/src/components/report/LocationPermissionCard.tsx`
- Modify: `client/src/pages/LandingPage.tsx`
- Modify: `server/src/services/geoService.ts`
- Modify: `server/src/controllers/geoController.ts`
- Modify: `server/src/routes/geoRoutes.ts`

Extend assistant context with in-memory `deviceLocation` (`latitude`, `longitude`, `accuracyM`, `source`, `capturedAt`), permission states (`NOT_REQUESTED`, `REQUESTING`, `GRANTED`, `DENIED`, `UNAVAILABLE`, `TIMEOUT`, `MANUAL`), and a concise message. Request geolocation only after the user presses **Enable Location**. Never auto-request.

Landing card:
- Enable location / Not now.
- Show real accuracy and source when granted.
- Manual area entry through the existing geo resolver.
- Clear failure text; never substitute Mumbai/Bandra or cached coordinates.
- “Report emergency” starts the assistant report flow with the captured location available.
- “Check local risk” uses the resolved area.

Add authenticated-free `GET /geo/reverse?lat=&lng=` using Nominatim with timeout and no fake fallback. Remove every fake GPS fallback from LandingPage; use the server reverse endpoint and coordinates text if reverse geocoding fails.

## Task 7: Assistant-guided report flow

**Files:**
- Create: `client/src/components/report/EmergencyReportFlow.tsx`
- Create: `client/src/components/report/LocationPickerMap.tsx`
- Modify: `client/src/components/ai/AssistantConversation.tsx`
- Modify: `client/src/components/ai/StructuredMessage.tsx`
- Modify: `client/src/context/AssistantContext.tsx`

Use the existing assistant conversation, not a new page/chatbot. `__action:report` and assistant report actions open a guided card inside the conversation:
1. Describe the emergency (free text or speech). Call existing `/ai/extract-emergency`; show extracted category/urgency/summary and let the user edit.
2. Confirm incident location: use the captured device location, a draggable map pin, or a manually typed address. Reverse geocode; keep accuracy and source. If location is unavailable, allow address-only with no coordinates.
3. Confirm people affected, vulnerability/freeform details, photo (existing upload).
4. Review every field, reporter name/phone for guests, location confirmation, and the exact non-dispatch disclaimer.
5. Submit once with a stable idempotency key; disable repeat clicks; show server-generated reference, timestamp, and unverified status.

AI only structures text; it never verifies, assigns, dispatches, or submits. The client only submits after the explicit review confirmation. Preserve every citizen-entered description as `originalDescription`, with the extraction summary in `aiSummary`.

## Task 8: DDMA operational UI

**Files:**
- Modify: `client/src/pages/dashboards/DistrictDashboard.tsx`
- Create: `client/src/components/incidents/IncidentMap.tsx`
- Create: `client/src/components/incidents/IncidentTimeline.tsx`

Extend the existing triage-first dashboard:
- Poll `/dashboards/district` every 15 seconds while visible and on manual refresh; keep prior data on errors and show honest reconnect/last-refreshed status.
- Queue cards show reference, source, reporter type, district/locality, urgency, created time, status, and demo/seed label when `isDemo`.
- Detail shows report vs AI summary, exact authorized location with accuracy/source, map pin/accuracy circle, contacts, vulnerable info, photo, assignment note, and event timeline.
- Actions: verify, reject, mark duplicate, assign verified incident to a responder, and review resolutions (approve, reject with reason, reopen). No arbitrary status dropdown.
- Clearly label operational actions as JeevanGrid records, not official warnings or physical dispatch confirmation.

## Task 9: Responder operational UI

**Files:**
- Modify: `client/src/pages/dashboards/ResponderDashboard.tsx`

Rebuild the task view around the assigned incident:
- Poll own assignments every 15 seconds; keep prior data on failure.
- Show reference, urgency, location, assignment notes, timeline, and contact only for assigned incidents.
- Actions: Accept, En route, On site (GPS check-in with accuracy; manual fallback requires note), Start work, Situation update, Submit resolution.
- Resolution form includes work completed, situation after, people assisted, remaining problems, optional evidence, and check-in coordinates. It submits to `RESOLVED_PENDING_REVIEW`; the responder cannot mark resolved.
- Show “Awaiting DDMA review” rather than a completion claim.

## Task 10: Direct report page consistency

**Files:**
- Modify: `client/src/pages/EmergencyReportPage.tsx`

Add real accuracy/source/captured-at, server-truth success text/reference, `reportSource: CITIZEN_FORM`, reporter type handled by server, and explicit content that submission does not mean verification or dispatch. Leave offline queue behavior intact.

## Task 11: Security and privacy verification

- Server-side role checks on every lifecycle route. No client-only authorization.
- Responder can never read/update an unassigned incident.
- DDMA cannot act outside district; state EOC stays within state.
- Citizen/volunteer cannot verify, assign, check in, or close.
- Exact coordinates/phone only to DDMA, state EOC, assigned responder, and report owner. Community volunteer views are masked.
- Uploads remain server-signed; never expose Cloudinary secrets. Existing public media behavior is documented as a limitation.
- Rate limit report submission and corroboration; validate all payloads with Zod.
- Any seeded/demo incident is labeled `isDemo`; new citizen submissions are not. No UI claims official issuance or physical dispatch.

## Task 12: Test, migrate, and verify

1. Unit tests: lifecycle transitions, references, duplicate policy, location validation, scope helpers.
2. Apply migration to Neon with `prisma migrate deploy`; never `migrate reset` or `db push --force-reset`.
3. Start the API and run a database-backed E2E script:
   - guest submit → DB report/incident/event
   - duplicate click → same record
   - DDMA verify → assign
   - responder accept → en route → GPS check-in → start → situation → resolution
   - DDMA approve → resolved, audit event count/status
   - negative authorization and validation cases
4. Build server (`npm run build`) and client (`npm run build`).
5. Verify landing permission states, assistant flow, responsive dashboards, polling, and console errors. Use browser automation if available; otherwise use HTTP + build verification and explicitly report what was and was not browser-verified.
6. Clean up only records created by the test run; never delete pre-existing data.

## Dependency order

Schema → generate client → lifecycle service + tests → submission transaction → incident APIs → dashboard APIs → geo reverse → assistant/location UI → DDMA UI → responder UI → legacy form consistency → migration → E2E/security tests → builds/browser verification → report.

## Boundaries and honest limitations

- This repo has no PostGIS extension in its Prisma datasource; coordinates remain validated `Float` columns, with app-level distance checks. No database-level geospatial index will be claimed.
- The existing Cloudinary upload endpoint returns a public secure URL. Changing delivery to authenticated URLs would require a separate media-proxy change; the existing upload path is reused and the limitation is reported rather than hidden.
- Existing realtime is polling; dashboards use visible-tab polling, not a new WebSocket architecture.
- The assistant UI is the single assistant; no new chat service or model is introduced.
