# Nugen Intelligence API in JeevanGrid — Where It Lives, How It Works, Why It Is the Major Impact

JeevanGrid uses **Nugen as its primary intelligence layer** in exactly two high-value places, with a deliberate fail-safe design around it. Nugen never touches official government warnings, never sees PII, and never blocks the app when unavailable — but when available, it is what turns raw telemetry into trusted, localized, actionable safety intelligence.

```
Citizen / Officer
  ├─ POST /api/ai/chat ──► aiOrchestrator ──► Nugen disaster model (primary)
  │                          │  ├─ DeepSeek (fallback) → local NDMA engine (last resort)
  │                          │  └─ safety validation + provider label + tool transparency
  └─ GET /api/health-intelligence/assess ──► ClimateHealthRiskEngine (deterministic)
     POST /api/health-intelligence/scenario ──► Nugen healthcare model (additive interpretation only)
```

Config (all server-side, never exposed to browser):

| Var | Value / default | File |
|---|---|---|
| `NUGEN_API_KEY` | secret, `server/.env` only | `server/src/services/nugenService.ts:23`, `server/src/services/ai/nugenHealthService.ts:162` |
| `NUGEN_ENDPOINT` | `https://api.nugen.ai/v1/chat/completions` | `server/.env.example:43` |
| `NUGEN_HEALTH_MODEL` | `nugen-healthcare-india` | `server/.env.example:46` |
| Models tried in order (health) | `NUGEN_HEALTH_MODEL → nugen-healthcare-india → nugen-disaster-aligned-v1` | `server/src/services/ai/nugenHealthService.ts:42-46` |
| Disaster model | `nugen-disaster-aligned-v1`, `temperature: 0.2` | `server/src/services/nugenService.ts:41-52` |

---

## 1. Usage Site 1 — AI Safety Assistant (the citizen-facing brain)

**Entry points:** `POST /api/ai/chat` (orchestrated), `POST /api/ai/chat-legacy` (compat), `GET /api/ai/status`, `GET /api/ai/tools-activity`
**Code:** `server/src/routes/aiRoutes.ts`, `server/src/controllers/aiController.ts`, `server/src/services/aiOrchestrator.ts:362-385`, `server/src/services/nugenService.ts`, `server/src/services/aiService.ts`

### How the call works

1. `aiController.chatWithAssistant` sanitizes input (max 20 messages, 2000 chars each, location ≤120 chars, coords range-checked, language normalized to 2 letters) — Nugen never receives unbounded or malicious payloads.
2. `aiOrchestrator` runs intent detection → whitelisted tools (geo, weather, AQI, USGS quakes, official alerts, hospitals/shelters) → assembles a `contextBlock` of **verified JeevanGrid data only**.
3. Nugen is called **first** (unless an emergency keyword already fired — then the local engine answers instantly without waiting for any LLM):
   ```ts
   // server/src/services/aiOrchestrator.ts:362-373
   const nugen = await nugenService.generateDisasterGuidance({
     messages: [{ role: 'system', content: contextBlock }, ...history.slice(-8)],
     location: locLabel,
   });
   if (nugen?.source === 'nugen_api') { provider = 'nugen'; llmText = nugen.response; }
   // only then: DeepSeek → local structured safety engine
   ```
4. `nugenService.generateDisasterGuidance` sends:
   - `model: 'nugen-disaster-aligned-v1'`, `temperature: 0.2` (deterministic, non-creative — critical for safety),
   - system prompt: *"You are JeevanGrid AI… based on NDMA, IMD, CWC standards. DO NOT claim dispatch. For life-threatening emergencies tell user to call 112. Calm, numbered, actionable."*
5. The reply goes through `validateProviderText` + safety layer, is localized into the user's language (en/hi/mr/gu/as), labeled in the UI (`nugen · JeevanGrid validation` vs `JeevanGrid safety engine` — see `client/src/pages/AssistantPage.tsx:218`, `StructuredMessage.tsx:236`), and logged with tool activity (`getToolActivity`).

### Efficiency impact here

- **India-aligned out of the box:** the disaster model already speaks NDMA/IMD/CWC protocol language, so JeevanGrid needs no giant prompt-engineering layer or fine-tune to get flood/earthquake/gas-leak/shelter/kit guidance right. The local fallback in `nugenService.ts:89-171` exists only as a degraded backup — Nugen is what makes answers fluent, contextual, and calm.
- **Token/latency discipline:** only last 8 messages, each capped at 1500 chars, go to Nugen. Emergency hits skip the LLM entirely (fastest path when seconds matter). Timeouts + `.catch(() => null)` mean Nugen can never hang the chat — DeepSeek/local take over silently.
- **Trust + transparency:** `GET /api/ai/status` honestly reports `nugen: { configured, mode: aligned-model|unavailable }`, so evaluators and EOC operators always know whether they are talking to Nugen or the local engine. Every answer carries its provider label and tool steps.

---

## 2. Usage Site 2 — Climate → Health Intelligence (the officer-grade differentiator)

**Entry points:** `GET /api/health-intelligence/assess?location=&nugen=true`, `POST /api/health-intelligence/scenario { location, preset: rain25|rain50|heat2|aqi50 }` (roles: `HEALTH_OFFICER`, `DISTRICT_OFFICER`, `STATE_EOC`)
**Code:** `server/src/controllers/healthIntelligenceController.ts`, `server/src/services/health/healthAssessmentService.ts:164-309`, `server/src/services/ai/nugenHealthService.ts` (221 lines), UI: `client/src/pages/dashboards/HealthDashboard.tsx:424`

