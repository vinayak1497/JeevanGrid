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
// NOTE: city aliases are city-specific ONLY. State-wide queries (e.g.
// "Maharashtra", "Assam") must fall through to STATE_COORDS so that
// Thane/Nashik never collapse to Mumbai and Dibrugarh never collapses
// to Guwahati. Live Nominatim geocoding (resolveLocationLive) handles
// any other Indian city/district with real coordinates.
const CITY_INDEX: CityEntry[] = [
  {
    city: 'Guwahati',
    district: 'Kamrup Metropolitan',
    state: 'Assam',
    lat: 26.1445,
    lng: 91.7362,
    aliases: ['guwahati', 'gauhati', 'kamrup metropolitan', 'kamrup metro'],
  },
  {
    city: 'Dibrugarh',
    district: 'Dibrugarh',
    state: 'Assam',
    lat: 27.4728,
    lng: 94.912,
    aliases: ['dibrugarh'],
  },
  {
    city: 'Silchar',
    district: 'Cachar',
    state: 'Assam',
    lat: 24.8333,
    lng: 92.7789,
    aliases: ['silchar'],
  },
  {
    city: 'Jorhat',
    district: 'Jorhat',
    state: 'Assam',
    lat: 26.7509,
    lng: 94.2037,
    aliases: ['jorhat'],
  },
  {
    city: 'Nagaon',
    district: 'Nagaon',
    state: 'Assam',
    lat: 26.3484,
    lng: 92.684,
    aliases: ['nagaon', 'nowgong'],
  },
  {
    city: 'Tezpur',
    district: 'Sonitpur',
    state: 'Assam',
    lat: 26.6338,
    lng: 92.8,
    aliases: ['tezpur', 'sonitpur'],
  },
  {
    city: 'Tinsukia',
    district: 'Tinsukia',
    state: 'Assam',
    lat: 27.4924,
    lng: 95.3557,
    aliases: ['tinsukia'],
  },
  {
    city: 'Mumbai',
    district: 'Mumbai Suburban',
    state: 'Maharashtra',
    lat: 19.076,
    lng: 72.8777,
    aliases: ['mumbai', 'bombay', 'mumbai suburban', 'mumbai city', 'bandra'],
  },
  {
    city: 'Thane',
    district: 'Thane',
    state: 'Maharashtra',
    lat: 19.2183,
    lng: 72.9781,
    aliases: ['thane'],
  },
  {
    city: 'Nashik',
    district: 'Nashik',
    state: 'Maharashtra',
    lat: 19.9975,
    lng: 73.7898,
    aliases: ['nashik', 'nasik'],
  },
  {
    city: 'Nagpur',
    district: 'Nagpur',
    state: 'Maharashtra',
    lat: 21.1458,
    lng: 79.0882,
    aliases: ['nagpur'],
  },
  {
    city: 'Chhatrapati Sambhajinagar',
    district: 'Chhatrapati Sambhajinagar',
    state: 'Maharashtra',
    lat: 19.8762,
    lng: 75.3433,
    aliases: ['aurangabad', 'chhatrapati sambhajinagar', 'sambhajinagar'],
  },
  {
    city: 'Solapur',
    district: 'Solapur',
    state: 'Maharashtra',
    lat: 17.6599,
    lng: 75.9064,
    aliases: ['solapur', 'sholapur'],
  },
  {
    city: 'Kolhapur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    lat: 16.705,
    lng: 74.2433,
    aliases: ['kolhapur'],
  },
  {
    city: 'Amravati',
    district: 'Amravati',
    state: 'Maharashtra',
    lat: 20.9374,
    lng: 77.7796,
    aliases: ['amravati'],
  },
  {
    city: 'Ahmedabad',
    district: 'Ahmedabad',
    state: 'Gujarat',
    lat: 23.0225,
    lng: 72.5714,
    aliases: ['ahmedabad', 'ahmadabad', 'amdavad'],
  },
  {
    city: 'Surat',
    district: 'Surat',
    state: 'Gujarat',
    lat: 21.1702,
    lng: 72.8311,
    aliases: ['surat'],
  },
  {
    city: 'New Delhi',
    district: 'Central Delhi',
    state: 'Delhi',
    lat: 28.6139,
    lng: 77.209,
    aliases: ['new delhi', 'central delhi'],
  },
  {
    city: 'Delhi',
    district: 'New Delhi',
    state: 'Delhi',
    lat: 28.7041,
    lng: 77.1025,
    aliases: ['delhi', 'ncr'],
  },
  {
    city: 'Shimla',
    district: 'Shimla',
    state: 'Himachal Pradesh',
    lat: 31.1048,
    lng: 77.1734,
    aliases: ['shimla'],
  },
  {
    city: 'Mandi',
    district: 'Mandi',
    state: 'Himachal Pradesh',
    lat: 31.5892,
    lng: 76.9182,
    aliases: ['mandi'],
  },
  {
    city: 'Pune',
    district: 'Pune',
    state: 'Maharashtra',
    lat: 18.5204,
    lng: 73.8567,
    aliases: ['pune', 'poona'],
  },
  {
    city: 'Patna',
    district: 'Patna',
    state: 'Bihar',
    lat: 25.5941,
    lng: 85.1376,
    aliases: ['patna'],
  },
  {
    city: 'Chennai',
    district: 'Chennai',
    state: 'Tamil Nadu',
    lat: 13.0827,
    lng: 80.2707,
    aliases: ['chennai', 'madras'],
  },
  {
    city: 'Kolkata',
    district: 'Kolkata',
    state: 'West Bengal',
    lat: 22.5726,
    lng: 88.3639,
    aliases: ['kolkata', 'calcutta'],
  },
  {
    city: 'Bengaluru',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    lat: 12.9716,
    lng: 77.5946,
    aliases: ['bengaluru', 'bangalore'],
  },
  {
    city: 'Hyderabad',
    district: 'Hyderabad',
    state: 'Telangana',
    lat: 17.385,
    lng: 78.4867,
    aliases: ['hyderabad'],
  },
  {
    city: 'Jaipur',
    district: 'Jaipur',
    state: 'Rajasthan',
    lat: 26.9124,
    lng: 75.7873,
    aliases: ['jaipur'],
  },
  {
    city: 'Lucknow',
    district: 'Lucknow',
    state: 'Uttar Pradesh',
    lat: 26.8467,
    lng: 80.9462,
    aliases: ['lucknow'],
  },
  {
    city: 'Bhubaneswar',
    district: 'Khordha',
    state: 'Odisha',
    lat: 20.2961,
    lng: 85.8245,
    aliases: ['bhubaneswar', 'bhubaneshwar'],
  },
];

