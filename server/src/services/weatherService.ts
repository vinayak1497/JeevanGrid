import { openMeteoService } from './openMeteoService';
import { geoService } from './geoService';

interface WeatherData {
  location: string;
  state: string;
  district: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  rainProbability: number;
  severeWarning?: string;
  isDemoData: boolean;
  lastUpdated: string;
}

const weatherCache = new Map<string, { data: WeatherData; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class WeatherService {
  public async getWeatherForLocation(locationQuery: string = 'Mumbai'): Promise<WeatherData> {
    const normalized = locationQuery.trim().toLowerCase();

    // Check cache
    const cached = weatherCache.get(normalized);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    const apiKey = process.env.WEATHER_API_KEY;
    const resolved = await geoService.resolveLocationLive(locationQuery);

    // 1. Live observation: Open-Meteo (free, no key required) — same coords as geo.
    try {
      const live = await openMeteoService.getCurrentWeatherForCoords(resolved.lat, resolved.lng);
      if (live) {
        const severe =
          live.condition.toLowerCase().includes('thunderstorm') || live.precipitationMm24h >= 100
            ? `${live.condition} — intense precipitation observed in last 24h (${live.precipitationMm24h} mm)`
            : live.rainProbability >= 80
              ? `High rain probability (${live.rainProbability}%) — stay alert for waterlogging`
              : undefined;
        const result: WeatherData = {
          location: `${resolved.city}, ${resolved.state}`,
          state: resolved.state,
          district: resolved.district,
          temperature: live.temperature,
          condition: live.condition,
          humidity: live.humidity,
          windSpeed: live.windSpeedKph,
          rainProbability: live.rainProbability,
          severeWarning: severe,
          isDemoData: false,
          lastUpdated: new Date().toISOString(),
        };
        weatherCache.set(normalized, { data: result, timestamp: Date.now() });
        return result;
      }
    } catch (e) {
      console.warn('Open-Meteo live weather failed, trying fallbacks:', e);
    }

    if (apiKey && apiKey.trim().length > 0) {
      try {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(locationQuery)},IN&units=metric&appid=${apiKey}`;
        const res = await fetch(url);
        if (res.ok) {
          const raw: any = await res.json();
          const result: WeatherData = {
            location: `${raw.name}, India`,
            state: 'India',
            district: raw.name,
            temperature: Math.round(raw.main.temp),
            condition: raw.weather[0]?.main || 'Clear',
            humidity: raw.main.humidity,
            windSpeed: Math.round(raw.wind.speed * 3.6), // m/s to km/h
            rainProbability: raw.clouds?.all || 10,
            severeWarning: raw.weather[0]?.description.includes('storm') ? 'Thunderstorm Advisory Active' : undefined,
            isDemoData: false,
            lastUpdated: new Date().toISOString(),
          };
          weatherCache.set(normalized, { data: result, timestamp: Date.now() });
          return result;
        }
      } catch (e) {
        console.warn('Weather API failed, falling back to mock:', e);
      }
    }

    // All live feeds failed: return an HONEST unavailable marker for the
    // ACTUAL requested place — never another city's demo data (the reported
    // bug was Thane/Nashik rendering Mumbai's weather).
    const data: WeatherData = {
      location: `${resolved.city}, ${resolved.state}`,
      state: resolved.state,
      district: resolved.district,
      temperature: 0,
      condition: 'Observation unavailable',
      humidity: 0,
      windSpeed: 0,
      rainProbability: 0,
      severeWarning: 'Live weather feed unreachable — follow IMD bulletins.',
      isDemoData: true,
      lastUpdated: new Date().toISOString(),
    };

    weatherCache.set(normalized, { data, timestamp: Date.now() });
    return data;
  }
}

export const weatherService = new WeatherService();
