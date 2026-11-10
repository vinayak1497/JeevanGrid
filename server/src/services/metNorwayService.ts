import { LiveWeather } from './openMeteoService';

const MET_BASE = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';

/**
 * MET Norway / MET Nordic (Locationforecast 2.0) — free, no API key.
 *
 * Used as the second link in the live weather chain: Open-Meteo rate-limits
 * shared datacenter IPs with HTTP 429, which is exactly the situation a
 * hosted Render instance is in.
 *
 * MET requires a real identifying User-Agent. We set one and keep the
 * contact in the product's own domain.
 */
const SYMBOL_LABELS: Array<[RegExp, string]> = [
  [/^clearsky/i, 'Clear Sky'],
  [/^fair/i, 'Mostly Clear'],
  [/^partlycloudy/i, 'Partly Cloudy'],
  [/^cloudy/i, 'Overcast'],
  [/^fog/i, 'Foggy'],
  [/^lightrain/i, 'Light Rain'],
  [/^rain/i, 'Rain'],
  [/^heavyrain/i, 'Heavy Rain'],
  [/^lightrainshowers/i, 'Light Showers'],
  [/^rainshowers/i, 'Rain Showers'],
  [/^heavyrainshowers/i, 'Violent Showers'],
  [/^lightsleet/i, 'Light Sleet'],
  [/^sleet/i, 'Sleet'],
  [/^heavysleet/i, 'Heavy Sleet'],
  [/^lightsnow/i, 'Light Snow'],
  [/^snow/i, 'Snowfall'],
  [/^heavysnow/i, 'Heavy Snowfall'],
  [/^thunder/i, 'Thunderstorm'],
];

function symbolToLabel(symbol: string): string {
  for (const [pattern, label] of SYMBOL_LABELS) {
    if (pattern.test(symbol)) return label;
  }
  return 'Partly Cloudy';
}

async function fetchJson(url: string, timeoutMs = 9000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'JeevanGrid-DataEngine/1.0 (https://jeevangrid.in; civic-safety)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`MET Norway HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export class MetNorwayService {
  public async getCurrentWeatherForCoords(lat: number, lng: number): Promise<LiveWeather | null> {
    try {
      const raw = await fetchJson(`${MET_BASE}?lat=${lat}&lon=${lng}`);
      const series = raw?.properties?.timeseries;
      if (!Array.isArray(series) || series.length === 0) return null;

      const now = Date.now();
      // Use the first entry that is not in the past, so the observation is real.
      const entry =
        series.find((t: any) => new Date(t.time).getTime() >= now - 30 * 60 * 1000) || series[0];
      const instant = entry?.data?.instant?.details || {};
      const next = entry?.data?.next_1_hours || {};

      const temperature = Number(instant.air_temperature);
      const humidity = Number(instant.relative_humidity);
      const windMs = Number(instant.wind_speed);
      if (!Number.isFinite(temperature)) return null;

      const symbol = String(next?.summary?.symbol_code || '');
      // Prefer the 6-hour accumulation when MET offers it, so the severe-weather
      // threshold compares like for like against the Open-Meteo daily total.
      const sixHour = entry?.data?.next_6_hours?.details?.precipitation_amount;
      const oneHour = next?.details?.precipitation_amount;
      const precipitationMm = Number.isFinite(Number(sixHour))
        ? Number(sixHour)
        : Number.isFinite(Number(oneHour))
          ? Number(oneHour) * 6
          : 0;
      const probability = Number(next?.details?.precipitation_probability);

      return {
        temperature: Math.round(temperature),
        condition: symbolToLabel(symbol),
        humidity: Number.isFinite(humidity) ? Math.round(humidity) : 0,
        windSpeedKph: Number.isFinite(windMs) ? Math.round(windMs * 3.6) : 0,
        rainProbability: Number.isFinite(probability) ? Math.round(probability) : 0,
        precipitationMm24h: Math.round(precipitationMm * 10) / 10,
        source: 'met-no',
        observedAt: String(entry.time || new Date().toISOString()),
      };
    } catch (error) {
      console.warn('MET Norway weather unavailable:', (error as Error).message);
      return null;
    }
  }
}

export const metNorwayService = new MetNorwayService();