const STATE_COORDS: Record<string, { lat: number; lng: number; state: string }> = {
  assam: { lat: 26.2, lng: 92.93, state: 'Assam' },
  maharashtra: { lat: 19.7515, lng: 75.7139, state: 'Maharashtra' },
  gujarat: { lat: 22.2587, lng: 71.1924, state: 'Gujarat' },
  delhi: { lat: 28.6139, lng: 77.209, state: 'Delhi' },
  bihar: { lat: 25.0961, lng: 85.3131, state: 'Bihar' },
  odisha: { lat: 20.9517, lng: 85.0985, state: 'Odisha' },
  'himachal pradesh': { lat: 31.1048, lng: 77.1734, state: 'Himachal Pradesh' },
  himachal: { lat: 31.1048, lng: 77.1734, state: 'Himachal Pradesh' },
  'west bengal': { lat: 22.9868, lng: 87.855, state: 'West Bengal' },
  'tamil nadu': { lat: 11.1271, lng: 78.6569, state: 'Tamil Nadu' },
  karnataka: { lat: 15.3173, lng: 75.7139, state: 'Karnataka' },
  kerala: { lat: 10.8505, lng: 76.2711, state: 'Kerala' },
  rajasthan: { lat: 27.0238, lng: 74.2179, state: 'Rajasthan' },
  'uttar pradesh': { lat: 26.8467, lng: 80.9462, state: 'Uttar Pradesh' },
  'madhya pradesh': { lat: 22.9734, lng: 78.6569, state: 'Madhya Pradesh' },
  punjab: { lat: 31.1471, lng: 75.3412, state: 'Punjab' },
  haryana: { lat: 29.0588, lng: 76.0856, state: 'Haryana' },
  telangana: { lat: 18.1124, lng: 79.0193, state: 'Telangana' },
  'andhra pradesh': { lat: 15.9129, lng: 79.74, state: 'Andhra Pradesh' },
};

// Live Nominatim cache (real coordinates for ANY Indian place).
const liveCache = new Map<string, { data: ResolvedLocation; ts: number }>();
const LIVE_TTL_MS = 24 * 60 * 60 * 1000;

