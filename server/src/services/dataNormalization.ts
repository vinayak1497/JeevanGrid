import { LiveWeather, LiveAirQuality } from './openMeteoService';
import { QuakeSummary } from './usgsService';

/**
 * DATA NORMALIZATION layer.
 * Converts heterogeneous upstream feeds (Open-Meteo, USGS, Overpass,
 * OpenWeather, CPCB-style demo records) into one canonical engine schema
 * consumed by the RISK ENGINE and the JEEVANGRID API.
 */

export interface NormalizedTelemetry {
  location: string;
  coordinates: { lat: number; lng: number };
  temperatureC: number;
  condition: string;
  humidityPct: number;
  windKph: number;
  rainProbabilityPct: number;
  rainfallMm24h: number;
  usAqi: number | null;
  aqiStatus: string | null;
  recentQuakes: number;
  strongestQuakeMagnitude: number | null;
  liveSources: string[];
  demoSources: string[];
}

export function normalizeTelemetry(input: {
  location: string;
  coordinates: { lat: number; lng: number };
  weather: LiveWeather | null;
  fallbackWeather?: { temperature: number; condition: string; humidity: number; windSpeed: number; rainProbability: number };
  airQuality: LiveAirQuality | null;
  quakes: QuakeSummary | null;
}): NormalizedTelemetry {
  const liveSources: string[] = [];
  const demoSources: string[] = [];

  let temperatureC = 0;
  let condition = 'Unknown';
  let humidityPct = 0;
  let windKph = 0;
  let rainProbabilityPct = 0;
  let rainfallMm24h = 0;

  if (input.weather) {
    temperatureC = input.weather.temperature;
    condition = input.weather.condition;
    humidityPct = input.weather.humidity;
    windKph = input.weather.windSpeedKph;
    rainProbabilityPct = input.weather.rainProbability;
    rainfallMm24h = input.weather.precipitationMm24h;
    liveSources.push('open-meteo');
  } else if (input.fallbackWeather) {
    temperatureC = input.fallbackWeather.temperature;
    condition = input.fallbackWeather.condition;
    humidityPct = input.fallbackWeather.humidity;
    windKph = input.fallbackWeather.windSpeed;
    rainProbabilityPct = input.fallbackWeather.rainProbability;
    demoSources.push('demo-climatology');
  }

  let usAqi: number | null = null;
  let aqiStatus: string | null = null;
  if (input.airQuality) {
    usAqi = input.airQuality.aqi;
    aqiStatus = input.airQuality.status;
    liveSources.push('open-meteo-aq');
  } else {
    demoSources.push('demo-aqi');
  }

  const recentQuakes = input.quakes?.count ?? 0;
  const strongestQuakeMagnitude = input.quakes?.strongest?.magnitude ?? null;
  if (input.quakes && input.quakes.source === 'usgs') liveSources.push('usgs');

  return {
    location: input.location,
    coordinates: input.coordinates,
    temperatureC,
    condition,
    humidityPct,
    windKph,
    rainProbabilityPct,
    rainfallMm24h,
    usAqi,
    aqiStatus,
    recentQuakes,
    strongestQuakeMagnitude,
    liveSources,
    demoSources,
  };
}

/**
 * Deterministic 0-100 risk score blending live telemetry with regional
 * baseline vulnerability. Weights are documented for auditability.
 */
export function computeRiskScore(t: NormalizedTelemetry, baselineScore: number): {
  score: number;
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  contributors: string[];
} {
  let score = baselineScore * 0.55; // regional baseline weight
  const contributors: string[] = [`Regional baseline vulnerability (${baselineScore})`];

  if (t.rainfallMm24h >= 100) {
    score += 28;
    contributors.push(`Extreme 24h rainfall observed (${t.rainfallMm24h} mm)`);
  } else if (t.rainfallMm24h >= 50) {
    score += 16;
    contributors.push(`Heavy 24h rainfall observed (${t.rainfallMm24h} mm)`);
  } else if (t.rainProbabilityPct >= 80) {
    score += 10;
    contributors.push(`Very high rain probability (${t.rainProbabilityPct}%)`);
  } else if (t.rainProbabilityPct >= 50) {
    score += 5;
    contributors.push(`Elevated rain probability (${t.rainProbabilityPct}%)`);
  }

  if (t.windKph >= 60) {
    score += 8;
    contributors.push(`Damaging winds (${t.windKph} km/h)`);
  } else if (t.windKph >= 40) {
    score += 4;
    contributors.push(`Strong winds (${t.windKph} km/h)`);
  }

  if (t.strongestQuakeMagnitude !== null && t.strongestQuakeMagnitude >= 5.5) {
    score += 10;
    contributors.push(`Significant recent earthquake nearby (M${t.strongestQuakeMagnitude})`);
  } else if (t.recentQuakes >= 3) {
    score += 5;
    contributors.push(`${t.recentQuakes} recent earthquakes within 500 km`);
  }

  if (t.usAqi !== null && t.usAqi > 200) {
    score += 4;
    contributors.push(`Hazardous air quality (US AQI ${t.usAqi})`);
  }

  const clamped = Math.max(5, Math.min(97, Math.round(score)));
  const level: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' =
    clamped >= 85 ? 'SEVERE' : clamped >= 70 ? 'HIGH' : clamped >= 40 ? 'MODERATE' : 'LOW';
  return { score: clamped, level, contributors };
}
