import { prisma } from '../utils/prisma';
import { geoService, type ResolvedLocation } from './geoService';
import { openMeteoService, type LiveWeather, type LiveAirQuality } from './openMeteoService';
import { usgsService, type QuakeSummary } from './usgsService';
import { normalizeTelemetry, computeRiskScore } from './dataNormalization';

export interface HazardDetail {
  type: string;
  level: 'Low' | 'Moderate' | 'High' | 'Severe';
  status: 'FORECAST' | 'WATCH' | 'WARNING' | 'ACTIVE INCIDENT';
  description: string;
}

export interface RiskAnalysisResult {
  location: string;
  state: string;
  district: string;
  coordinates: { lat: number; lng: number };
  overallRiskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  riskScore: number; // 0 - 100
  forecastWindow: string;
  rainfallExpectedMm: number;
  floodRiskStage: string;
  activeHazards: HazardDetail[];
  affectedZones: string[];
  whatToDo: string[];
  whatNotToDo: string[];
  nearestHospitals: any[];
  nearestShelters: any[];
  emergencyContacts: { service: string; number: string }[];
  scientificDisclaimer: string;
  isDemoData: boolean;
}

// Regional baseline vulnerability per state (0-100 scale input to the
// deterministic scorer). Derived from seismic zoning + known flood /
// cyclone exposure — NOT a prediction, just a planning baseline.
const STATE_BASELINE: Record<string, number> = {
  Assam: 62,
  Bihar: 60,
  'Himachal Pradesh': 58,
  Odisha: 55,
  Delhi: 50,
  Maharashtra: 45,
  Gujarat: 45,
  'West Bengal': 58,
  'Tamil Nadu': 50,
  Karnataka: 42,
  Kerala: 52,
  Rajasthan: 44,
  'Uttar Pradesh': 52,
  'Madhya Pradesh': 46,
  Punjab: 44,
  Haryana: 44,
  Telangana: 44,
  'Andhra Pradesh': 50,
  India: 46,
};

const SEISMIC_ZONES: Record<string, string> = {
  Assam: 'Zone V (Very High seismic vulnerability — strict compliance with earthquake-resistant construction)',
  Bihar: 'Zone IV–V (High seismic vulnerability)',
  Delhi: 'Zone IV (High seismic vulnerability)',
  'Himachal Pradesh': 'Zone IV–V (High to Very High seismic vulnerability in hill belt)',
  Maharashtra: 'Zone III (Moderate seismic vulnerability)',
  Gujarat: 'Zone III–V (Moderate; Kutch belt Very High)',
  Odisha: 'Zone II–III (Low to Moderate seismic vulnerability)',
};

const FLOOD_PRONE = new Set(['Assam', 'Bihar', 'West Bengal', 'Odisha', 'Kerala', 'Uttar Pradesh']);

function baselineForState(state: string): number {
  return STATE_BASELINE[state] ?? STATE_BASELINE['India'] ?? 46;
}

function seismicNoteForState(state: string): string {
  return SEISMIC_ZONES[state] ?? 'Zone III (Moderate seismic vulnerability per national zoning; NOT an earthquake prediction)';
}

function severityToHazardLevel(sev: string): HazardDetail['level'] {
  const s = (sev || '').toUpperCase();
  if (s === 'CRITICAL') return 'Severe';
  if (s === 'WARNING') return 'High';
  if (s === 'WATCH') return 'Moderate';
  return 'Low';
}

function severityToStatus(sev: string): HazardDetail['status'] {
  const s = (sev || '').toUpperCase();
  if (s === 'CRITICAL') return 'ACTIVE INCIDENT';
  if (s === 'WARNING') return 'WARNING';
  if (s === 'WATCH') return 'WATCH';
  return 'FORECAST';
}

function cleanAlertText(v: string | null | undefined, max = 600): string {
  return String(v || '')
    .replace(/\?{2,}/g, '—')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function isJunkZone(z: string): boolean {
  const t = (z || '').trim();
  if (!t || t.length < 3) return true;
  if (/^unknown$/i.test(t)) return true;
  if (/LGD|district code|^\d+$/i.test(t)) return true;
  return false;
}

function toIST(iso: string | Date | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d) + ' IST';
}

