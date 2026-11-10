# JeevanGrid Data Credibility & Live Telemetry Reliability Audit

**Audit Date:** November 2026
**Scope:** Landing page telemetry, official alerts, weather/AQI sourcing, demo/live data separation

## 1. HARDCODED FALLBACK READINGS IDENTIFIED (LandingPage.tsx)

| Value | Line | Current Issue | Problem |
|-------|------|--------------|---------|
| `28°C` | #605 | `weatherData?.temperature ?? 28` | Substitutes sample value when provider fails |
| `78%` | #623 | `weatherData?.humidity ?? 78%` | Substitutes sample value when provider fails |
| `12 km/h` | #629 | `weatherData?.windSpeed ?? 12` | Substitutes sample value when provider fails |
| `20%` | #635 | `weatherData?.rainProbability ?? 20%` | Substitutes sample value when provider fails |
| `Partly Cloudy` | #608 | `weatherData?.condition || 'Partly Cloudy'` | Default presented as current condition |
| `No severe storm alerts...` | #644 | `weatherData?.severeWarning || 'No severe storm alerts...'` | Default warning presented as live |
| `68` | #736 | `aqiData?.aqi ?? 68` | Substitutes sample value when provider fails |
| `Satisfactory` | #740 | `aqiData?.status || 'Satisfactory'` | Default status presented as live |
| `CPCB Standard Station` | #743 | Hardcoded label | Misleading — Open-Meteo uses CAMS, not CPCB |

## 2. OFFICIAL ALERTS STATE MANAGEMENT BUG

**File:** LandingPage.tsx, lines 97-98

```typescript
const officialSourceDown =
    officialSources.length > 0 && officialSources.every((s: any) => s.status !== 'HEALTHY');
```

**Bug:** When `officialSources` is `[]` (empty), `officialSourceDown` evaluates to `false`. 
The UI then treats this as "no source down" = "healthy situation" and displays `officialAlerts.length` warnings — 
even when the array is empty because no source could be verified.

**Impact:** Empty source array → UI says "0 verified official warnings active" — incorrectly claiming 
absence of warnings when it really means "source status unknown/fail-closed."

## 3. PROMISE.ALL COUPLING (LandingPage.tsx, line 77)

```typescript
const [weatherRes, aqiRes, alertsRes] = await Promise.all([
    apiFetch(`/weather?location=${encodeURIComponent(currentLocation)}`),
    apiFetch(`/aqi?location=${encodeURIComponent(currentLocation)}`),
    apiFetch('/alerts/official'),
]);
```

**Issue:** `Promise.all` means if any one provider fails, all three requests are aborted/errored. 
One failing provider prevents the other two from rendering.

**Required:** Use `Promise.allSettled()` so each provider operates independently.

## 4. DEMO MODE / ALERT TRANSPARENCY

- `DEMO_MODE=true` and `ENABLE_DEMO_ALERTS=true` in `.env`
- Backend `alertConfig.enableDemoAlerts` correctly gates demo records
- But frontend must explicitly distinguish demo from official — currently no visual disambiguation
- Demo alerts could leak into official views if not properly filtered

## 5. AQI CPCB MISLABELING

**Issue:** The AQI column header says "CPCB Standard Station" but the data comes from Open-Meteo's 
CAMS (Copernicus Atmosphere Monitoring Service), not CPCB (Central Pollution Control Board).

**Impact:** Users believe they're seeing CPCB-monitored data when it's actually model-based estimates.

---

## Files Inspected

| File | Purpose |
|------|---------|
| `client/src/pages/LandingPage.tsx` | Main landing page — weather, AQI, alerts display |
| `server/src/services/openMeteoService.ts` | Weather + AQI data provider |
| `server/src/services/alerts/officialAlertQuery.ts` | Official alert querying with fail-closed gate |
| `server/src/services/alerts/alertSourceRegistry.ts` | Source health registry |
| `server/src/services/alerts/alertConfig.ts` | Config including demo mode |
| `server/src/routes/weatherRoutes.ts` | `/weather` endpoint |
| `server/src/routes/aqiRoutes.ts` | `/aqi` endpoint |
| `server/src/routes/alertRoutes.ts` | `/alerts/official` endpoint |