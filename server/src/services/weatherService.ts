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
    const resolved = geoService.resolveLocation(locationQuery);

    // 1. Live observation: Open-Meteo (free, no key required)
    try {
      const live = await openMeteoService.getCurrentWeather(locationQuery);
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

    // Realistic Demo Weather based on region
    let data: WeatherData;

    if (normalized.includes('guwahati') || normalized.includes('assam')) {
      data = {
        location: 'Guwahati, Assam',
        state: 'Assam',
        district: 'Kamrup Metropolitan',
        temperature: 26,
        condition: 'Heavy Rain',
        humidity: 92,
        windSpeed: 24,
        rainProbability: 95,
        severeWarning: 'Flash Flood Watch in Low-Lying Catchments',
        isDemoData: true,
        lastUpdated: new Date().toISOString(),
      };
    } else if (normalized.includes('delhi')) {
      data = {
        location: 'New Delhi, NCR',
        state: 'Delhi',
        district: 'Central Delhi',
        temperature: 36,
        condition: 'Hazy Sun',
        humidity: 48,
        windSpeed: 14,
        rainProbability: 10,
        severeWarning: 'Elevated Ozone & Thermal Discomfort',
        isDemoData: true,
        lastUpdated: new Date().toISOString(),
      };
    } else if (normalized.includes('shimla') || normalized.includes('himachal')) {
      data = {
        location: 'Shimla, Himachal Pradesh',
        state: 'Himachal Pradesh',
        district: 'Shimla',
        temperature: 16,
        condition: 'Misty Rain',
        humidity: 88,
        windSpeed: 18,
        rainProbability: 75,
        severeWarning: 'Slope Instability & Debris Flow Risk',
        isDemoData: true,
        lastUpdated: new Date().toISOString(),
      };
    } else if (normalized.includes('patna') || normalized.includes('bihar')) {
      data = {
        location: 'Patna, Bihar',
        state: 'Bihar',
        district: 'Patna',
        temperature: 31,
        condition: 'Overcast',
        humidity: 84,
        windSpeed: 16,
        rainProbability: 60,
        severeWarning: 'Ganga Basin Water Level Alert',
        isDemoData: true,
        lastUpdated: new Date().toISOString(),
      };
    } else if (normalized.includes('ahmedabad') || normalized.includes('ahmadabad') || normalized.includes('gujarat')) {
      data = {
        location: 'Ahmedabad, Gujarat',
        state: 'Gujarat',
        district: 'Ahmedabad',
        temperature: 33,
        condition: 'Hot & Humid',
        humidity: 62,
        windSpeed: 17,
        rainProbability: 35,
        severeWarning: 'Heat stress likely during peak afternoon hours; monsoon showers possible',
        isDemoData: true,
        lastUpdated: new Date().toISOString(),
      };
    } else if (normalized.includes('pune')) {
      data = {
        location: 'Pune, Maharashtra',
        state: 'Maharashtra',
        district: 'Pune',
        temperature: 25,
        condition: 'Light Showers',
        humidity: 74,
        windSpeed: 15,
        rainProbability: 40,
        isDemoData: true,
        lastUpdated: new Date().toISOString(),
      };
    } else {
      // Default: Mumbai
      data = {
        location: 'Mumbai, Maharashtra',
        state: 'Maharashtra',
        district: 'Mumbai Suburban',
        temperature: 28,
        condition: 'Partly Cloudy',
        humidity: 78,
        windSpeed: 12,
        rainProbability: 20,
        severeWarning: 'High Astronomical Tide at 14:15 IST (4.68m)',
        isDemoData: true,
        lastUpdated: new Date().toISOString(),
      };
    }

    weatherCache.set(normalized, { data, timestamp: Date.now() });
    return data;
  }
}

export const weatherService = new WeatherService();
