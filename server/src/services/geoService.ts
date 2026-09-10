import fs from 'fs';
import path from 'path';

export interface ResolvedLocation {
  query: string;
  city: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
  /** Leaflet zoom: ~7 for state-level, 11-12 for district/city-level */
  zoom: number;
  granularity: 'city' | 'district' | 'state';
  matchedFromGeoIndex: boolean;
}

interface CityEntry {
  city: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
  aliases: string[];
}

// Deterministic gazetteer for supported intelligence zones.
// Coordinates are fixed civic reference points (no external dependency).
const CITY_INDEX: CityEntry[] = [
  {
    city: 'Guwahati',
    district: 'Kamrup Metropolitan',
    state: 'Assam',
    lat: 26.1445,
    lng: 91.7362,
    aliases: ['guwahati', 'kamrup metropolitan', 'kamrup metro', 'kamrup', 'gauhati'],
  },
  {
    city: 'Mumbai',
    district: 'Mumbai Suburban',
    state: 'Maharashtra',
    lat: 19.076,
    lng: 72.8777,
    aliases: ['mumbai', 'bombay', 'mumbai suburban', 'mumbai city', 'thane'],
  },
  {
    city: 'Ahmedabad',
    district: 'Ahmedabad',
    state: 'Gujarat',
    lat: 23.0225,
    lng: 72.5714,
    aliases: ['ahmedabad', 'ahmadabad', 'amdavad', 'gujarat', 'surat'],
  },
  {
    city: 'New Delhi',
    district: 'Central Delhi',
    state: 'Delhi',
    lat: 28.6139,
    lng: 77.209,
    aliases: ['delhi', 'new delhi', 'ncr', 'central delhi'],
  },
  {
    city: 'Shimla',
    district: 'Shimla',
    state: 'Himachal Pradesh',
    lat: 31.1048,
    lng: 77.1734,
    aliases: ['shimla', 'himachal', 'mandi', 'shimla district'],
  },
  {
    city: 'Pune',
    district: 'Pune',
    state: 'Maharashtra',
    lat: 18.5204,
    lng: 73.8567,
    aliases: ['pune', 'poona', 'pune district'],
  },
  {
    city: 'Patna',
    district: 'Patna',
    state: 'Bihar',
    lat: 25.5941,
    lng: 85.1376,
    aliases: ['patna', 'bihar', 'patna district'],
  },
];

const STATE_COORDS: Record<string, { lat: number; lng: number; state: string }> = {
  assam: { lat: 26.2, lng: 92.93, state: 'Assam' },
  maharashtra: { lat: 19.7515, lng: 75.7139, state: 'Maharashtra' },
  gujarat: { lat: 22.2587, lng: 71.1924, state: 'Gujarat' },
  delhi: { lat: 28.6139, lng: 77.209, state: 'Delhi' },
  bihar: { lat: 25.0961, lng: 85.3131, state: 'Bihar' },
  odisha: { lat: 20.9517, lng: 85.0985, state: 'Odisha' },
};

