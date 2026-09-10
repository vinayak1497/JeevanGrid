/**
 * healthAssessmentService — orchestrates the Climate → Health Intelligence
 * assessment from EXISTING JeevanGrid services (no duplication):
 * geoService → openMeteoService → aqiService → riskEngineService → prisma.
 *
 * Flow: LIVE DATA → deterministic ClimateHealthRiskEngine → structured
 * evidence → Nugen interpretation (additive, never overriding) → persist.
 * Short in-memory cache (15 min) keeps dashboards fast.
 */

import { prisma } from '../../utils/prisma';
import { geoService } from '../geoService';
import { openMeteoService } from '../openMeteoService';
import { riskEngineService } from '../riskEngine';
import {
  assessClimateHealth,
  applyScenario,
  type ClimateHealthAssessment,
  type EngineInputs,
  type ScenarioAdjustments,
} from './climateHealthRiskEngine';
import { nugenHealthService, type NugenEvidence, type NugenHealthResult } from '../ai/nugenHealthService';

export interface HealthAssessmentPayload {
  location: string;
  district: string;
  state: string;
  coordinates: { lat: number; lng: number };
  assessment: ClimateHealthAssessment;
  evidence: NugenEvidence;
  nugen: NugenHealthResult;
  provenance: {
    dataSources: string[];
    calculationTimestamp: string;
    nugenModelUsed: string | null;
    nugenInterpretationTimestamp: string | null;
    assessmentId: string | null;
  };
}

export interface ScenarioPayload extends HealthAssessmentPayload {
  scenario: true;
  scenarioLabel: string;
  adjustments: ScenarioAdjustments;
}

