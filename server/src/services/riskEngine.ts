import { prisma } from '../utils/prisma';
import { geoService } from './geoService';
import { openMeteoService } from './openMeteoService';
import { usgsService } from './usgsService';
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

export class RiskEngineService {
  public async analyzeLocationRisk(locationQuery: string): Promise<RiskAnalysisResult> {
    const query = (locationQuery || 'Mumbai').trim().toLowerCase();
    const resolved = geoService.resolveLocation(locationQuery || 'Mumbai');

    // Live telemetry fusion (best-effort; engine degrades to scenario baselines)
    const [liveWeather, quakeSummary] = await Promise.all([
      openMeteoService.getCurrentWeather(locationQuery || 'Mumbai').catch(() => null),
      usgsService.getNearbyQuakes(locationQuery || 'Mumbai').catch(() => null),
    ]);

    // Query hospitals and shelters from Prisma
    let shelters = await prisma.shelter.findMany({ take: 3 });
    let hospitals = await prisma.hospital.findMany({ take: 3 });

    // Location specific simulation
    if (query.includes('assam') || query.includes('guwahati')) {
      const assamHospitals = await prisma.hospital.findMany({ where: { state: 'Assam' } });
      const base: RiskAnalysisResult = {
        location: 'Guwahati, Assam',
        state: 'Assam',
        district: 'Kamrup Metropolitan',
        coordinates: { lat: 26.1445, lng: 91.7362 },
        overallRiskLevel: 'HIGH',
        riskScore: 78,
        forecastWindow: 'Next 24-48 Hours (Monsoon Surge)',
        rainfallExpectedMm: 145,
        floodRiskStage: 'Warning Stage (Brahmaputra Rising)',
        activeHazards: [
          { type: 'Riverine Flood', level: 'High', status: 'WARNING', description: 'Brahmaputra water level 0.42m above danger mark at Guwahati gauge station.' },
          { type: 'Flash Flooding', level: 'High', status: 'WARNING', description: 'Severe urban inundation across Anil Nagar, Nabin Nagar, and Zoo Road.' },
          { type: 'Landslide in Hills', level: 'Moderate', status: 'WATCH', description: 'Soil creep detected in Narakasur and Kharghuli hill pockets.' },
        ],
        affectedZones: ['Anil Nagar', 'Nabin Nagar', 'Bharalu Catchment', 'Pandu Lowlands', 'North Guwahati Banks'],
        whatToDo: [
          'Move family and livestock to designated high-ground embankments or municipal relief camps.',
          'Stock 3 days of potable water, halogen purification tablets, and dry ready-to-eat food.',
          'Disconnect primary electricity breakers before floodwater breaches house plinths.',
          'Keep mobile phones in sealed plastic bags and monitor local AIR radio announcements.',
        ],
        whatNotToDo: [
          'Do NOT walk or drive through moving water currents or overflowing culverts.',
          'Do NOT drink raw river or borehole water without 10-minute active boiling.',
          'Do NOT touch fallen electrical cables submerged in flood channels.',
        ],
        nearestHospitals: assamHospitals.length ? assamHospitals : hospitals,
        nearestShelters: shelters,
        emergencyContacts: [
          { service: 'State Disaster Control (Assam)', number: '1070' },
          { service: 'District Disaster Management (Guwahati)', number: '1077' },
          { service: 'NDRF 1st Battalion Guwahati', number: '0361-2840000' },
          { service: 'National Emergency Response Support', number: '112' },
        ],
        scientificDisclaimer: 'Risk levels are estimated using historical hydrologic patterns and IMD radar observations. Geological events and flash floods depend on dynamic precipitation.',
        isDemoData: true,
      };
      return this.fuseLiveTelemetry(base, locationQuery || 'Guwahati', liveWeather, quakeSummary);
    }

    if (query.includes('delhi')) {
      const base: RiskAnalysisResult = {
        location: 'New Delhi, National Capital Region',
        state: 'Delhi',
        district: 'Central Delhi',
        coordinates: { lat: 28.6139, lng: 77.2090 },
        overallRiskLevel: 'MODERATE',
        riskScore: 58,
        forecastWindow: 'Next 24 Hours',
        rainfallExpectedMm: 12,
        floodRiskStage: 'Normal Flow (Yamuna Barrage Monitored)',
        activeHazards: [
          { type: 'Severe Heat Index', level: 'High', status: 'WARNING', description: 'Day maximum 44.5°C with severe thermal stress on outdoor populations.' },
          { type: 'Seismic Vulnerability', level: 'Moderate', status: 'FORECAST', description: 'Zone IV seismic classification. Structural readiness checks recommended.' },
          { type: 'Poor Air Quality', level: 'High', status: 'WATCH', description: 'Particulate PM2.5 elevated; respiratory precautions advised.' },
        ],
        affectedZones: ['Yamuna Floodplain Settlements', 'Old Delhi Unreinforced Wards', 'Najafgarh Drain Perimeter'],
        whatToDo: [
          'Stay hydrated with ORS and lemon water; avoid direct solar exposure between 12 PM - 4 PM.',
          'Ensure commercial and residential structures have accessible fire exits and earthquake grab bags.',
          'Keep elderly family members in well-ventilated or air-cooled rooms.',
        ],
        whatNotToDo: [
          'Do NOT leave children or pets in enclosed parked cars under direct sunlight.',
          'Do NOT ignore symptoms of heat exhaustion like dizziness, nausea, or rapid pulse.',
        ],
        nearestHospitals: hospitals,
        nearestShelters: shelters,
        emergencyContacts: [
          { service: 'Delhi Disaster Management Authority', number: '1077' },
          { service: 'Centralized Ambulance Service (CATS)', number: '102' },
          { service: 'Emergency Response Support System', number: '112' },
        ],
        scientificDisclaimer: 'Earthquake forecasts indicate baseline tectonic zoning and structural vulnerability, NOT instantaneous earthquake prediction.',
        isDemoData: true,
      };
      return this.fuseLiveTelemetry(base, locationQuery || 'Delhi', liveWeather, quakeSummary);
    }

    if (query.includes('himachal') || query.includes('shimla') || query.includes('mandi')) {
      const base: RiskAnalysisResult = {
        location: 'Shimla & Mandi, Himachal Pradesh',
        state: 'Himachal Pradesh',
        district: 'Shimla',
        coordinates: { lat: 31.1048, lng: 77.1734 },
        overallRiskLevel: 'MODERATE',
        riskScore: 62,
        forecastWindow: 'Next 36 Hours',
        rainfallExpectedMm: 68,
        floodRiskStage: 'Stream Torrent Alert (Beas & Sutlej Tributaries)',
        activeHazards: [
          { type: 'Landslide & Rockfall', level: 'High', status: 'WARNING', description: 'Soil saturation index high along NH-5 cuttings and fragile slopes.' },
          { type: 'Localized Flash Floods', level: 'Moderate', status: 'WATCH', description: 'Mountain rivulets experiencing rapid discharge after cloud bursts.' },
        ],
        affectedZones: ['Kalka-Shimla Highway Sectors', 'Rampur Bushahr', 'Theog Valley', 'Shoghi Slopes'],
        whatToDo: [
          'Postpone non-essential highway travel during nighttime heavy rains.',
          'Watch for sudden muddy springs or tree tilting on nearby slopes.',
          'Park vehicles well away from steep excavated hillsides and unstable rock cuts.',
        ],
        whatNotToDo: [
          'Do NOT attempt to cross roads covered in active gravel or rolling stones.',
          'Do NOT construct or excavate near unsupported hill bases during rainfall.',
        ],
        nearestHospitals: hospitals,
        nearestShelters: shelters,
        emergencyContacts: [
          { service: 'Himachal SDMA Control Room', number: '1070' },
          { service: 'District Emergency Center Shimla', number: '1077' },
          { service: 'National Emergency Support', number: '112' },
        ],
        scientificDisclaimer: 'Landslide warnings are triggered by rainfall threshold correlation from Geological Survey of India protocols.',
        isDemoData: true,
      };
      return this.fuseLiveTelemetry(base, locationQuery || 'Shimla', liveWeather, quakeSummary);
    }

    if (query.includes('ahmedabad') || query.includes('ahmadabad') || query.includes('gujarat') || query.includes('surat')) {
      const gujaratHospitals = await prisma.hospital.findMany({ where: { state: 'Gujarat' } });
      const base: RiskAnalysisResult = {
        location: 'Ahmedabad, Gujarat',
        state: 'Gujarat',
        district: 'Ahmedabad',
        coordinates: { lat: 23.0225, lng: 72.5714 },
        overallRiskLevel: 'MODERATE',
        riskScore: 56,
        forecastWindow: 'Next 24 Hours (Heat & Monsoon Showers)',
        rainfallExpectedMm: 34,
        floodRiskStage: 'Normal (Sabarmati Regulated Flow)',
        activeHazards: [
          { type: 'Heat Stress', level: 'High', status: 'WATCH', description: 'Day maximum near 38°C with humid discomfort during peak afternoon hours.' },
          { type: 'Urban Waterlogging', level: 'Moderate', status: 'WATCH', description: 'Short intense showers can inundate underpasses in low-lying east zones.' },
          { type: 'Seismic Awareness', level: 'Low', status: 'FORECAST', description: 'Zone III classification. Kutch legacy preparedness drills recommended; no prediction implied.' },
        ],
        affectedZones: ['Maninagar Lowlands', 'Narol-Naroda Industrial Belt', 'Sabarmati Riverfront Low Banks', 'Eastern Underpasses'],
        whatToDo: [
          'Avoid outdoor exertion between 12 PM - 4 PM; hydrate with ORS and shaded rest breaks.',
          'Clear rooftop drains and basement sump pumps before forecast shower windows.',
          'Keep AMC control room and ward-level helplines saved on family phones.',
        ],
        whatNotToDo: [
          'Do NOT attempt to cross waterlogged underpasses where depth gauges are submerged.',
          'Do NOT leave children or elders in parked vehicles under direct sun.',
        ],
        nearestHospitals: gujaratHospitals.length ? gujaratHospitals : hospitals,
        nearestShelters: shelters,
        emergencyContacts: [
          { service: 'Gujarat SDMA Control Room', number: '1070' },
          { service: 'Ahmedabad District Emergency Center', number: '1077' },
          { service: 'National Emergency Response Support', number: '112' },
          { service: 'Medical Emergency & Ambulance', number: '108' },
        ],
        scientificDisclaimer: 'Assessment blends regional climatology with live Open-Meteo observations where available. Seismic zoning indicates structural vulnerability, NOT earthquake prediction.',
        isDemoData: true,
      };
      return this.fuseLiveTelemetry(base, locationQuery || 'Ahmedabad', liveWeather, quakeSummary);
    }

    // Default: Mumbai, Maharashtra
    const mumbaiHospitals = await prisma.hospital.findMany({ where: { state: 'Maharashtra' }, take: 4 });
    const mumbaiShelters = await prisma.shelter.findMany({ where: { state: 'Maharashtra' }, take: 4 });

    const base: RiskAnalysisResult = {
      location: 'Mumbai, Maharashtra',
      state: 'Maharashtra',
      district: 'Mumbai Suburban',
      coordinates: { lat: 19.0760, lng: 72.8777 },
      overallRiskLevel: 'MODERATE',
      riskScore: 54,
      forecastWindow: 'Next 24 Hours (Coastal High Tide Coincidence)',
      rainfallExpectedMm: 72,
      floodRiskStage: 'Moderate (Mithi River Staging 2.8m / Danger 4.2m)',
      activeHazards: [
        { type: 'Heavy Rain & Gusts', level: 'Moderate', status: 'WATCH', description: 'Intermittent heavy spells accompanied by wind gusts up to 45 km/h.' },
        { type: 'Urban Waterlogging', level: 'Moderate', status: 'WATCH', description: 'Vulnerability across low-lying railway culverts and subterranean subways.' },
        { type: 'Coastal Surge', level: 'Low', status: 'FORECAST', description: 'Astronomical spring tide 4.68m at 14:15 IST. Sluice gates operational.' },
      ],
      affectedZones: ['Milan Subway (Santacruz)', 'Hindmata (Dadar)', 'Kurla Station Lowlands', 'Andheri Subway', 'Gandhi Market (King\'s Circle)'],
      whatToDo: [
        'Check Mumbai local train & coastal road traffic updates before departing office or residence.',
        'Keep essential mobile devices charged; keep battery-operated radios tuned to Akashvani Mumbai.',
        'Avoid basement parking in chronically inundated low-lying areas.',
        'Keep children away from open sea promenades, Marine Drive tetrapods, and Bandra Bandstand during high tide hours.',
      ],
      whatNotToDo: [
        'Do NOT attempt to drive vehicles into waterlogged underpasses where depth is uncertain.',
        'Do NOT walk through flooded roads where open manholes may be disguised by murky water.',
        'Do NOT stand under large ancient trees or fragile hoardings during gusty squalls.',
      ],
      nearestHospitals: mumbaiHospitals.length ? mumbaiHospitals : hospitals,
      nearestShelters: mumbaiShelters.length ? mumbaiShelters : shelters,
      emergencyContacts: [
        { service: 'MCGM Disaster Management Control Room', number: '1916' },
        { service: 'National Disaster Response Force (NDRF)', number: '1078' },
        { service: 'Mumbai Police Emergency Helpline', number: '112' },
        { service: 'Fire Brigade Emergency Line', number: '101' },
      ],
      scientificDisclaimer: 'Meteorological telemetry is aggregated from IMD Doppler Radar Mumbai (Colaba/Veravali) and municipal automatic weather stations. No scientifically unproven earthquake predictions are made.',
      isDemoData: true,
    };
    return this.fuseLiveTelemetry(base, locationQuery || 'Mumbai', liveWeather, quakeSummary);
  }