export class RiskEngineService {
  public async analyzeLocationRisk(locationQuery: string): Promise<RiskAnalysisResult> {
    const rawQuery = (locationQuery || 'Mumbai').trim() || 'Mumbai';

    // 1. Accurate geocoding FIRST — real lat/lng for ANY Indian place.
    // Thane → Thane (19.21, 72.97), Nashik → Nashik (19.99, 73.78),
    // Dibrugarh → Dibrugarh (27.47, 94.91). Never Mumbai/Guwahati fallback.
    const resolved: ResolvedLocation = await geoService.resolveLocationLive(rawQuery);

    // 2. Live telemetry for THESE coordinates (single source of truth —
    // coords-based calls so every feed uses identical lat/lng).
    const [liveWeather, liveAqi, quakeSummary] = await Promise.all([
      openMeteoService.getCurrentWeatherForCoords(resolved.lat, resolved.lng).catch(() => null),
      openMeteoService.getCurrentAirQualityForCoords(resolved.lat, resolved.lng).catch(() => null),
      usgsService.getQuakesForCoords(resolved.city, resolved.lat, resolved.lng, 500, 4, 10).catch(() => null),
    ]);

    // 3. REAL official alerts matching this location (SACHET/IMD/CWC/INCOIS
    // ingested rows — verified, non-expired, non-demo ONLY. Never seeded).
    const officialAlerts = await this.findOfficialAlertsFor(resolved);

    // 4. Designated facilities from registry filtered to this state/district.
    const [stateHospitals, stateShelters, fallbackHospitals, fallbackShelters] = await Promise.all([
      prisma.hospital.findMany({ where: { state: resolved.state }, take: 4 }).catch(() => []),
      prisma.shelter.findMany({ where: { state: resolved.state }, take: 4 }).catch(() => []),
      prisma.hospital.findMany({ take: 3 }).catch(() => []),
      prisma.shelter.findMany({ take: 3 }).catch(() => []),
    ]);
    const nearestHospitals = stateHospitals.length ? stateHospitals : fallbackHospitals;
    const nearestShelters = stateShelters.length ? stateShelters : fallbackShelters;

    // 5. Build location-specific hazards from LIVE data + real alerts.
    const activeHazards = this.buildHazards(resolved, liveWeather, liveAqi, quakeSummary, officialAlerts);

    // 6. Flood staging from live rainfall + regional exposure.
    const rainfallMm = Math.round(((liveWeather?.precipitationMm24h ?? 0) as number) * 10) / 10;
    const floodRiskStage = this.floodStage(resolved, rainfallMm, officialAlerts);

    // 7. Deterministic risk score: live telemetry blended with the
    // state baseline, then ESCALATED by real official alerts.
    const telemetry = normalizeTelemetry({
      location: `${resolved.city}, ${resolved.state}`,
      coordinates: { lat: resolved.lat, lng: resolved.lng },
      weather: liveWeather,
      fallbackWeather: liveWeather
        ? undefined
        : { temperature: 28, condition: 'Observation unavailable', humidity: 70, windSpeed: 10, rainProbability: 20 },
      airQuality: liveAqi,
      quakes: quakeSummary,
    });
    const baseline = baselineForState(resolved.state);
    const computed = computeRiskScore(telemetry, baseline);
    let riskScore = computed.score;
    const contributors = [...computed.contributors];
    let alertEscalation = 0;
    for (const a of officialAlerts) {
      if (a.severity === 'CRITICAL') alertEscalation += 14;
      else if (a.severity === 'WARNING') alertEscalation += 10;
      else if (a.severity === 'WATCH') alertEscalation += 6;
    }
    if (alertEscalation > 0) {
      riskScore = Math.min(97, riskScore + Math.min(24, alertEscalation));
      contributors.push(`${officialAlerts.length} active official alert(s) for this region (+${Math.min(24, alertEscalation)})`);
    }
    const overallRiskLevel: RiskAnalysisResult['overallRiskLevel'] =
      riskScore >= 85 ? 'SEVERE' : riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MODERATE' : 'LOW';

    const hasLive =
      !!liveWeather || !!liveAqi || (quakeSummary?.source === 'usgs') || officialAlerts.length > 0;

    const displayLocation =
      resolved.granularity === 'state'
        ? `${resolved.state}`
        : resolved.city === resolved.district
          ? `${resolved.city}, ${resolved.state}`
          : `${resolved.city}, ${resolved.district}, ${resolved.state}`;

    const liveSources = [
      ...(liveWeather ? ['open-meteo'] : []),
      ...(liveAqi ? ['open-meteo-aq'] : []),
      ...(quakeSummary && quakeSummary.source === 'usgs' ? ['usgs'] : []),
      ...(officialAlerts.length ? ['sachet-official'] : []),
    ];

    const result: RiskAnalysisResult = {
      location: displayLocation,
      state: resolved.state,
      district: resolved.district,
      coordinates: { lat: resolved.lat, lng: resolved.lng },
      overallRiskLevel,
      riskScore,
      forecastWindow: 'Next 24–48 Hours (live observation window)',
      rainfallExpectedMm: rainfallMm,
      floodRiskStage,
      activeHazards,
      affectedZones: this.affectedZones(resolved, officialAlerts),
      whatToDo: this.whatToDo(resolved, activeHazards),
      whatNotToDo: this.whatNotToDo(activeHazards),
      nearestHospitals,
      nearestShelters,
      emergencyContacts: this.emergencyContacts(resolved),
      scientificDisclaimer:
        'JeevanGrid risk assessment computed from LIVE observations at query time ' +
        `(Open-Meteo weather${liveAqi ? ' + air quality' : ''}${quakeSummary?.source === 'usgs' ? ' + USGS seismicity' : ''}` +
        `${officialAlerts.length ? ` + ${officialAlerts.length} verified official alert(s)` : ''}). ` +
        'Seismic zoning indicates structural vulnerability, NOT earthquake prediction. ' +
        'Always follow official IMD / NDMA-SACHET / DDMA bulletins for evacuation orders.',
      isDemoData: !hasLive,
    };

    (result as any).telemetry = {
      temperatureC: telemetry.temperatureC,
      condition: telemetry.condition,
      humidityPct: telemetry.humidityPct,
      windKph: telemetry.windKph,
      rainProbabilityPct: telemetry.rainProbabilityPct,
      rainfallMm24h: telemetry.rainfallMm24h,
      usAqi: telemetry.usAqi,
      aqiStatus: telemetry.aqiStatus,
    };
    (result as any).riskContributors = contributors;
    (result as any).liveSources = liveSources;
    (result as any).resolvedGeo = resolved;
    (result as any).officialAlerts = officialAlerts.map((a) => ({
      id: a.id,
      title: cleanAlertText(a.title, 200),
      headline: cleanAlertText(a.headline, 200),
      description: cleanAlertText(a.description, 600),
      instruction: cleanAlertText(a.instruction, 600),
      severity: a.severity,
      hazardType: a.hazardType,
      eventType: a.eventType,
      authority: a.authority,
      source: a.source,
      sourceUrl: a.sourceUrl,
      state: a.state,
      district: a.district,
      issuedAt: a.issuedAt,
      issuedIST: toIST(a.issuedAt),
      expiresAt: a.expiresAt,
      verification: { verified: true, live: true, label: 'LIVE' },
    }));
    (result as any).dataProvenance = {
      geocoding: resolved.matchedFromGeoIndex ? 'gazetteer + Assets/geo index' : 'live Nominatim (OpenStreetMap)',
      weather: liveWeather ? 'live Open-Meteo' : 'unavailable',
      airQuality: liveAqi ? 'live Open-Meteo (CAMS)' : 'unavailable',
      seismicity: quakeSummary?.source === 'usgs' ? `live USGS (${quakeSummary.count} events / 500 km)` : 'USGS unreachable',
      officialAlerts: officialAlerts.length
        ? `${officialAlerts.length} verified live alert(s) from ${[...new Set(officialAlerts.map((a) => a.source))].join(', ')}`
        : 'no active verified official alerts for this location right now',
      observedAt: new Date().toISOString(),
    };

    return result;
  }

