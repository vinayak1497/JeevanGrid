/**
 * ClimateHealthRiskEngine — deterministic, evidence-driven environmental
 * health risk indicators for JeevanGrid.
 *
 * These are ENVIRONMENTAL RISK INDICATORS, not disease diagnoses. Every score
 * is computed from live climate inputs with documented weights. Missing inputs
 * produce "Insufficient data", never a fabricated score. An LLM (Nugen) may
 * interpret the evidence downstream but can NEVER override these calculations.
 */

export type HealthRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' | 'INSUFFICIENT_DATA';

export interface ClimateInputs {
  temperatureC: number | null;
  humidityPct: number | null;
  precipitationMm24h: number | null;
  precipitationMm72h: number | null;
  rainProbabilityPct: number | null;
  condition: string | null;
  observedAt: string | null;
  source: string | null;
}

export interface AirInputs {
  aqi: number | null;
  status: string | null;
  pm25: number | null;
  pm10: number | null;
  observedAt: string | null;
  source: string | null;
}

export interface FloodInputs {
  floodRiskStage: string | null;
  rainfallExpectedMm: number | null;
  source: string | null;
}

export interface VulnerabilityInputs {
  hospitalsNearby: number | null;
  totalBedsNearby: number | null;
  availableBedsNearby: number | null;
  // Demographics are NOT available from any wired authoritative source.
  // They stay null and are reported as unavailable — never estimated.
  elderlySharePct: number | null;
  childrenSharePct: number | null;
  populationDensityPerKm2: number | null;
}

export interface EvidenceContributor {
  variable: string;
  value: string;
  influence: string;
}

export interface HealthIndicator {
  key: 'vector' | 'heat' | 'respiratory' | 'waterborne';
  label: string;
  level: HealthRiskLevel;
  /** 0-100 environmental suitability/exposure score. Null when data insufficient. */
  score: number | null;
  evidence: string[];
  contributors: EvidenceContributor[];
  insufficientData: boolean;
  observedAt: string | null;
}

export interface VulnerabilityReport {
  hospitalsNearby: number | null;
  totalBedsNearby: number | null;
  availableBedsNearby: number | null;
  elderlySharePct: number | null;
  childrenSharePct: number | null;
  populationDensityPerKm2: number | null;
  unavailableFactors: string[];
}

export interface ClimateHealthAssessment {
  headline: string;
  overallLevel: HealthRiskLevel;
  indicators: HealthIndicator[];
  vulnerability: VulnerabilityReport;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  liveInputCount: number;
  calculatedAt: string;
}