function normalizeName(v: string): string {
  return (v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export class GeoService {
  private districtNames: Set<string> = new Set();
  private stateNames: string[] = [];
  private loaded = false;

  /** Load Assets/geo name indexes (metadata only — files carry no polygon geometry). */
  private loadIndex(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const base = path.join(__dirname, '..', '..', '..', 'Assets', 'geo');
      const distRaw = JSON.parse(fs.readFileSync(path.join(base, 'district.json'), 'utf-8'));
      const stateRaw = JSON.parse(fs.readFileSync(path.join(base, 'states.json'), 'utf-8'));
      const distList: any[] = Array.isArray(distRaw) ? distRaw : distRaw.features || [];
      const stateList: any[] = Array.isArray(stateRaw) ? stateRaw : stateRaw.features || [];
      for (const d of distList) {
        const n = d.shapeName || d?.properties?.shapeName;
        if (n) this.districtNames.add(normalizeName(String(n)));
      }
      this.stateNames = stateList
        .map((s: any) => String(s.shapeName || s?.properties?.shapeName || ''))
        .filter(Boolean);
    } catch (e) {
      console.warn('GeoService: Assets/geo index unavailable, using built-in gazetteer:', (e as Error).message);
    }
  }

  public resolveLocation(query: string): ResolvedLocation {
    this.loadIndex();
    const q = normalizeName(query || '');
    const fallback = query?.trim() || 'Mumbai';

    // 1. City / district alias match (highest priority)
    for (const entry of CITY_INDEX) {
      if (entry.aliases.some((a) => q.includes(a))) {
        const isDistrictOnly =
          q === normalizeName(entry.district) && !q.includes(normalizeName(entry.city));
        const inGeoIndex =
          this.districtNames.has(normalizeName(entry.district)) ||
          entry.aliases.some((a) => this.districtNames.has(a));
        return {
          query: fallback,
          city: entry.city,
          district: entry.district,
          state: entry.state,
          lat: entry.lat,
          lng: entry.lng,
          zoom: isDistrictOnly ? 10 : 12,
          granularity: isDistrictOnly ? 'district' : 'city',
          matchedFromGeoIndex: inGeoIndex,
        };
      }
    }

    // 2. Raw district-name hit from Assets/geo index (detection without coordinates)
    for (const name of this.districtNames) {
      if (name && q.includes(name)) {
        return {
          query: fallback,
          city: fallback,
          district: name,
          state: 'India',
          lat: 22.7196,
          lng: 75.8577,
          zoom: 10,
          granularity: 'district',
          matchedFromGeoIndex: true,
        };
      }
    }

    // 3. State-level match → wider zoom
    for (const key of Object.keys(STATE_COORDS)) {
      if (q.includes(key)) {
        const s = STATE_COORDS[key];
        return {
          query: fallback,
          city: s.state,
          district: s.state,
          state: s.state,
          lat: s.lat,
          lng: s.lng,
          zoom: 7,
          granularity: 'state',
          matchedFromGeoIndex: true,
        };
      }
    }

    // 4. Default: Mumbai staging
    const mumbai = CITY_INDEX[1];
    return {
      query: fallback,
      city: mumbai.city,
      district: mumbai.district,
      state: mumbai.state,
      lat: mumbai.lat,
      lng: mumbai.lng,
      zoom: 12,
      granularity: 'city',
      matchedFromGeoIndex: this.districtNames.has('mumbai suburban'),
    };
  }

  public listDistricts(stateFilter?: string): { district: string; state: string }[] {
    this.loadIndex();
    const out: { district: string; state: string }[] = [];
    for (const entry of CITY_INDEX) {
      if (!stateFilter || normalizeName(entry.state) === normalizeName(stateFilter)) {
        out.push({ district: entry.district, state: entry.state });
      }
    }
    return out;
  }

  public listStates(): string[] {
    this.loadIndex();
    if (this.stateNames.length) return this.stateNames;
    return [...new Set(CITY_INDEX.map((c) => c.state))];
  }

  /** Nearest supported city to device coordinates (no external call). */
  public nearestCity(lat: number, lng: number): ResolvedLocation {
    let best = CITY_INDEX[1];
    let bestD = Number.POSITIVE_INFINITY;
    for (const entry of CITY_INDEX) {
      const dLat = ((entry.lat - lat) * Math.PI) / 180;
      const dLng = ((entry.lng - lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat * Math.PI) / 180) * Math.cos((entry.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      const d = 2 * 6371 * Math.asin(Math.sqrt(a));
      if (d < bestD) {
        bestD = d;
        best = entry;
      }
    }
    return {
      query: `${lat.toFixed(4)},${lng.toFixed(4)}`,
      city: best.city,
      district: best.district,
      state: best.state,
      lat: best.lat,
      lng: best.lng,
      zoom: 12,
      granularity: 'city',
      matchedFromGeoIndex: true,
    };
  }

  /** Exposes whether polygon geometry is available (it is not — index is metadata-only). */
  public geometryStatus(): { hasPolygons: boolean; note: string } {
    return {
      hasPolygons: false,
      note: 'Assets/geo district.json/states.json are metadata indexes (shapeName/shapeID) without polygon geometry; district highlighting uses centroid + risk-radius rendering.',
    };
  }
}

export const geoService = new GeoService();