function titleCase(v: string): string {
  return v
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 9000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'JeevanGrid-Disaster-Platform/1.0 (contact: support@jeevangrid.in)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Live forward-geocode via Nominatim (OpenStreetMap, free, no key). */
async function geocodeLive(query: string): Promise<ResolvedLocation | null> {
  const clean = (query || '').trim();
  if (!clean) return null;
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=json&limit=1` +
      `&countrycodes=in&addressdetails=1&q=${encodeURIComponent(clean + ', India')}`;
    const raw: any = await fetchJsonWithTimeout(url, 9000);
    const first = Array.isArray(raw) ? raw[0] : null;
    if (!first || first.lat === undefined || first.lon === undefined) return null;
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const addr = first.address || {};
    const city =
      addr.city || addr.town || addr.village || addr.hamlet || addr.suburb || addr.county || clean.split(',')[0].trim();
    const district = addr.state_district || addr.county || addr.city_district || city;
    const state = addr.state || 'India';
    // Guard against out-of-India results (countrycodes=in should prevent this).
    if (first.display_name && /united states|united kingdom|canada|australia/i.test(String(first.display_name)) && !/india/i.test(String(first.display_name))) {
      return null;
    }
    return {
      query: clean,
      city: titleCase(String(city).slice(0, 80)),
      district: titleCase(String(district).slice(0, 80)),
      state: titleCase(String(state).slice(0, 80)),
      lat,
      lng,
      zoom: 12,
      granularity: 'city',
      matchedFromGeoIndex: false,
    };
  } catch (e) {
    console.warn('Nominatim live geocode unavailable:', (e as Error).message);
    return null;
  }
}

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

    // 1. City alias match (highest priority, longest alias first so
    // "New Delhi" beats "Delhi", "Chhatrapati Sambhajinagar" beats parts).
    const sortedCities = [...CITY_INDEX].sort(
      (a, b) => Math.max(...b.aliases.map((x) => x.length)) - Math.max(...a.aliases.map((x) => x.length))
    );
    for (const entry of sortedCities) {
      const hit = entry.aliases
        .slice()
        .sort((a, b) => b.length - a.length)
        .some((a) => q.includes(a));
      if (hit) {
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

    // 2. State-level match → wider zoom (checked BEFORE raw district names
    // so "Maharashtra" / "Assam" never collapse to a single city).
    const stateKeys = Object.keys(STATE_COORDS).sort((a, b) => b.length - a.length);
    for (const key of stateKeys) {
      if (q.includes(key)) {
        const s = STATE_COORDS[key];
        return {
          query: fallback,
          city: titleCase(fallback.split(',')[0].slice(0, 80)),
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

    // 3. Raw district-name hit from Assets/geo index. Sync path has no
    // coordinates for arbitrary districts — return an honest India-centroid
    // placeholder and let resolveLocationLive() refine it with Nominatim.
    // (Previously this returned Indore's coords for EVERY district — wrong.)
    for (const name of this.districtNames) {
      if (name && q.includes(name)) {
        return {
          query: fallback,
          city: titleCase(fallback.split(',')[0].slice(0, 80)),
          district: titleCase(name),
          state: 'India',
          lat: 20.5937,
          lng: 78.9629,
          zoom: 10,
          granularity: 'district',
          matchedFromGeoIndex: true,
        };
      }
    }

    // 4. Unknown place: NEVER silently return Mumbai staging (that is the
    // reported bug). Return the query itself with an India-centroid
    // placeholder; async callers refine via Nominatim.
    return {
      query: fallback,
      city: titleCase(fallback.split(',')[0].slice(0, 80)),
      district: titleCase(fallback.split(',')[0].slice(0, 80)),
      state: 'India',
      lat: 20.5937,
      lng: 78.9629,
      zoom: 5,
      granularity: 'city',
      matchedFromGeoIndex: false,
    };
  }

  /**
   * Async resolution with REAL coordinates for ANY Indian place.
   * Order: built-in gazetteer (instant) → live Nominatim geocode
   * (real lat/lng + district/state) → sync fallback (honest placeholder).
   * Results are cached for 24h. This is what the risk engine, weather,
   * AQI, quake and facility services must use.
   */
  public async resolveLocationLive(query: string): Promise<ResolvedLocation> {
    const clean = (query || '').trim() || 'Mumbai';
    const key = normalizeName(clean);
    const cached = liveCache.get(key);
    if (cached && Date.now() - cached.ts < LIVE_TTL_MS) {
      return { ...cached.data, query: clean };
    }

    const sync = this.resolveLocation(clean);
    // Gazetteer hit with real coords (not the India-centroid placeholder)
    // can be returned immediately without a network call.
    const isPlaceholder = sync.lat === 20.5937 && sync.lng === 78.9629;
    if (!isPlaceholder) {
      liveCache.set(key, { data: sync, ts: Date.now() });
      return sync;
    }

    const live = await geocodeLive(clean);
    if (live) {
      liveCache.set(key, { data: live, ts: Date.now() });
      return live;
    }
    return sync;
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
    const mumbaiEntry = CITY_INDEX.find((e) => e.city === 'Mumbai') ?? CITY_INDEX[0];
    let best = mumbaiEntry;
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
