import { geoService } from './geoService';

export interface LiveWeather {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeedKph: number;
  rainProbability: number;
  precipitationMm24h: number;
  source: 'open-meteo' | 'none';
  observedAt: string;
}

export interface LiveAirQuality {
  aqi: number; // US AQI
  status: 'Good' | 'Satisfactory' | 'Moderate' | 'Poor' | 'Very Poor' | 'Severe';
  pm25: number;
  pm10: number;
  source: 'open-meteo-aq' | 'none';
  observedAt: string;
}

const weatherCache = new Map<string, { data: LiveWeather; ts: number }>();
const aqCache = new Map<string, { data: LiveAirQuality; ts: number }>();
const WX_TTL = 10 * 60 * 1000;
const AQ_TTL = 15 * 60 * 1000;

const WMO_MAP: Array<{ codes: number[]; label: string }> = [
  { codes: [0], label: 'Clear Sky' },
  { codes: [1], label: 'Mostly Clear' },
  { codes: [2], label: 'Partly Cloudy' },
  { codes: [3], label: 'Overcast' },
  { codes: [45, 48], label: 'Foggy' },
  { codes: [51, 53, 55], label: 'Drizzle' },
  { codes: [56, 57], label: 'Freezing Drizzle' },
  { codes: [61], label: 'Light Rain' },
  { codes: [63], label: 'Rain' },
  { codes: [65], label: 'Heavy Rain' },
  { codes: [66, 67], label: 'Freezing Rain' },
  { codes: [71, 73, 75, 77], label: 'Snowfall' },
  { codes: [80], label: 'Light Showers' },
  { codes: [81], label: 'Rain Showers' },
  { codes: [82], label: 'Violent Showers' },
  { codes: [85, 86], label: 'Snow Showers' },
  { codes: [95], label: 'Thunderstorm' },
  { codes: [96, 99], label: 'Severe Thunderstorm' },
];

function wmoToLabel(code: number): string {
  for (const entry of WMO_MAP) {
    if (entry.codes.includes(code)) return entry.label;
  }
  return 'Partly Cloudy';
}

async function fetchJson(url: string, timeoutMs = 9000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'JeevanGrid-DataEngine/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Open-Meteo integration (free, no API key).
 * docs: https://open-meteo.com/en/docs
 */
export class OpenMeteoService {
  private wxBase: string;
  private aqBase: string;

  constructor() {
    this.wxBase = (process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com').replace(/\/$/, '');
    this.aqBase = (process.env.OPEN_METEO_AQ_BASE_URL || 'https://air-quality-api.open-meteo.com').replace(/\/$/, '');
  }

  public async getCurrentWeather(locationQuery: string): Promise<LiveWeather | null> {
    const resolved = geoService.resolveLocation(locationQuery);
    const key = `${resolved.lat.toFixed(3)},${resolved.lng.toFixed(3)}`;
    const cached = weatherCache.get(key);
    if (cached && Date.now() - cached.ts < WX_TTL) return cached.data;

    try {
      const url =
        `${this.wxBase}/v1/forecast?latitude=${resolved.lat}&longitude=${resolved.lng}` +
        `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m` +
        `&daily=precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=2`;
      const raw: any = await fetchJson(url);
      const cur = raw.current || {};
      const data: LiveWeather = {
        temperature: Math.round(cur.temperature_2m ?? 0),
        condition: wmoToLabel(Number(cur.weather_code ?? 2)),
        humidity: Math.round(cur.relative_humidity_2m ?? 0),
        windSpeedKph: Math.round(cur.wind_speed_10m ?? 0),
        rainProbability: Math.round(raw.daily?.precipitation_probability_max?.[0] ?? 0),
        precipitationMm24h: Math.round((raw.daily?.precipitation_sum?.[0] ?? 0) * 10) / 10,
        source: 'open-meteo',
        observedAt: cur.time || new Date().toISOString(),
      };
      weatherCache.set(key, { data, ts: Date.now() });
      return data;
    } catch (e) {
      console.warn('Open-Meteo weather unavailable:', (e as Error).message);
      return null;
    }
  }

  /**
   * Open-Meteo Air Quality integration (free, no API key, CAMS-based).
   * docs: https://open-meteo.com/en/docs/air-quality-api
   */
  public async getCurrentAirQuality(locationQuery: string): Promise<LiveAirQuality | null> {
    const resolved = geoService.resolveLocation(locationQuery);
    const key = `${resolved.lat.toFixed(3)},${resolved.lng.toFixed(3)}`;
    const cached = aqCache.get(key);
    if (cached && Date.now() - cached.ts < AQ_TTL) return cached.data;

    try {
      const url =
        `${this.aqBase}/v1/air-quality?latitude=${resolved.lat}&longitude=${resolved.lng}` +
        `&current=us_aqi,pm2_5,pm10&timezone=auto`;
      const raw: any = await fetchJson(url);
      const cur = raw.current || {};
      const aqi = Math.round(cur.us_aqi ?? 0);
      const data: LiveAirQuality = {
        aqi,
        status: OpenMeteoService.classifyUsAqi(aqi),
        pm25: Math.round((cur.pm2_5 ?? 0) * 10) / 10,
        pm10: Math.round((cur.pm10 ?? 0) * 10) / 10,
        source: 'open-meteo-aq',
        observedAt: cur.time || new Date().toISOString(),
      };
      aqCache.set(key, { data, ts: Date.now() });
      return data;
    } catch (e) {
      console.warn('Open-Meteo air quality unavailable:', (e as Error).message);
      return null;
    }
  }

  public static classifyUsAqi(aqi: number): LiveAirQuality['status'] {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Satisfactory';
    if (aqi <= 150) return 'Moderate';
    if (aqi <= 200) return 'Poor';
    if (aqi <= 300) return 'Very Poor';
    return 'Severe';
  }
}

export const openMeteoService = new OpenMeteoService();
