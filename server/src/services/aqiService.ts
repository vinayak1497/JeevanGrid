import { openMeteoService } from './openMeteoService';
import { geoService } from './geoService';

interface AqiData {
  location: string;
  station: string;
  aqi: number;
  status: 'Good' | 'Satisfactory' | 'Moderate' | 'Poor' | 'Very Poor' | 'Severe';
  pm25: number;
  pm10: number;
  advisory: string;
  isDemoData: boolean;
  lastUpdated: string;
}

const aqiCache = new Map<string, { data: AqiData; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

export class AqiService {
  public async getAqiForLocation(locationQuery: string = 'Mumbai'): Promise<AqiData> {
    const normalized = locationQuery.trim().toLowerCase();

    const cached = aqiCache.get(normalized);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    const resolved = await geoService.resolveLocationLive(locationQuery);

    // 1. Live observation: Open-Meteo Air Quality (free, CAMS-based, no key)
    try {
      const live = await openMeteoService.getCurrentAirQualityForCoords(resolved.lat, resolved.lng);
      if (live) {
        const data: AqiData = {
          location: `${resolved.city}, ${resolved.district}`,
          station: 'CAMS regional model via Open-Meteo (live estimate)',
          aqi: live.aqi,
          status: live.status,
          pm25: live.pm25,
          pm10: live.pm10,
          advisory: AqiService.adviseFor(live.status),
          isDemoData: false,
          lastUpdated: new Date().toISOString(),
        };
        aqiCache.set(normalized, { data, timestamp: Date.now() });
        return data;
      }
    } catch (e) {
      console.warn('Open-Meteo live AQI failed, using regional fallback:', e);
    }

    // All live feeds failed: honest unavailable marker for the ACTUAL
    // requested place — never another city's demo readings.
    const data: AqiData = {
      location: `${resolved.city}, ${resolved.district}`,
      station: 'Live AQI feed unreachable',
      aqi: 0,
      status: 'Moderate',
      pm25: 0,
      pm10: 0,
      advisory: 'Live air-quality feed unreachable right now. Follow CPCB bulletins for health guidance.',
      isDemoData: true,
      lastUpdated: new Date().toISOString(),
    };

    aqiCache.set(normalized, { data, timestamp: Date.now() });
    return data;
  }

  private static adviseFor(status: AqiData['status']): string {
    switch (status) {
      case 'Good':
        return 'Air quality is clean. Excellent conditions for outdoor activities.';
      case 'Satisfactory':
        return 'Air quality is satisfactory for most people. Routine outdoor activities remain safe.';
      case 'Moderate':
        return 'Air quality is moderate. Sensitive individuals should limit prolonged outdoor exertion.';
      case 'Poor':
        return 'Air quality is poor. Wear N95 masks outdoors and keep windows closed during peak hours.';
      case 'Very Poor':
        return 'Air quality is very poor. Avoid outdoor exertion; run air purifiers indoors if available.';
      default:
        return 'Air quality is severe. Stay indoors and follow official health advisories.';
    }
  }
}

export const aqiService = new AqiService();
