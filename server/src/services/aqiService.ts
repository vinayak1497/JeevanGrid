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

    const resolved = geoService.resolveLocation(locationQuery);

    // 1. Live observation: Open-Meteo Air Quality (free, CAMS-based, no key)
    try {
      const live = await openMeteoService.getCurrentAirQuality(locationQuery);
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

    let data: AqiData;

    if (normalized.includes('delhi')) {
      data = {
        location: 'Central Delhi',
        station: 'Anand Vihar CPCB Continuous Ambient Air Quality Monitoring Station',
        aqi: 284,
        status: 'Poor',
        pm25: 142,
        pm10: 220,
        advisory: 'Air quality is poor. Sensitive individuals and elders should wear N95 masks during morning commutes.',
        isDemoData: true,
        lastUpdated: new Date().toISOString(),
      };
    } else if (normalized.includes('guwahati') || normalized.includes('assam')) {
      data = {
        location: 'Guwahati, Panbazar',
        station: 'Assam State Pollution Control Board Station',
        aqi: 42,
        status: 'Good',
        pm25: 18,
        pm10: 38,
        advisory: 'Air quality is clean and satisfactory. Excellent conditions for outdoor activities.',
        isDemoData: true,
        lastUpdated: new Date().toISOString(),
      };
    } else if (normalized.includes('ahmedabad') || normalized.includes('ahmadabad') || normalized.includes('gujarat')) {
      data = {
        location: 'Ahmedabad, Maninagar',
        station: 'GPCB Continuous Monitoring Station (representative)',
        aqi: 118,
        status: 'Moderate',
        pm25: 52,
        pm10: 104,
        advisory: 'Air quality is moderate. Sensitive groups should limit prolonged outdoor exertion in peak traffic hours.',
        isDemoData: true,
        lastUpdated: new Date().toISOString(),
      };
    } else if (normalized.includes('pune')) {
      data = {
        location: 'Shivajinagar, Pune',
        station: 'SAFAR Air Monitoring Centre Pune',
        aqi: 72,
        status: 'Satisfactory',
        pm25: 32,
        pm10: 64,
        advisory: 'Air quality is acceptable with minor breathing discomfort possible for sensitive persons.',
        isDemoData: true,
        lastUpdated: new Date().toISOString(),
      };
    } else {
      // Default: Mumbai
      data = {
        location: 'Mumbai, Bandra West',
        station: 'CPCB Standard Station - Bandra Kurla Complex',
        aqi: 68,
        status: 'Satisfactory',
        pm25: 29,
        pm10: 58,
        advisory: 'Air quality is satisfactory for most people. Outdoor sports and routine morning exercises remain safe.',
        isDemoData: true,
        lastUpdated: new Date().toISOString(),
      };
    }

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