  /** Verified, non-expired, non-demo official alerts relevant to a place. */
  private async findOfficialAlertsFor(resolved: ResolvedLocation): Promise<any[]> {
    try {
      const now = new Date();
      const tokens = [resolved.city, resolved.district, resolved.state]
        .filter(Boolean)
        .map((t) => String(t).trim())
        .filter((t) => t.length > 1 && t.toLowerCase() !== 'india');
      const or: any[] = [
        { state: resolved.state },
        { district: resolved.district },
      ];
      for (const t of tokens) {
        or.push({ state: { contains: t, mode: 'insensitive' } });
        or.push({ district: { contains: t, mode: 'insensitive' } });
        or.push({ affectedAreas: { contains: t, mode: 'insensitive' } });
        or.push({ title: { contains: t, mode: 'insensitive' } });
      }
      const rows = await prisma.disasterAlert.findMany({
        where: {
          sourceType: 'OFFICIAL',
          isVerified: true,
          isDemoData: false,
          status: { in: ['ACTIVE', 'UPDATED'] },
          AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, { OR: or }],
        },
        orderBy: { issuedAt: 'desc' },
        take: 20,
      });
      // Fail-closed per row: must carry upstream provenance.
      return rows.filter((a: any) => a.sourceAlertId && (a.sourceUrl || a.sourceReference));
    } catch (e) {
      console.warn('Official alert lookup failed:', (e as Error).message);
      return [];
    }
  }

  private floodStage(resolved: ResolvedLocation, rainfallMm: number, officialAlerts: any[]): string {
    const floodAlert = officialAlerts.find((a) => /flood|inundat|river/i.test(`${a.hazardType} ${a.eventType} ${a.title}`));
    if (floodAlert) return cleanAlertText(`Official ${floodAlert.severity} — ${floodAlert.headline || floodAlert.title} (${floodAlert.district || floodAlert.state})`, 140);
    const prone = FLOOD_PRONE.has(resolved.state);
    if (rainfallMm >= 100) return prone ? 'Warning Stage (intense 24h rainfall on flood-prone basin)' : 'Warning Stage (intense 24h rainfall observed)';
    if (rainfallMm >= 50) return prone ? 'Moderate — rivers/urban drains rising in flood-prone region' : 'Moderate (heavy 24h rainfall observed)';
    if (rainfallMm >= 20) return 'Watch — waterlogging possible in low-lying pockets';
    return prone
      ? 'Normal flow (no intense rainfall observed in last 24h; basin monitoring continues)'
      : 'Normal (no intense rainfall observed in last 24h)';
  }

  private buildHazards(
    resolved: ResolvedLocation,
    weather: LiveWeather | null,
    aqi: LiveAirQuality | null,
    quakes: QuakeSummary | null,
    officialAlerts: any[]
  ): HazardDetail[] {
    const hazards: HazardDetail[] = [];

    // 1. REAL official alerts first — these are actual government warnings.
    for (const a of officialAlerts.slice(0, 6)) {
      hazards.push({
        type: `${a.hazardType || 'Hazard'} — Official Alert (${a.source})`,
        level: severityToHazardLevel(a.severity),
        status: severityToStatus(a.severity) as HazardDetail['status'],
        description: cleanAlertText(
          `${a.headline || a.title} Issued by ${a.authority || a.source}` +
          `${a.issuedAt ? ` at ${toIST(a.issuedAt)}` : ''}. ${a.description || ''}`, 280),
      });
    }

    // 2. Live rainfall hazard for THESE coordinates.
    if (weather) {
      const mm = weather.precipitationMm24h;
      const prob = weather.rainProbability;
      if (mm >= 100 || /thunderstorm|violent|heavy rain/i.test(weather.condition)) {
        hazards.push({
          type: 'Heavy Rain & Storm',
          level: 'High',
          status: 'WARNING',
          description: `Live observation over ${resolved.city}: ${weather.condition}, ${mm} mm in 24h, rain probability ${prob}%, winds ${weather.windSpeedKph} km/h. Expect waterlogging in low-lying pockets.`,
        });
      } else if (mm >= 50 || prob >= 70) {
        hazards.push({
          type: 'Rain & Waterlogging',
          level: 'Moderate',
          status: 'WATCH',
          description: `Live observation over ${resolved.city}: ${weather.condition}, ${mm} mm in 24h, rain probability ${prob}%. Urban drains and underpasses may pond.`,
        });
      } else if (mm >= 10 || prob >= 40 || /rain|shower|drizzle/i.test(weather.condition)) {
        hazards.push({
          type: 'Showers',
          level: 'Low',
          status: 'FORECAST',
          description: `Live observation over ${resolved.city}: ${weather.condition}, ${mm} mm in 24h, rain probability ${prob}%. Brief showers possible; no red staging.`,
        });
      } else {
        hazards.push({
          type: 'Dry / Settled Weather',
          level: 'Low',
          status: 'FORECAST',
          description: `Live observation over ${resolved.city}: ${weather.condition}, ${weather.temperature}°C, only ${mm} mm in 24h. No rainfall-driven staging.`,
        });
      }

      // 3. Heat / wind from the same live observation.
      if (weather.temperature >= 42) {
        hazards.push({
          type: 'Severe Heat Stress',
          level: 'High',
          status: 'WARNING',
          description: `Live ${weather.temperature}°C over ${resolved.city} with humidity ${weather.humidity}%. High heat-illness risk 12–4 PM.`,
        });
      } else if (weather.temperature >= 38) {
        hazards.push({
          type: 'Heat Discomfort',
          level: 'Moderate',
          status: 'WATCH',
          description: `Live ${weather.temperature}°C over ${resolved.city}. Hydrate, shade outdoor labour, check on elders.`,
        });
      }
      if (weather.windSpeedKph >= 60) {
        hazards.push({
          type: 'Damaging Winds',
          level: 'High',
          status: 'WARNING',
          description: `Live winds ${weather.windSpeedKph} km/h over ${resolved.city}. Secure hoardings, avoid glass facades and old trees.`,
        });
      } else if (weather.windSpeedKph >= 40) {
        hazards.push({
          type: 'Gusty Winds',
          level: 'Moderate',
          status: 'WATCH',
          description: `Live winds ${weather.windSpeedKph} km/h over ${resolved.city}. Two-wheeler riders use caution on exposed stretches.`,
        });
      }
    } else {
      hazards.push({
        type: 'Observation Gap',
        level: 'Low',
        status: 'FORECAST',
        description: `Live weather feed unreachable for ${resolved.city} right now. Baseline ${seismicNoteForState(resolved.state).split('(')[0].trim()} applies; follow IMD bulletins.`,
      });
    }

    // 4. Air quality (live).
    if (aqi && aqi.aqi > 0) {
      if (aqi.aqi > 200) {
        hazards.push({
          type: 'Poor Air Quality',
          level: aqi.aqi > 300 ? 'Severe' : 'High',
          status: 'WARNING',
          description: `Live US AQI ${aqi.aqi} (${aqi.status}) over ${resolved.city}: PM2.5 ${aqi.pm25}, PM10 ${aqi.pm10}. N95 outdoors, keep windows shut at peak hours.`,
        });
      } else if (aqi.aqi > 100) {
        hazards.push({
          type: 'Moderate Air Quality',
          level: 'Moderate',
          status: 'WATCH',
          description: `Live US AQI ${aqi.aqi} (${aqi.status}) over ${resolved.city}. Sensitive groups limit prolonged exertion.`,
        });
      }
    }

    // 5. Observed seismicity (USGS — observed events, never predictions)
    // plus the honest baseline zoning note.
    if (quakes && quakes.source === 'usgs' && quakes.strongest && quakes.strongest.magnitude >= 4.5) {
      const s = quakes.strongest;
      hazards.push({
        type: 'Seismic Activity (Observed)',
        level: s.magnitude >= 6 ? 'High' : 'Moderate',
        status: 'WATCH',
        description:
          `USGS observed M${s.magnitude} earthquake near ${s.place} on ${s.time.slice(0, 10)} ` +
          `within ${quakes.radiusKm} km of ${resolved.city}. Observed event, NOT a prediction. Check structures, follow DDMA guidance.`,
      });
    } else {
      hazards.push({
        type: 'Seismic Baseline',
        level: resolved.state === 'Assam' ? 'High' : resolved.state === 'Maharashtra' || resolved.state === 'Gujarat' ? 'Low' : 'Moderate',
        status: 'FORECAST',
        description: `${resolved.city}: ${seismicNoteForState(resolved.state)}.`,
      });
    }

    return hazards.slice(0, 7);
  }

  private affectedZones(resolved: ResolvedLocation, officialAlerts: any[]): string[] {
    const zones: string[] = [];
    if (resolved.granularity === 'state') {
      zones.push(`${resolved.state} — state-wide watch (zoom out view)`);
    } else {
      zones.push(`${resolved.city} municipal wards`);
      if (resolved.district && resolved.district !== resolved.city) zones.push(`${resolved.district} catchment`);
      else zones.push(`${resolved.district} district perimeter`);
    }
    for (const a of officialAlerts.slice(0, 4)) {
      try {
        const areas = a.affectedAreas ? JSON.parse(a.affectedAreas) : null;
        if (Array.isArray(areas)) {
          for (const z of areas.slice(0, 3)) {
            if (typeof z === 'string') {
              const clean = cleanAlertText(z, 80);
              if (clean && !isJunkZone(clean) && !zones.includes(clean)) zones.push(clean);
            }
          }
        } else if (a.district && !isJunkZone(a.district) && !zones.includes(a.district)) {
          zones.push(cleanAlertText(a.district, 80));
        }
      } catch {
        if (a.district && !isJunkZone(a.district) && !zones.includes(a.district)) zones.push(cleanAlertText(a.district, 80));
      }
    }
    return zones.slice(0, 6);
  }

  private whatToDo(resolved: ResolvedLocation, hazards: HazardDetail[]): string[] {
    const steps: string[] = [];
    const has = (re: RegExp) => hazards.some((h) => re.test(h.type));
    if (has(/official alert/i)) steps.push(`Follow the official instructions quoted in the alert(s) above for ${resolved.city}; do not wait for door-to-door warnings.`);
    if (has(/heavy rain|waterlogging|showers/i)) steps.push(`In ${resolved.city}, avoid underpasses and flooded roads, keep phones charged, and track IMD / DDMA (${resolved.district}) bulletins before travel.`);
    if (has(/dry/i)) steps.push(`No rainfall staging over ${resolved.city} right now — use this window to clear drains, service pumps, and restock the 72-hour family kit.`);
    if (has(/heat/i)) steps.push('Avoid 12–4 PM sun, hydrate with ORS, keep elders in ventilated rooms.');
    if (has(/wind/i)) steps.push('Park away from hoardings and old trees; secure rooftop sheets and balconies.');
    if (has(/air quality/i)) steps.push('Sensitive groups wear N95 outdoors and run purifiers indoors if available.');
    if (has(/seismic/i)) steps.push('Keep heavy objects low, know Drop-Cover-Hold, and keep grab bags near exits.');
    steps.push(`Save ${resolved.state} SDMA (1070), district control (1077) and 112 on every family phone.`);
    return steps.slice(0, 6);
  }

  private whatNotToDo(hazards: HazardDetail[]): string[] {
    const list: string[] = [];
    const has = (re: RegExp) => hazards.some((h) => re.test(h.type));
    if (has(/rain|waterlogging|flood|official alert/i)) {
      list.push('Do NOT drive or walk through moving floodwater or submerged underpasses.');
      list.push('Do NOT touch fallen power lines or drink untreated floodwater.');
    }
    if (has(/heat/i)) list.push('Do NOT leave children or elders in parked vehicles under the sun.');
    if (has(/wind/i)) list.push('Do NOT stand under glass facades or fragile hoardings during gusts.');
    if (has(/seismic/i)) list.push('Do NOT use lifts during shaking; do NOT re-enter cracked buildings until cleared.');
    if (!list.length) {
      list.push('Do NOT ignore sudden official alerts even when skies look clear.');
      list.push('Do NOT spread unverified forwards; rely on IMD / SACHET / DDMA channels.');
    }
    return list.slice(0, 4);
  }

  private emergencyContacts(resolved: ResolvedLocation): { service: string; number: string }[] {
    return [
      { service: `${resolved.state} SDMA Control Room`, number: '1070' },
      { service: `${resolved.district} DDMA / District Emergency Center`, number: '1077' },
      { service: 'National Emergency Response Support', number: '112' },
      { service: 'NDRF Search & Rescue', number: '1078' },
      { service: 'Medical Emergency & Ambulance', number: '108' },
      { service: 'Fire Brigade Services', number: '101' },
    ];
  }
}

export const riskEngineService = new RiskEngineService();
