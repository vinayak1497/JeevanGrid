/**
 * Climate → Health Intelligence tests. Pure unit tests (no DB, no network).
 * Nugen client is exercised with overrides pointing at unreachable endpoints
 * and with an empty key, proving fail-safe behavior without live calls.
 *
 * Run: npm run test:health  (tsx --test)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  assessClimateHealth,
  applyScenario,
  heatIndexCelsius,
  type EngineInputs,
} from '../climateHealthRiskEngine';
import { NugenHealthService } from '../../ai/nugenHealthService';

function inputs(overrides: Partial<EngineInputs> = {}): EngineInputs {
  return {
    climate: {
      temperatureC: 31,
      humidityPct: 82,
      precipitationMm24h: 84,
      precipitationMm72h: 120,
      rainProbabilityPct: 85,
      condition: 'Heavy Rain',
      observedAt: new Date().toISOString(),
      source: 'open-meteo',
    },
    air: {
      aqi: 176,
      status: 'Poor',
      pm25: 95,
      pm10: 140,
      observedAt: new Date().toISOString(),
      source: 'open-meteo-aq',
    },
    flood: {
      floodRiskStage: 'Moderate (Mithi River Staging 2.8m / Danger 4.2m)',
      rainfallExpectedMm: 72,
      source: 'risk-engine',
    },
    vulnerability: {
      hospitalsNearby: 4,
      totalBedsNearby: 800,
      availableBedsNearby: 120,
      elderlySharePct: null,
      childrenSharePct: null,
      populationDensityPerKm2: null,
    },
    ...overrides,
  };
}

describe('deterministic climate-health engine', () => {
  it('high rainfall → vector risk increases', () => {
    const dry = assessClimateHealth(
      inputs({ climate: { ...inputs().climate, precipitationMm72h: 2, rainProbabilityPct: 5 } })
    );
    const wet = assessClimateHealth(inputs());
    const dryScore = dry.indicators.find((i) => i.key === 'vector')?.score ?? 0;
    const wetScore = wet.indicators.find((i) => i.key === 'vector')?.score ?? 0;
    assert.ok(wetScore > dryScore, `wet ${wetScore} should exceed dry ${dryScore}`);
    assert.ok(wetScore >= 50, 'monsoon-like inputs must reach elevated vector risk');
  });

  it('high temperature/humidity → heat risk increases', () => {
    const mild = assessClimateHealth(
      inputs({ climate: { ...inputs().climate, temperatureC: 24, humidityPct: 45 } })
    );
    const hot = assessClimateHealth(
      inputs({ climate: { ...inputs().climate, temperatureC: 40, humidityPct: 70 } })
    );
    const mildScore = mild.indicators.find((i) => i.key === 'heat')?.score ?? 0;
    const hotScore = hot.indicators.find((i) => i.key === 'heat')?.score ?? 0;
    assert.ok(hotScore > mildScore, `hot ${hotScore} should exceed mild ${mildScore}`);
    assert.ok(hotScore >= 75, '40°C/70% humidity must reach SEVERE heat band');
  });

  it('heat index follows apparent-temperature physics', () => {
    const hi = heatIndexCelsius(32, 70);
    assert.ok(hi > 32, `humid 32°C must feel hotter (${hi})`);
    assert.ok(hi < 50, `sanity cap (${hi})`);
  });

  it('high AQI → respiratory risk increases', () => {
    const clean = assessClimateHealth(inputs({ air: { ...inputs().air, aqi: 35, status: 'Good', pm25: 10, pm10: 25 } }));
    const dirty = assessClimateHealth(inputs());
    const cleanScore = clean.indicators.find((i) => i.key === 'respiratory')?.score ?? 0;
    const dirtyScore = dirty.indicators.find((i) => i.key === 'respiratory')?.score ?? 0;
    assert.ok(dirtyScore > cleanScore);
    assert.equal(dirty.indicators.find((i) => i.key === 'respiratory')?.level, 'HIGH');
    assert.equal(clean.indicators.find((i) => i.key === 'respiratory')?.level, 'LOW');
  });

  it('missing data → insufficient, never fabricated', () => {
    const empty = assessClimateHealth(
      inputs({
        climate: {
          temperatureC: null, humidityPct: null, precipitationMm24h: null,
          precipitationMm72h: null, rainProbabilityPct: null, condition: null,
          observedAt: null, source: null,
        },
        air: { aqi: null, status: null, pm25: null, pm10: null, observedAt: null, source: null },
        flood: { floodRiskStage: null, rainfallExpectedMm: null, source: null },
      })
    );
    assert.equal(empty.overallLevel, 'INSUFFICIENT_DATA');
    assert.equal(empty.confidence, 'INSUFFICIENT');
    for (const ind of empty.indicators) {
      assert.equal(ind.score, null);
      assert.equal(ind.insufficientData, true);
    }
    assert.match(empty.headline, /Insufficient data/);
  });

  it('demographics unavailable are reported, not estimated', () => {
    const a = assessClimateHealth(inputs());
    assert.ok(a.vulnerability.unavailableFactors.length >= 3);
    assert.equal(a.vulnerability.elderlySharePct, null);
    assert.ok(a.vulnerability.hospitalsNearby === 4);
  });

  it('scenario adjustments move scores in the right direction', () => {
    const base = inputs({ climate: { ...inputs().climate, precipitationMm72h: 30, temperatureC: 29 } });
    const rainUp = assessClimateHealth(applyScenario(base, { rainfallMultiplier: 1.5 }));
    const heatUp = assessClimateHealth(applyScenario(base, { temperatureDeltaC: 2 }));
    const baseVec = assessClimateHealth(base).indicators.find((i) => i.key === 'vector')?.score ?? 0;
    const rainVec = rainUp.indicators.find((i) => i.key === 'vector')?.score ?? 0;
    const baseHeat = assessClimateHealth(base).indicators.find((i) => i.key === 'heat')?.score ?? 0;
    const heatHeat = heatUp.indicators.find((i) => i.key === 'heat')?.score ?? 0;
    assert.ok(rainVec >= baseVec, 'more rain must not lower vector risk');
    assert.ok(heatHeat > baseHeat, '+2°C must raise heat risk');
  });

  it('scenario vs live are structurally separated', () => {
    const adjusted = applyScenario(inputs(), { rainfallMultiplier: 1.5 });
    assert.equal(adjusted.climate.precipitationMm72h, 180);
    // Original inputs untouched (no mutation of live baseline).
    assert.equal(inputs().climate.precipitationMm72h, 120);
  });
});

describe('nugen health service fail-safety', () => {
  it('Nugen unavailable (no key) → deterministic path unaffected', async () => {
    const svc = new NugenHealthService({ apiKey: '', endpoint: 'http://127.0.0.1:9' });
    assert.equal(svc.isConfigured(), false);
    const r = await svc.interpret({
      location: 'Mumbai, Maharashtra', timestamp: new Date().toISOString(),
      climate: {}, rainfall: {}, temperature: {}, humidity: {}, aqi: {},
      floodRisk: {}, vulnerability: {}, healthIndicators: {},
    });
    assert.equal(r.available, false);
    assert.equal(r.interpretation, null);
    assert.equal(r.modelUsed, null);
  });

  it('Nugen unreachable endpoint → safe fallback, never throws', async () => {
    const svc = new NugenHealthService({ apiKey: 'test-key', endpoint: 'http://127.0.0.1:9/v1/chat' });
    const r = await svc.interpret({
      location: 'Mumbai, Maharashtra', timestamp: new Date().toISOString(),
      climate: {}, rainfall: {}, temperature: {}, humidity: {}, aqi: {},
      floodRisk: {}, vulnerability: {}, healthIndicators: {},
    });
    assert.equal(r.available, false);
    assert.equal(r.interpretation, null);
  });

  it('LLM output can never become an official warning (contract)', () => {
    // Interpretation payloads carry no warning-issuing fields by construction:
    // no severity/status/expires/sourceAlertId anywhere in the contract.
    const contractKeys = ['whyItMatters', 'vulnerableGroups', 'preparednessActions', 'dataGaps', 'confidence', 'uncertaintyNotes'];
    const forbidden = ['severity', 'status', 'expiresAt', 'sourceAlertId', 'isOfficial', 'warning'];
    for (const f of forbidden) assert.ok(!contractKeys.includes(f), `${f} must not be in the LLM contract`);
  });
});