### How the call works

1. Deterministic engine **always runs first**: live Open-Meteo weather/AQI + 72h rain + risk-engine flood stage + hospital registry → `ClimateHealthRiskEngine` scores for **vector / heat (Rothfusz heat-index physics) / respiratory / waterborne** (0–100 + `LOW/MODERATE/HIGH/SEVERE/INSUFFICIENT_DATA`). Missing data yields `INSUFFICIENT_DATA`, never a fabrication.
2. Only a compact **structured evidence object** is sent to Nugen — never raw PII, never personal health data:
   ```json
   { "location": "...", "timestamp": "...", "climate": {...}, "rainfall": {...},
     "aqi": {...}, "floodRisk": {...}, "vulnerability": {...}, "healthIndicators": {...} }
   ```
   (built in `healthAssessmentService.ts:116-162`, capped at 12,000 chars in the prompt).
3. `nugenHealthService.interpret(evidence, scenarioLabel?)` enforces a **strict JSON-only contract** via system prompt: `whyItMatters[≤5], vulnerableGroups[≤5], preparednessActions[≤5], dataGaps[≤5], confidence, uncertaintyNotes` + rules (*interpret only provided evidence; never diagnose individuals; never claim outbreaks; never contradict calculated levels; not a government warning; not medical advice*). Output is extracted (`extractJson`), sanitized (280-char cap per string), and schema-validated (`validateInterpretation`) — malformed output is discarded, dashboard still renders.
4. Model cascade with memory: tries `NUGEN_HEALTH_MODEL → nugen-healthcare-india → nugen-disaster-aligned-v1`, remembers the first working model (`workingModel`) to avoid repeat failures; 25s abort timeout; **never throws** — returns `{ available: false, reason }` and the deterministic scores carry the UI.
5. Result is persisted to `HealthAssessment { inputSnapshot, riskScores, interpretation, nugenModel, confidence }` and cached 15 min (`CACHE_TTL_MS`), with full provenance (`dataSources, calculationTimestamp, nugenModelUsed`). Scenarios reuse the live baseline, apply deltas, and return `scenario: true` **without persisting** — Nugen explains *how priorities change*, labeled as simulation.

### Efficiency impact here

- **Turns numbers into decisions:** the deterministic engine is precise but terse (scores + evidence strings). Nugen adds the three things officers actually need — *why it matters, who is most exposed, what to do first* — plus explicit data gaps and calibrated confidence. Without Nugen the dashboard is a gauge; with Nugen it is a briefing.
- **Cheapest possible LLM use:** one capped evidence payload per assessment, 15-min cache, working-model memo, scenario-on-baseline (no re-fetch of weather/risk). Nugen cost scales with distinct locations, not with every dashboard refresh.
- **Safety by construction:** Nugen *cannot* override math, invent case counts, or issue warnings — the validator + additive-only contract + `INSUFFICIENT_DATA` path make the health feature demo-safe and deployment-safe even with an aggressive model.

---

## 3. Usage Site 3 — Legacy compat path (kept, not primary)

`POST /api/ai/chat-legacy` → `aiService.handleCitizenQuery` → `nugenService.generateDisasterGuidance` directly. Retained so older clients/monitors keep working; all new traffic uses the orchestrated `/chat` path above.

## 4. Where Nugen is deliberately NOT used (proof of discipline)

- **Official warnings pipeline** (`services/alerts/*`, SACHET/IMD/CWC/INCOIS): zero LLM involvement — ingestion, validation, dedup, expiry, and EOC staging are pure code with audit logs. Nugen output is contractually forbidden from becoming an official warning (enforced in tests).
- **Geocoding, weather math, risk scoring, translations:** Nominatim/Overpass/Open-Meteo/riskEngine/LanguageService run deterministically. Nugen only *narrates* their outputs in the assistant/health paths.

## 5. Why Nugen is the major impact — the efficiency case in one paragraph each

- **Availability without fragility:** `isAvailable()` / `isConfigured()` gates, abort-controlled fetches, `.catch(() => null)`, and ordered fallbacks (Nugen → DeepSeek → local) mean the app is fully usable with no keys, yet instantly smarter with keys. Tests (`health.test.ts:145-160`) prove unreachable endpoints degrade gracefully.
- **Latency where it counts:** emergency intents bypass LLMs; health assessments cache 15 min; chat history is windowed. Nugen adds intelligence on the slow path (planning, explanation) and never on the fast path (triage, dispatch prompts).
- **Trust at scale:** low temperature (0.2), NDMA-grounded system prompts, output validation, provider labels, tool-activity log, and `/status` honesty checks convert a generic chatbot into an auditable safety assistant evaluators and officers can defend.
- **Domain leverage:** one disaster-aligned model + one healthcare-India model cover floods, quakes, fires, heat, air, waterborne risk, shelters, kits, and 5-language localization — replacing what would otherwise be dozens of hand-written rule trees per hazard per language.

**Bottom line:** remove Nugen and JeevanGrid still works (local engine + deterministic scores). Keep Nugen and JeevanGrid *explains, prioritizes, and localizes* like a trained responder — that gap, delivered with fail-safe guarantees and minimal token spend, is why Nugen is documented here as the system's major intelligence impact.