function clampScore(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function levelFor(score: number): HealthRiskLevel {
  if (score >= 75) return 'SEVERE';
  if (score >= 50) return 'HIGH';
  if (score >= 30) return 'MODERATE';
  return 'LOW';
}

/**
 * Heat index (apparent temperature) via the Rothfusz regression (NOAA).
 * Input Celsius + relative humidity % → apparent temperature Celsius.
 */
export function heatIndexCelsius(tempC: number, rhPct: number): number {
  const tF = (tempC * 9) / 5 + 32;
  const r = rhPct;
  let hiF =
    -42.379 +
    2.04901523 * tF +
    10.14333127 * r -
    0.22475541 * tF * r -
    0.00683783 * tF * tF -
    0.05481717 * r * r +
    0.00122874 * tF * tF * r +
    0.00085282 * tF * r * r -
    0.00000199 * tF * tF * r * r;
  // Low-humidity / low-temperature adjustment (NOAA).
  if (r < 13 && tF >= 80 && tF <= 112) {
    hiF -= ((13 - r) / 4) * Math.sqrt((17 - Math.abs(tF - 95)) / 17);
  } else if (r > 85 && tF >= 80 && tF <= 87) {
    hiF += ((r - 85) / 10) * ((87 - tF) / 5);
  }
  return Math.round((((hiF - 32) * 5) / 9) * 10) / 10;
}

/** HEAT: apparent temperature bands → environmental heat-illness risk. */
function assessHeat(climate: ClimateInputs): HealthIndicator {
  const base: HealthIndicator = {
    key: 'heat',
    label: 'Heat Illness Risk',
    level: 'INSUFFICIENT_DATA',
    score: null,
    evidence: [],
    contributors: [],
    insufficientData: true,
    observedAt: climate.observedAt,
  };
  if (climate.temperatureC === null || climate.humidityPct === null) {
    base.evidence.push('Insufficient data: live temperature or humidity unavailable.');
    return base;
  }
  const hi = heatIndexCelsius(climate.temperatureC, climate.humidityPct);
  // Documented bands on apparent temperature (environmental exposure, not diagnosis).
  let score: number;
  if (hi >= 41) score = 80 + Math.min(20, (hi - 41) * 2);
  else if (hi >= 32) score = 50 + ((hi - 32) / 9) * 30;
  else if (hi >= 27) score = 30 + ((hi - 27) / 5) * 20;
  else score = Math.max(5, ((hi - 20) / 7) * 30);
  return {
    ...base,
    level: levelFor(clampScore(score)),
    score: clampScore(score),
    insufficientData: false,
    evidence: [
      `Apparent temperature ${hi}°C (air ${climate.temperatureC}°C, humidity ${climate.humidityPct}%).`,
      hi >= 41
        ? 'Extreme heat-stress band: avoid outdoor exertion, cool vulnerable people.'
        : hi >= 32
          ? 'High heat-discomfort band: hydrate, shade outdoor labour, check on elders.'
          : hi >= 27
            ? 'Moderate heat band: normal caution for prolonged exertion.'
            : 'Low heat band: no heat-driven staging.',
    ],
    contributors: [
      { variable: 'Air temperature', value: `${climate.temperatureC}°C`, influence: 'Primary driver of apparent temperature' },
      { variable: 'Relative humidity', value: `${climate.humidityPct}%`, influence: 'Amplifies heat stress above ~60%' },
      { variable: 'Apparent temperature (Rothfusz)', value: `${hi}°C`, influence: 'Band thresholds: 27 / 32 / 41°C' },
    ],
  };
}

/**
 * VECTOR: mosquito/vector suitability from temperature window + humidity +
 * recent rainfall (breeding sites) + persistent wet conditions.
 * Weights: temperature 30%, humidity 20%, rainfall-72h 35%, persistence 15%.
 */
function assessVector(climate: ClimateInputs): HealthIndicator {
  const base: HealthIndicator = {
    key: 'vector',
    label: 'Dengue / Vector Risk',
    level: 'INSUFFICIENT_DATA',
    score: null,
    evidence: [],
    contributors: [],
    insufficientData: true,
    observedAt: climate.observedAt,
  };
  const { temperatureC: t, humidityPct: h, precipitationMm72h: rain72, rainProbabilityPct: prob } = climate;
  if (t === null || h === null || rain72 === null) {
    base.evidence.push('Insufficient data: temperature, humidity or 72h rainfall unavailable.');
    return base;
  }
  // Temperature suitability: Aedes aegypti thrives ~22-32°C.
  let tempScore: number;
  if (t >= 22 && t <= 32) tempScore = 100;
  else if ((t >= 18 && t < 22) || (t > 32 && t <= 36)) tempScore = 60;
  else if ((t >= 15 && t < 18) || (t > 36 && t <= 40)) tempScore = 30;
  else tempScore = 10;
  // Humidity: eggs/larvae survive better in humid air.
  const humScore = h >= 80 ? 100 : h >= 60 ? 65 : h >= 40 ? 35 : 15;
  // 72h rainfall: stagnant water after rain creates breeding sites.
  const rainScore = rain72 >= 100 ? 100 : rain72 >= 50 ? 75 : rain72 >= 20 ? 50 : rain72 >= 5 ? 25 : 10;
  // Persistence: high rain probability keeps sites wet.
  const persistScore = (prob ?? 0) >= 80 ? 100 : (prob ?? 0) >= 50 ? 60 : (prob ?? 0) >= 25 ? 35 : 15;
  const score = tempScore * 0.3 + humScore * 0.2 + rainScore * 0.35 + persistScore * 0.15;
  return {
    ...base,
    level: levelFor(clampScore(score)),
    score: clampScore(score),
    insufficientData: false,
    evidence: [
      `72h rainfall ${rain72} mm with ${t}°C / ${h}% humidity — ${rain72 >= 50 ? 'standing-water likely; clearcoolers, tyres, open containers' : 'limited fresh breeding-site formation'}.`,
      `Temperature ${t >= 22 && t <= 32 ? 'inside' : 'outside'} the 22–32°C optimal vector-activity window.`,
    ],
    contributors: [
      { variable: 'Temperature suitability', value: `${t}°C → ${tempScore}/100`, influence: 'Weight 30%' },
      { variable: 'Humidity', value: `${h}% → ${humScore}/100`, influence: 'Weight 20%' },
      { variable: 'Rainfall (72h)', value: `${rain72} mm → ${rainScore}/100`, influence: 'Weight 35% — breeding sites' },
      { variable: 'Wet persistence', value: `${prob ?? 'n/a'}% rain probability → ${persistScore}/100`, influence: 'Weight 15%' },
    ],
  };
}

/** RESPIRATORY: US AQI bands → exposure risk (PM2.5/PM10 as supporting evidence). */
function assessRespiratory(air: AirInputs): HealthIndicator {
  const base: HealthIndicator = {
    key: 'respiratory',
    label: 'Respiratory Exposure',
    level: 'INSUFFICIENT_DATA',
    score: null,
    evidence: [],
    contributors: [],
    insufficientData: true,
    observedAt: air.observedAt,
  };
  if (air.aqi === null || air.aqi <= 0) {
    base.evidence.push('Insufficient data: live AQI unavailable.');
    return base;
  }
  // Score scales with AQI (300+ saturates at 100). Level follows the same
  // bands as Open-Meteo/CPCB-style reporting: Poor (151+) → HIGH.
  const score = Math.min(100, Math.round(air.aqi / 3));
  const level: HealthRiskLevel =
    air.aqi > 300 ? 'SEVERE' : air.aqi > 150 ? 'HIGH' : air.aqi > 100 ? 'MODERATE' : 'LOW';
  return {
    ...base,
    level,
    score,
    insufficientData: false,
    evidence: [
      `US AQI ${air.aqi}${air.status ? ` (${air.status})` : ''}${air.pm25 !== null ? `, PM2.5 ${air.pm25} µg/m³` : ''}${air.pm10 !== null ? `, PM10 ${air.pm10} µg/m³` : ''}.`,
      level === 'LOW'
        ? 'Acceptable for routine outdoor activity.'
        : 'Sensitive groups should limit prolonged outdoor exertion; consider masks at HIGH+.',
    ],
    contributors: [
      { variable: 'US AQI', value: `${air.aqi}`, influence: 'Primary: score = min(100, AQI/3)' },
      { variable: 'PM2.5', value: air.pm25 !== null ? `${air.pm25} µg/m³` : 'unavailable', influence: 'Supporting evidence' },
      { variable: 'PM10', value: air.pm10 !== null ? `${air.pm10} µg/m³` : 'unavailable', influence: 'Supporting evidence' },
    ],
  };
}

/**
 * WATERBORNE: heavy rainfall + flood/waterlogging staging → exposure risk
 * (contaminated water, leptospirosis/ADD pathways). Flood stage text comes
 * from the JeevanGrid risk engine (live rainfall + official flood alerts).
 */
function assessWaterborne(climate: ClimateInputs, flood: FloodInputs): HealthIndicator {
  const base: HealthIndicator = {
    key: 'waterborne',
    label: 'Waterborne Exposure',
    level: 'INSUFFICIENT_DATA',
    score: null,
    evidence: [],
    contributors: [],
    insufficientData: true,
    observedAt: climate.observedAt,
  };
  if (climate.precipitationMm24h === null && !flood.floodRiskStage) {
    base.evidence.push('Insufficient data: rainfall and flood staging unavailable.');
    return base;
  }
  const rain24 = climate.precipitationMm24h ?? 0;
  const stage = (flood.floodRiskStage || '').toLowerCase();
  const stageScore = /warning|severe|critical/.test(stage) ? 90 : /moderate|watch|rising/.test(stage) ? 60 : /normal/.test(stage) ? 15 : 30;
  const rainScore = rain24 >= 100 ? 95 : rain24 >= 50 ? 70 : rain24 >= 20 ? 45 : rain24 >= 5 ? 25 : 10;
  const score = rainScore * 0.55 + stageScore * 0.45;
  return {
    ...base,
    level: levelFor(clampScore(score)),
    score: clampScore(score),
    insufficientData: false,
    evidence: [
      `24h rainfall ${climate.precipitationMm24h !== null ? `${rain24} mm` : 'unavailable'}.`,
      flood.floodRiskStage ? `Flood staging: ${flood.floodRiskStage}.` : 'No flood staging available.',
      clampScore(score) >= 50
        ? 'Boil drinking water or use chlorine tablets; avoid wading through floodwater.'
        : 'Standard water hygiene sufficient; maintain drainage around homes.',
    ],
    contributors: [
      { variable: 'Rainfall (24h)', value: climate.precipitationMm24h !== null ? `${rain24} mm → ${rainScore}/100` : 'unavailable', influence: 'Weight 55%' },
      { variable: 'Flood staging', value: flood.floodRiskStage || 'unavailable', influence: 'Weight 45%' },
    ],
  };
}

export function assessVulnerability(input: VulnerabilityInputs): VulnerabilityReport {
  const unavailableFactors: string[] = [];
  if (input.elderlySharePct === null) unavailableFactors.push('elderly population share — no authoritative demographic source wired');
  if (input.childrenSharePct === null) unavailableFactors.push('children/infant share — no authoritative demographic source wired');
  if (input.populationDensityPerKm2 === null) unavailableFactors.push('population density — no authoritative demographic source wired');
  return {
    hospitalsNearby: input.hospitalsNearby,
    totalBedsNearby: input.totalBedsNearby,
    availableBedsNearby: input.availableBedsNearby,
    elderlySharePct: input.elderlySharePct,
    childrenSharePct: input.childrenSharePct,
    populationDensityPerKm2: input.populationDensityPerKm2,
    unavailableFactors,
  };
}

export interface EngineInputs {
  climate: ClimateInputs;
  air: AirInputs;
  flood: FloodInputs;
  vulnerability: VulnerabilityInputs;
}

export function assessClimateHealth(inputs: EngineInputs, calculatedAt?: string): ClimateHealthAssessment {
  const indicators = [
    assessVector(inputs.climate),
    assessHeat(inputs.climate),
    assessRespiratory(inputs.air),
    assessWaterborne(inputs.climate, inputs.flood),
  ];
  const live = indicators.filter((i) => !i.insufficientData);
  const vulnerability = assessVulnerability(inputs.vulnerability);
  const at = calculatedAt || new Date().toISOString();

  if (live.length < 2) {
    return {
      headline: 'Insufficient data for an environmental health assessment right now.',
      overallLevel: 'INSUFFICIENT_DATA',
      indicators,
      vulnerability,
      confidence: 'INSUFFICIENT',
      liveInputCount: live.length,
      calculatedAt: at,
    };
  }
  const top = [...live].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const overallLevel = top.level === 'INSUFFICIENT_DATA' ? 'LOW' : top.level;
  const elevated = live.filter((i) => i.score !== null && i.score >= 50);
  return {
    headline:
      elevated.length === 0
        ? 'Current environmental conditions indicate no elevated health exposure risk.'
        : `Current environmental conditions indicate elevated ${elevated.map((i) => i.label.toLowerCase()).join(' + ')}.`,
    overallLevel,
    indicators,
    vulnerability,
    confidence: live.length === 4 ? 'HIGH' : live.length === 3 ? 'MEDIUM' : 'LOW',
    liveInputCount: live.length,
    calculatedAt: at,
  };
}

export interface ScenarioAdjustments {
  rainfallMultiplier?: number;
  temperatureDeltaC?: number;
  aqiDelta?: number;
}

/** Preparedness simulator: deterministic re-calculation on adjusted inputs. */
export function applyScenario(inputs: EngineInputs, adj: ScenarioAdjustments): EngineInputs {
  const mult = adj.rainfallMultiplier ?? 1;
  const dT = adj.temperatureDeltaC ?? 0;
  const dAqi = adj.aqiDelta ?? 0;
  const scaleRain = (v: number | null) =>
    v === null ? null : Math.round(v * mult * 10) / 10;
  return {
    climate: {
      ...inputs.climate,
      temperatureC: inputs.climate.temperatureC === null ? null : Math.round((inputs.climate.temperatureC + dT) * 10) / 10,
      precipitationMm24h: scaleRain(inputs.climate.precipitationMm24h),
      precipitationMm72h: scaleRain(inputs.climate.precipitationMm72h),
      rainProbabilityPct:
        inputs.climate.rainProbabilityPct === null
          ? null
          : Math.min(100, Math.round(inputs.climate.rainProbabilityPct * (mult > 1 ? 1.15 : 1))),
    },
    air: {
      ...inputs.air,
      aqi: inputs.air.aqi === null ? null : Math.max(0, Math.round(inputs.air.aqi + dAqi)),
    },
    flood: { ...inputs.flood },
    vulnerability: { ...inputs.vulnerability },
  };
}