const cache = new Map<string, { payload: HealthAssessmentPayload; ts: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

async function buildEngineInputs(
  lat: number,
  lng: number,
  district: string,
  state: string
): Promise<{ inputs: EngineInputs; sources: string[] }> {
  const sources: string[] = [];
  const [weather, air, rain72, risk, hospitals] = await Promise.all([
    openMeteoService.getCurrentWeatherForCoords(lat, lng).catch(() => null),
    openMeteoService.getCurrentAirQualityForCoords(lat, lng).catch(() => null),
    openMeteoService.getPrecipitation72hForCoords(lat, lng).catch(() => null),
    riskEngineService.analyzeLocationRisk(`${district}, ${state}`).catch(() => null),
    prisma.hospital
      .findMany({ where: { OR: [{ state }, { district }] }, take: 50 })
      .catch(() => []),
  ]);
  if (weather) sources.push('Open-Meteo weather (live)');
  if (air) sources.push('Open-Meteo air quality / CAMS (live)');
  if (rain72 !== null) sources.push('Open-Meteo precipitation history, 72h (live)');
  if (risk) sources.push('JeevanGrid risk engine flood staging (live model output)');

  const floodStage = risk?.floodRiskStage ?? null;
  if (risk) sources.push('JeevanGrid facility registry (hospitals)');

  return {
    inputs: {
      climate: {
        temperatureC: weather?.temperature ?? null,
        humidityPct: weather?.humidity ?? null,
        precipitationMm24h: weather?.precipitationMm24h ?? risk?.rainfallExpectedMm ?? null,
        precipitationMm72h: rain72,
        rainProbabilityPct: weather?.rainProbability ?? null,
        condition: weather?.condition ?? null,
        observedAt: weather?.observedAt ?? null,
        source: weather ? 'open-meteo' : null,
      },
      air: {
        aqi: air?.aqi && air.aqi > 0 ? air.aqi : null,
        status: air?.status ?? null,
        pm25: air?.pm25 ?? null,
        pm10: air?.pm10 ?? null,
        observedAt: air?.observedAt ?? null,
        source: air ? 'open-meteo-aq' : null,
      },
      flood: {
        floodRiskStage: floodStage,
        rainfallExpectedMm: risk?.rainfallExpectedMm ?? null,
        source: risk ? 'risk-engine' : null,
      },
      vulnerability: {
        hospitalsNearby: hospitals.length || null,
        totalBedsNearby: hospitals.length
          ? hospitals.reduce((a, h: any) => a + (h.totalBeds || 0), 0)
          : null,
        availableBedsNearby: hospitals.length
          ? hospitals.reduce((a, h: any) => a + (h.availableBeds || 0), 0)
          : null,
        elderlySharePct: null,
        childrenSharePct: null,
        populationDensityPerKm2: null,
      },
    },
    sources,
  };
}

function buildEvidence(
  location: string,
  inputs: EngineInputs,
  assessment: ClimateHealthAssessment
): NugenEvidence {
  const byKey = Object.fromEntries(assessment.indicators.map((i) => [i.key, i]));
  return {
    location,
    timestamp: assessment.calculatedAt,
    climate: {
      temperatureC: inputs.climate.temperatureC,
      humidityPct: inputs.climate.humidityPct,
      condition: inputs.climate.condition,
      observedAt: inputs.climate.observedAt,
    },
    rainfall: {
      mm24h: inputs.climate.precipitationMm24h,
      mm72h: inputs.climate.precipitationMm72h,
      rainProbabilityPct: inputs.climate.rainProbabilityPct,
    },
    temperature: { celsius: inputs.climate.temperatureC },
    humidity: { percent: inputs.climate.humidityPct },
    aqi: {
      usAqi: inputs.air.aqi,
      status: inputs.air.status,
      pm25: inputs.air.pm25,
      pm10: inputs.air.pm10,
    },
    floodRisk: {
      stage: inputs.flood.floodRiskStage,
      rainfallExpectedMm: inputs.flood.rainfallExpectedMm,
    },
    vulnerability: {
      hospitalsNearby: inputs.vulnerability.hospitalsNearby,
      availableBedsNearby: inputs.vulnerability.availableBedsNearby,
      demographics: 'unavailable — no authoritative demographic source wired',
    },
    healthIndicators: {
      vector: { level: (byKey.vector as any)?.level, score: (byKey.vector as any)?.score },
      heat: { level: (byKey.heat as any)?.level, score: (byKey.heat as any)?.score },
      respiratory: { level: (byKey.respiratory as any)?.level, score: (byKey.respiratory as any)?.score },
      waterborne: { level: (byKey.waterborne as any)?.level, score: (byKey.waterborne as any)?.score },
      overallLevel: assessment.overallLevel,
      confidence: assessment.confidence,
    },
  };
}

export async function getHealthAssessment(
  locationQuery: string,
  opts: { withNugen?: boolean } = {}
): Promise<HealthAssessmentPayload> {
  const withNugen = opts.withNugen !== false;
  const cacheKey = `${locationQuery.trim().toLowerCase()}|nugen=${withNugen}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.payload;

  const resolved = await geoService.resolveLocationLive(locationQuery);
  const location = `${resolved.city}, ${resolved.state}`;
  const { inputs, sources } = await buildEngineInputs(resolved.lat, resolved.lng, resolved.district, resolved.state);
  const assessment = assessClimateHealth(inputs);
  const evidence = buildEvidence(location, inputs, assessment);
  const nugen = withNugen
    ? await nugenHealthService.interpret(evidence)
    : {
        available: false,
        modelUsed: null,
        interpretation: null,
        interpretedAt: null,
        reason: 'Nugen interpretation skipped by caller.',
      };

  let assessmentId: string | null = null;
  try {
    const row = await prisma.healthAssessment.create({
      data: {
        location,
        district: resolved.district,
        state: resolved.state,
        latitude: resolved.lat,
        longitude: resolved.lng,
        inputSnapshot: JSON.stringify({ climate: inputs.climate, air: inputs.air, flood: inputs.flood }),
        riskScores: JSON.stringify(
          Object.fromEntries(assessment.indicators.map((i) => [i.key, { level: i.level, score: i.score }]))
        ),
        interpretation: nugen.interpretation ? JSON.stringify(nugen.interpretation) : null,
        nugenModel: nugen.modelUsed,
        confidence: assessment.confidence,
        isScenario: false,
      },
    });
    assessmentId = row.id;
  } catch (e) {
    console.warn('[health] persist failed (non-fatal):', (e as Error).message.slice(0, 160));
  }

  const payload: HealthAssessmentPayload = {
    location,
    district: resolved.district,
    state: resolved.state,
    coordinates: { lat: resolved.lat, lng: resolved.lng },
    assessment,
    evidence,
    nugen,
    provenance: {
      dataSources: sources.length ? sources : ['No live inputs reachable — assessment marked insufficient'],
      calculationTimestamp: assessment.calculatedAt,
      nugenModelUsed: nugen.modelUsed,
      nugenInterpretationTimestamp: nugen.interpretedAt,
      assessmentId,
    },
  };
  cache.set(cacheKey, { payload, ts: Date.now() });
  return payload;
}

const SCENARIO_PRESETS: Record<string, { adjustments: ScenarioAdjustments; label: string }> = {
  rain25: { adjustments: { rainfallMultiplier: 1.25 }, label: '+25% rainfall scenario' },
  rain50: { adjustments: { rainfallMultiplier: 1.5 }, label: '+50% rainfall scenario' },
  heat2: { adjustments: { temperatureDeltaC: 2 }, label: '+2°C temperature scenario' },
  aqi50: { adjustments: { aqiDelta: 50 }, label: 'AQI +50 scenario' },
};

export function describeScenarioPreset(key: string): { adjustments: ScenarioAdjustments; label: string } | null {
  return SCENARIO_PRESETS[key] ?? null;
}

export async function getHealthScenario(
  locationQuery: string,
  presetKey: string,
  opts: { withNugen?: boolean } = {}
): Promise<ScenarioPayload> {
  const preset = describeScenarioPreset(presetKey);
  if (!preset) throw new Error(`Unknown scenario preset '${presetKey}'. Use rain25, rain50, heat2 or aqi50.`);
  // Reuse the live baseline (cached) so scenario deltas apply to real inputs.
  const baseline = await getHealthAssessment(locationQuery, { withNugen: false });
  // Rebuild full EngineInputs shape (evidence uses flattened keys).
  const fullInputs: EngineInputs = {
    climate: {
      temperatureC: (baseline.evidence.climate as any).temperatureC ?? null,
      humidityPct: (baseline.evidence.humidity as any).percent ?? null,
      precipitationMm24h: (baseline.evidence.rainfall as any).mm24h ?? null,
      precipitationMm72h: (baseline.evidence.rainfall as any).mm72h ?? null,
      rainProbabilityPct: (baseline.evidence.rainfall as any).rainProbabilityPct ?? null,
      condition: (baseline.evidence.climate as any).condition ?? null,
      observedAt: (baseline.evidence.climate as any).observedAt ?? null,
      source: 'scenario-adjusted live baseline',
    },
    air: {
      aqi: (baseline.evidence.aqi as any).usAqi ?? null,
      status: (baseline.evidence.aqi as any).status ?? null,
      pm25: (baseline.evidence.aqi as any).pm25 ?? null,
      pm10: (baseline.evidence.aqi as any).pm10 ?? null,
      observedAt: null,
      source: 'scenario-adjusted live baseline',
    },
    flood: {
      floodRiskStage: (baseline.evidence.floodRisk as any).stage ?? null,
      rainfallExpectedMm: (baseline.evidence.floodRisk as any).rainfallExpectedMm ?? null,
      source: 'scenario-adjusted live baseline',
    },
    vulnerability: {
      hospitalsNearby: (baseline.evidence.vulnerability as any).hospitalsNearby ?? null,
      totalBedsNearby: null,
      availableBedsNearby: (baseline.evidence.vulnerability as any).availableBedsNearby ?? null,
      elderlySharePct: null,
      childrenSharePct: null,
      populationDensityPerKm2: null,
    },
  };
  const adjusted = applyScenario(fullInputs, preset.adjustments);
  const assessment = assessClimateHealth(adjusted);
  const evidence = buildEvidence(`${baseline.location} (${preset.label})`, adjusted, assessment);
  const nugen =
    opts.withNugen !== false
      ? await nugenHealthService.interpret(evidence, preset.label)
      : { available: false, modelUsed: null, interpretation: null, interpretedAt: null, reason: 'skipped' };
  return {
    ...baseline,
    assessment,
    evidence,
    nugen,
    provenance: {
      ...baseline.provenance,
      calculationTimestamp: assessment.calculatedAt,
      nugenModelUsed: nugen.modelUsed,
      nugenInterpretationTimestamp: nugen.interpretedAt,
      assessmentId: null,
    },
    scenario: true as const,
    scenarioLabel: preset.label,
    adjustments: preset.adjustments,
  };
}