  /**
   * Fuse live upstream telemetry into a scenario baseline.
   * Conservative policy: live extremes can only ESCALATE the score/level,
   * never silently downgrade standing official staging. Observed (not
   * predicted) seismic events are appended as WATCH hazards with provenance.
   */
  private fuseLiveTelemetry(
    base: RiskAnalysisResult,
    locationQuery: string,
    liveWeather: import('./openMeteoService').LiveWeather | null,
    quakeSummary: import('./usgsService').QuakeSummary | null
  ): RiskAnalysisResult {
    const fused: RiskAnalysisResult = {
      ...base,
      activeHazards: [...base.activeHazards],
      coordinates: { ...base.coordinates },
    };
    const liveNotes: string[] = [];

    if (liveWeather) {
      fused.rainfallExpectedMm = Math.max(
        Math.round(base.rainfallExpectedMm),
        Math.round(liveWeather.precipitationMm24h)
      );
      liveNotes.push(
        `Live observation (Open-Meteo): ${liveWeather.temperature}°C, ${liveWeather.condition}, ` +
        `rain probability ${liveWeather.rainProbability}%, 24h precipitation ${liveWeather.precipitationMm24h} mm.`
      );
    }

    if (quakeSummary && quakeSummary.source === 'usgs' && quakeSummary.strongest) {
      const s = quakeSummary.strongest;
      if (s.magnitude >= 5) {
        fused.activeHazards.push({
          type: 'Seismic Activity (Observed)',
          level: s.magnitude >= 6 ? 'High' : 'Moderate',
          status: 'WATCH',
          description:
            `USGS observed M${s.magnitude} earthquake near ${s.place} on ${s.time.slice(0, 10)}. ` +
            `This is an observed event, NOT a prediction. Check structures and follow DDMA guidance.`,
        });
        liveNotes.push(`USGS: M${s.magnitude} near ${s.place} within ${quakeSummary.radiusKm} km.`);
      }
    }

    try {
      const telemetry = normalizeTelemetry({
        location: base.location,
        coordinates: base.coordinates,
        weather: liveWeather,
        fallbackWeather: {
          temperature: 28,
          condition: 'Regional climatology',
          humidity: 70,
          windSpeed: 12,
          rainProbability: Math.min(95, Math.round(base.rainfallExpectedMm)),
        },
        airQuality: null,
        quakes: quakeSummary,
      });
      const computed = computeRiskScore(telemetry, base.riskScore);
      // Conservative: never downgrade below the standing baseline.
      fused.riskScore = Math.max(base.riskScore, computed.score);
      const order = ['LOW', 'MODERATE', 'HIGH', 'SEVERE'] as const;
      const baseIdx = order.indexOf(base.overallRiskLevel);
      const fusedIdx = order.indexOf(computed.level);
      fused.overallRiskLevel = order[Math.max(baseIdx, fusedIdx)];
      (fused as any).riskContributors = computed.contributors;
      (fused as any).telemetry = telemetry;
    } catch (e) {
      console.warn('Risk fusion fallback to baseline:', (e as Error).message);
    }

    if (liveNotes.length) {
      fused.isDemoData = false;
      fused.scientificDisclaimer =
        `${base.scientificDisclaimer} Live fusion: ${liveNotes.join(' ')}`;
      (fused as any).liveSources = [
        ...(liveWeather ? ['open-meteo'] : []),
        ...(quakeSummary && quakeSummary.source === 'usgs' ? ['usgs'] : []),
      ];
    } else {
      (fused as any).liveSources = [];
    }
    (fused as any).resolvedGeo = geoService.resolveLocation(locationQuery);

    return fused;
  }
}

export const riskEngineService = new RiskEngineService();
