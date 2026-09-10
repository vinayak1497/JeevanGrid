import { prisma } from '../utils/prisma';
import { geoService } from './geoService';
import { weatherService } from './weatherService';
import { aqiService } from './aqiService';
import { usgsService } from './usgsService';
import { riskEngineService } from './riskEngine';
import { nugenService } from './nugenService';
import { deepseekService } from './deepseekService';
import { HELPLINES } from './helplinesService';
import { getFacilities } from './facilitiesService';
import { aiT } from './language/aiLocal';

/**
 * JeevanGrid AI Orchestrator.
 *
 * USER -> intent detection -> safety/policy layer -> whitelisted tools ->
 * context assembly -> Nugen / DeepSeek / local engine -> validation ->
 * structured reply. Every tool call is logged; consequential actions
 * (dispatch, requests) are never performed — only suggested with
 * explicit confirmation UI on the client.
 */

export type SupportedLanguage = 'en' | 'hi' | 'mr' | 'gu' | 'as';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'hi', 'mr', 'gu', 'as'];

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  hi: 'Hindi (हिन्दी)',
  mr: 'Marathi (मराठी)',
  gu: 'Gujarati (ગુજરાતી)',
  as: 'Assamese (অসমীয়া)',
};

type Intent =
  | 'emergency'
  | 'risk'
  | 'weather'
  | 'aqi'
  | 'quake'
  | 'alerts'
  | 'hospital'
  | 'shelter'
  | 'contacts'
  | 'guidance'
  | 'kit'
  | 'district'
  | 'greeting';

export interface ReplySection {
  key: string;
  title: string;
  level: 'info' | 'warning' | 'critical';
  body?: string;
  items?: string[];
  contacts?: Array<{ service: string; number: string }>;
  facilities?: Array<{ name: string; detail: string; phone?: string; distanceKm?: number }>;
}

export interface ReplyAction {
  kind: 'navigate' | 'tel' | 'suggest';
  label: string;
  to?: string;
  number?: string;
  query?: string;
}

export interface ToolStep {
  key: string;
  label: string;
  status: 'done' | 'skipped';
  detail?: string;
}

export interface OrchestratedReply {
  emergency: boolean;
  headline: string;
  sections: ReplySection[];
  actions: ReplyAction[];
  sources: Array<{ label: string; kind: 'live' | 'official' | 'model' | 'guidance' }>;
  toolActivity: ToolStep[];
  provider: 'nugen' | 'deepseek' | 'local';
  language: SupportedLanguage;
  languageFallback: boolean;
  // Backward-compatible flat fields
  response: string;
  recommendedActions: string[];
  isLifeThreateningWarning: boolean;
  source: string;
  modelUsed?: string;
}

export interface OrchestratorInput {
  messages: Array<{ role: string; content: string }>;
  location?: string;
  coords?: { lat: number; lng: number };
  language?: string;
}

// ---- intent patterns -------------------------------------------------------

const EMERGENCY_PATTERNS: Array<{ test: RegExp; reason: string }> = [
  { test: /\btrapped\b|\bstuck\b|cannot (get )?out|phasa/i, reason: 'Person may be trapped' },
  { test: /can'?t breathe|breathing (trouble|problem)|choking|chest pain/i, reason: 'Medical breathing emergency' },
  { test: /house .*flood|water (is |has been )?(rising|entering|inside)|flooding (my|our|the) (house|home|flat)/i, reason: 'Flooding at residence' },
  { test: /\bfire\b|burning|smoke (everywhere|filling)|gas leak|smell gas|lpg/i, reason: 'Fire or gas hazard' },
  { test: /injur|bleeding|ambulance|unconscious|casualt/i, reason: 'Injury or medical emergency' },
  { test: /collapse|debris on|buried|swept away|drowning/i, reason: 'Collapse or drowning risk' },
  { test: /fas[ae]? gaya|phas gaya|madad|bachao/i, reason: 'Distress signal (Hindi/Hinglish)' },
];

const INTENT_RULES: Array<{ intent: Intent; test: RegExp }> = [
  { intent: 'risk', test: /safe|risk|danger (in|near|around)|situation|threat|alert.*(area|here)|what.*happen/i },
  { intent: 'weather', test: /weather|rain|temperature|forecast|tomorrow|storm|wind|monsoon|heat/i },
  { intent: 'aqi', test: /\baqi\b|air quality|pollution|smog|pm2/i },
  { intent: 'quake', test: /earthquake|tremor|shaking|seismic|भूकंप/i },
  { intent: 'alerts', test: /warning|advisory|alert|imd|sachet|official/i },
  { intent: 'hospital', test: /hospital|doctor|medical|clinic|ambulance|dawai|aspatal/i },
  { intent: 'shelter', test: /shelter|relief camp|stay|evacuat|accommodat|sharan/i },
  { intent: 'contacts', test: /contact|helpline|phone|number|call.*(ndrf|police|fire)|112|1078|emergency (number|contact)/i },
  { intent: 'kit', test: /kit|pack|carry|suppl|bag|checklist|taiyaari/i },
  { intent: 'district', test: /district|state|region|zone|tehsil|jilla/i },
  { intent: 'guidance', test: /what (should|to) do|how (do|to|can)|guidance|protocol|steps|safety|protect|prepare|do's|dont/i },
  { intent: 'greeting', test: /^(hi|hii+|hello|hey|namaste|namaskar|salaam)\b/i },
];

const INJECTION_TEST = /ignore (all )?previous instructions|system prompt|you are now|jailbreak|dan mode/i;

// ---- tool log (in-memory ring) ----------------------------------------------

interface ToolLogEntry {
  at: string;
  tool: string;
  location: string;
  ok: boolean;
  ms: number;
}

const toolLog: ToolLogEntry[] = [];

function logTool(tool: string, location: string, ok: boolean, ms: number): void {
  toolLog.push({ at: new Date().toISOString(), tool, location, ok, ms });
  if (toolLog.length > 200) toolLog.shift();
  console.info(`[ai-tools] ${tool} @ ${location} ok=${ok} ${ms}ms`);
}

export function getToolLog(): ToolLogEntry[] {
  return [...toolLog];
}

// ---- local guidance knowledge -----------------------------------------------

function guidanceFor(query: string): { title: string; level: ReplySection['level']; steps: string[]; avoid: string[] } {
  if (/flood|water|drown|submerg|barish|paani/.test(query)) {
    return {
      title: 'Flood and waterlogging protocol',
      level: 'warning',
      steps: [
        'Move to upper floors or the highest available ground. Do not wade or drive through flowing water.',
        'Turn off the main electrical switch and close the LPG regulator valve.',
        'Boil all drinking water or use chlorine tablets.',
        'Keep phone, torch and power bank in a waterproof bag.',
      ],
      avoid: ['Crossing flooded roads or bridges', 'Drinking untreated water', 'Touching submerged electric cables'],
    };
  }
  if (/earthquake|tremor|shaking|quake/.test(query)) {
    return {
      title: 'Earthquake immediate actions',
      level: 'warning',
      steps: [
        'DROP, COVER, HOLD ON under a sturdy table. Protect head and neck.',
        'Stay away from glass, windows, exterior walls and heavy shelves.',
        'Do not use elevators. Do not run outside while shaking continues.',
        'After shaking: check for gas smell; if present, leave and do not touch switches.',
      ],
      avoid: ['Using elevators during tremors', 'Standing near glass or facades', 'Re-entering damaged buildings'],
    };
  }
  if (/gas|smell|lpg|1906/.test(query)) {
    return {
      title: 'Gas leak protocol',
      level: 'critical',
      steps: [
        'Do NOT touch any electrical switch, fan or matchstick.',
        'Open all doors and windows to ventilate.',
        'Close the cylinder valve clockwise if safe to reach.',
        'Leave the building and call 101 / 112 / 1906 from outside.',
      ],
      avoid: ['Switching anything electrical on or off', 'Lighting flames to check the leak', 'Staying inside to investigate'],
    };
  }
  if (/cyclone|toofan|storm surge/.test(query)) {
    return {
      title: 'Cyclone preparedness',
      level: 'warning',
      steps: [
        'Move to a designated cyclone shelter before landfall if advised by authorities.',
        'Secure loose rooftop items; board up large glass panes.',
        'Stock 72 hours of water, food, medicines and power backup.',
        'Stay indoors during landfall; beware the calm eye — winds return.',
      ],
      avoid: ['Going outdoors during the storm eye', 'Sheltering under weak structures', 'Ignoring evacuation orders'],
    };
  }
  if (/heat|loo|temperature.*hot|garmi/.test(query)) {
    return {
      title: 'Extreme heat protocol',
      level: 'warning',
      steps: [
        'Avoid sun between 12 PM and 4 PM. Rest in shade or cooled rooms.',
        'Drink water and ORS frequently, even without thirst.',
        'Wear light cotton clothing; cover head outdoors.',
        'Watch for dizziness, nausea, rapid pulse — move to cool place and seek care.',
      ],
      avoid: ['Leaving children or elders in parked vehicles', 'Heavy exertion at midday', 'Alcohol or excess caffeine'],
    };
  }
  return {
    title: 'General emergency readiness',
    level: 'info',
    steps: [
      'Ensure personal safety first, then help family members.',
      'Follow District Disaster Management Authority (DDMA) announcements.',
      'Keep emergency numbers saved: 112, 1078, 108.',
      'Check your local JeevanGrid risk forecast before travelling.',
    ],
    avoid: ['Spreading unverified forwards or rumours', 'Ignoring official evacuation guidance'],
  };
}

// ---- orchestrator ------------------------------------------------------------

export class AiOrchestrator {
  public async handle(input: OrchestratorInput): Promise<OrchestratedReply> {
    const rawMessages = Array.isArray(input.messages) ? input.messages : [];
    const lastUser = [...rawMessages].reverse().find((m) => m.role === 'user');
    const query = String(lastUser?.content || '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .trim()
      .slice(0, 2000);
    const q = query.toLowerCase();

    const language: SupportedLanguage = SUPPORTED_LANGUAGES.includes(input.language as SupportedLanguage)
      ? (input.language as SupportedLanguage)
      : 'en';
    const languageFallback = input.language !== undefined && !SUPPORTED_LANGUAGES.includes(input.language as SupportedLanguage);

    const injectionFlag = INJECTION_TEST.test(query);

    // Location resolution: explicit > device coords > default
    const resolved = input.coords && Number.isFinite(input.coords.lat)
      ? geoService.nearestCity(Number(input.coords.lat), Number(input.coords.lng))
      : geoService.resolveLocation(input.location || 'Mumbai');
    const locLabel = `${resolved.city}, ${resolved.state}`;

    // Intent detection
    const emergencyHit = EMERGENCY_PATTERNS.find((p) => p.test.test(query));
    const intents = new Set<Intent>();
    for (const rule of INTENT_RULES) {
      if (rule.test.test(query)) intents.add(rule.intent);
    }
    if (intents.size === 0) {
      if (/(shelter|hospital|risk|weather|flood|earthquake)/.test(q)) intents.add('guidance');
      else intents.add('guidance');
    }
    if (emergencyHit) intents.add('emergency');

    const steps: ToolStep[] = [];
    const needRisk = emergencyHit || intents.has('risk') || intents.has('weather') || intents.has('shelter') || intents.has('guidance');
    const needHospital = emergencyHit || intents.has('hospital');
    const needShelter = emergencyHit || intents.has('shelter');

    // Tool execution (whitelisted, parallel, individually guarded)
    const t0 = Date.now();
    const [riskRes, wxRes, aqiRes, quakeRes, alertsRes, facRes] = await Promise.all([
      needRisk
        ? riskEngineService.analyzeLocationRisk(locLabel).then(
            (v) => ({ ok: true as const, v }),
            (e) => ({ ok: false as const, e: String(e) })
          )
        : Promise.resolve(null),
      intents.has('weather') || needRisk
        ? weatherService.getWeatherForLocation(locLabel).then(
            (v) => ({ ok: true as const, v }),
            (e) => ({ ok: false as const, e: String(e) })
          )
        : Promise.resolve(null),
      intents.has('aqi')
        ? aqiService.getAqiForLocation(locLabel).then(
            (v) => ({ ok: true as const, v }),
            (e) => ({ ok: false as const, e: String(e) })
          )
        : Promise.resolve(null),
      intents.has('quake')
        ? usgsService.getNearbyQuakes(locLabel).then(
            (v) => ({ ok: true as const, v }),
            (e) => ({ ok: false as const, e: String(e) })
          )
        : Promise.resolve(null),
      intents.has('alerts')
        ? prisma.disasterAlert
            .findMany({ where: { status: 'ACTIVE', state: resolved.state }, orderBy: { issuedAt: 'desc' }, take: 5 })
            .then(
              (v) => ({ ok: true as const, v }),
              () => ({ ok: false as const, e: 'alerts unavailable' })
            )
        : Promise.resolve(null),
      needHospital || needShelter
        ? getFacilities(locLabel).then(
            (v) => ({ ok: true as const, v }),
            (e) => ({ ok: false as const, e: String(e) })
          )
        : Promise.resolve(null),
    ]);
    const toolMs = Date.now() - t0;

    const pushStep = (key: string, label: string, ok: boolean | null, detail?: string) => {
      steps.push({ key, label, status: ok === false ? 'skipped' : 'done', detail });
    };

    if (needRisk) {
      const ok = riskRes?.ok === true;
      logTool('getLocalRisk', locLabel, ok, toolMs);
      pushStep('risk', 'Local risk assessed', ok, ok ? `${(riskRes as any).v.overallRiskLevel} ${(riskRes as any).v.riskScore}/100` : 'engine unavailable');
    }
    if (intents.has('weather') || needRisk) {
      const ok = wxRes?.ok === true;
      logTool('getWeather', locLabel, ok, toolMs);
      pushStep('weather', 'Weather checked', ok, ok && !(wxRes as any).v.isDemoData ? 'live observation' : 'climatology fallback');
    }
    if (intents.has('hospital') || intents.has('shelter') || emergencyHit) {
      const ok = facRes?.ok === true;
      logTool('findNearbyFacilities', locLabel, ok, toolMs);
      pushStep('facilities', 'Nearby help located', ok, ok ? `${(facRes as any).v.liveFacilities.length} live POIs` : 'registry unavailable');
    }
    if (intents.has('alerts')) {
      const ok = alertsRes?.ok === true;
      logTool('getDisasterAlerts', locLabel, ok, toolMs);
      pushStep('alerts', 'Official alerts checked', ok, ok ? `${(alertsRes as any).v.length} active` : 'bulletin unavailable');
    }
    if (intents.has('quake')) {
      const ok = quakeRes?.ok === true;
      logTool('getRecentEarthquakes', locLabel, ok, toolMs);
      pushStep('quakes', 'Seismicity checked', ok, ok ? `${(quakeRes as any).v.count} observed` : 'USGS unavailable');
    }

    const risk = riskRes?.ok ? riskRes.v : null;
    const weather = wxRes?.ok ? wxRes.v : null;

    // Provider chain with full context
    const contextBlock = this.buildContext({ resolved, risk, weather, language });
    const history = rawMessages.slice(-8).map((m) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: String(m.content || '').slice(0, 1500),
    }));

    let provider: OrchestratedReply['provider'] = 'local';
    let llmText: string | null = null;
    let llmModel: string | undefined;

    if (!emergencyHit) {
      const nugen = await nugenService
        .generateDisasterGuidance({
          messages: [{ role: 'system', content: contextBlock }, ...history] as any,
          location: locLabel,
        })
        .catch(() => null);
      if (nugen && nugen.source === 'nugen_api') {
        provider = 'nugen';
        llmText = nugen.response;
        llmModel = nugen.modelUsed;
      }
    }
    if (!llmText && !emergencyHit) {
      const deep = await deepseekService.generate([
        { role: 'system', content: contextBlock },
        ...history,
      ]);
      if (deep) {
        provider = 'deepseek';
        llmText = deep.text;
        llmModel = deep.model;
      }
    }

    let reply: OrchestratedReply;
    if (llmText) {
      reply = this.fromProviderText({
        text: this.validateProviderText(llmText),
        query,
        resolved,
        risk,
        language,
        languageFallback,
        provider,
        llmModel,
        steps,
        emergency: false,
      });
    } else {
      reply = this.buildLocalReply({
        query,
        q,
        intents,
        emergencyHit: emergencyHit?.reason,
        resolved,
        risk,
        weather,
        aqi: aqiRes?.ok ? aqiRes.v : null,
        quakes: quakeRes?.ok ? quakeRes.v : null,
        alerts: alertsRes?.ok ? alertsRes.v : null,
        facilities: facRes?.ok ? facRes.v : null,
        language,
        languageFallback,
        steps,
        injectionFlag,
      });
    }
    return reply;
  }

  // -- context ---------------------------------------------------------------

  private buildContext(args: {
    resolved: ReturnType<typeof geoService.resolveLocation>;
    risk: any;
    weather: any;
    language: SupportedLanguage;
  }): string {
    const lines = [
      'You are JeevanGrid AI Safety Intelligence, an emergency-response assistant for India.',
      `Respond ONLY in ${LANGUAGE_NAMES[args.language]}. Never switch languages mid-reply.`,
      `User area: ${args.resolved.city}, ${args.resolved.district}, ${args.resolved.state}.`,
    ];
    if (args.risk) {
      lines.push(
        `Modelled risk: ${args.risk.overallRiskLevel} (${args.risk.riskScore}/100). ` +
          `Hazards: ${(args.risk.activeHazards || []).map((h: any) => `${h.type} (${h.level})`).join('; ')}. ` +
          `Rainfall expected: ${args.risk.rainfallExpectedMm} mm.`
      );
    }
    if (args.weather && !args.weather.isDemoData) {
      lines.push(
        `Live weather: ${args.weather.temperature}C, ${args.weather.condition}, rain probability ${args.weather.rainProbability}%.`
      );
    }
    lines.push(
      'SAFETY RULES: short first, then structured steps. Never invent government warnings, earthquake predictions, shelter availability, hospital beds, or emergency numbers. Never claim rescue teams were dispatched. Distinguish OFFICIAL WARNING vs MODELLED ESTIMATE vs GENERAL GUIDANCE. For life-threatening situations, tell the user to call 112 immediately.'
    );
    return lines.join('\n');
  }

  // -- provider text -> structured --------------------------------------------

  private validateProviderText(text: string): string {
    let out = text.slice(0, 4000);
    if (/rescue (team|unit)s? (have been|are) (dispatched|on (the )?way)|we have (alerted|contacted|notified)/i.test(out)) {
      out += '\n\nNote: JeevanGrid AI cannot dispatch field teams. For rescue, call 112 or 1078 directly.';
    }
    return out;
  }

  private fromProviderText(args: {
    text: string;
    query: string;
    resolved: ReturnType<typeof geoService.resolveLocation>;
    risk: any;
    language: SupportedLanguage;
    languageFallback: boolean;
    provider: OrchestratedReply['provider'];
    llmModel?: string;
    steps: ToolStep[];
    emergency: boolean;
  }): OrchestratedReply {
    const firstLine = args.text.split('\n')[0].slice(0, 160);
    const sections: ReplySection[] = [
      { key: 'answer', title: aiT(args.language, 'guidance'), level: 'info', body: args.text },
    ];
    if (args.risk) {
      sections.push({
        key: 'risk',
        title: `Local risk: ${args.risk.overallRiskLevel} (${args.risk.riskScore}/100)`,
        level: args.risk.overallRiskLevel === 'HIGH' || args.risk.overallRiskLevel === 'SEVERE' ? 'warning' : 'info',
        body: `${args.risk.location}. ${args.risk.floodRiskStage}. Modelled estimate from the JeevanGrid Risk Engine, not an official warning.`,
      });
    }
    return this.finalize({
      emergency: false,
      headline: firstLine || 'Safety guidance',
      sections,
      actions: this.defaultActions(args.resolved, args.language),
      sources: this.defaultSources(args.risk),
      steps: args.steps,
      provider: args.provider,
      llmModel: args.llmModel,
      language: args.language,
      languageFallback: args.languageFallback,
      recommendedActions: ['Follow official DDMA advisories', 'Call 112 for urgent rescue'],
    });
  }

  // -- local structured engine --------------------------------------------------

  private buildLocalReply(args: {
    query: string;
    q: string;
    intents: Set<Intent>;
    emergencyHit?: string;
    resolved: ReturnType<typeof geoService.resolveLocation>;
    risk: any;
    weather: any;
    aqi: any;
    quakes: any;
    alerts: any[] | null;
    facilities: any;
    language: SupportedLanguage;
    languageFallback: boolean;
    steps: ToolStep[];
    injectionFlag: boolean;
  }): OrchestratedReply {
    const { resolved, risk, language } = args;
    const locLabel = `${resolved.city}, ${resolved.state}`;
    const sections: ReplySection[] = [];
    const actions: ReplyAction[] = [];
    const sources: OrchestratedReply['sources'] = [];
    const recommended: string[] = [];
    const isEmergency = Boolean(args.emergencyHit);

    if (isEmergency) {
      const contacts = [
        { service: 'National Emergency (all services)', number: '112' },
        { service: 'NDRF Search & Rescue', number: '1078' },
        ...(risk?.emergencyContacts?.slice(0, 2) || []),
      ];
      sections.push({
        key: 'emergency',
        title: `${aiT(language, 'emergencyContacts')} — ${args.emergencyHit}`,
        level: 'critical',
        body: aiT(language, 'emergencyBody'),
        contacts,
      });
      const g = guidanceFor(args.q);
      sections.push({ key: 'do', title: `${aiT(language, 'whatToDo')} — ${g.title}`, level: g.level, items: g.steps });
      const liveHosp = (args.facilities?.liveFacilities || []).filter((f: any) => f.kind === 'hospital').slice(0, 3);
      if (liveHosp.length) {
        sections.push({
          key: 'help',
          title: aiT(language, 'nearbyHelpLive'),
          level: 'info',
          facilities: liveHosp.map((h: any) => ({
            name: h.name,
            detail: [h.address, h.distanceKm !== undefined ? `${h.distanceKm} km` : null].filter(Boolean).join(' · ') || 'OpenStreetMap POI',
            phone: h.phone,
            distanceKm: h.distanceKm,
          })),
        });
      }
      sources.push({ label: 'General safety guidance (NDMA-aligned knowledge)', kind: 'guidance' });
      if (args.facilities?.liveSource === 'overpass') sources.push({ label: 'OpenStreetMap live facilities', kind: 'live' });
      actions.push(
        { kind: 'tel', label: aiT(language, 'call112'), number: '112' },
        { kind: 'navigate', label: aiT(language, 'openRiskMap'), to: `/risk/${encodeURIComponent(locLabel)}` },
        { kind: 'navigate', label: aiT(language, 'reportEmergency'), to: '/report-emergency' }
      );
      recommended.push('Call 112 immediately', 'Move to safety if you can do so', 'Do not wait for an app response in danger');
      return this.finalize({
        emergency: true,
        headline: aiT(language, 'emergencyTitle'),
        sections,
        actions,
        sources,
        steps: args.steps,
        provider: 'local',
        language: args.language,
        languageFallback: args.languageFallback,
        recommendedActions: recommended,
      });
    }

    // Headline: short answer first
    let headline = `Safety guidance for ${locLabel}.`;
    if (args.intents.has('risk') && risk) {
      headline = `${resolved.city} risk is ${risk.overallRiskLevel} (${risk.riskScore}/100).`;
      sections.push({
        key: 'risk',
        title: `${aiT(language, 'currentSituation')} — ${risk.location}`,
        level: risk.overallRiskLevel === 'HIGH' || risk.overallRiskLevel === 'SEVERE' ? 'warning' : 'info',
        body: `${risk.floodRiskStage}. Expected rainfall ${risk.rainfallExpectedMm} mm over ${risk.forecastWindow}.`,
        items: (risk.activeHazards || []).map((h: any) => `${h.type} — ${h.level} (${h.status}): ${h.description}`),
      });
      sources.push({ label: 'JeevanGrid Risk Engine (modelled estimate)', kind: 'model' });
      recommended.push('Check the full risk map', 'Review what-to-do steps below');
    }
    if ((args.intents.has('weather') || args.intents.has('risk')) && args.weather) {
      const w = args.weather;
      sections.push({
        key: 'weather',
        title: `${aiT(language, 'weather')} — ${w.location}`,
        level: 'info',
        body: `${w.temperature}°C, ${w.condition}. Humidity ${w.humidity}%, wind ${w.windSpeed} km/h, rain probability ${w.rainProbability}%.${w.severeWarning ? ` Note: ${w.severeWarning}.` : ''}`,
      });
      sources.push({ label: w.isDemoData ? 'Regional climatology (demo)' : 'Open-Meteo live observation', kind: w.isDemoData ? 'model' : 'live' });
    }
    if (args.intents.has('aqi') && args.aqi) {
      const a = args.aqi;
      sections.push({
        key: 'aqi',
        title: `${aiT(language, 'airQuality')} — ${a.location}`,
        level: a.aqi > 150 ? 'warning' : 'info',
        body: `AQI ${a.aqi} (${a.status}). ${a.advisory}`,
      });
      sources.push({ label: a.isDemoData ? 'Representative AQI (demo)' : 'Open-Meteo live air quality', kind: a.isDemoData ? 'model' : 'live' });
    }
    if (args.intents.has('quake')) {
      if (args.quakes?.source === 'usgs' && args.quakes.count > 0) {
        const top = args.quakes.events.slice(0, 3);
        sections.push({
          key: 'quakes',
          title: `${aiT(language, 'quakesObserved')} — ${resolved.city}`,
          level: 'info',
          items: top.map((e: any) => `M${e.magnitude} — ${e.place} (${String(e.time).slice(0, 10)})`),
          body: 'Observed events from the USGS feed. Earthquakes cannot be predicted.',
        });
        sources.push({ label: 'USGS Earthquake Hazards Program (live)', kind: 'live' });
      } else {
        sections.push({
          key: 'quakes',
          title: aiT(language, 'quakeOutlook'),
          level: 'info',
          body: 'No significant recent earthquakes nearby in the live feed. Seismic zoning still applies — these indicate structural vulnerability, never predictions.',
        });
        sources.push({ label: 'USGS live feed (no significant events)', kind: 'live' });
      }
    }
    if (args.intents.has('alerts')) {
      if (args.alerts && args.alerts.length > 0) {
        sections.push({
          key: 'alerts',
          title: `${aiT(language, 'officialWarnings')} — ${resolved.state}`,
          level: 'warning',
          items: args.alerts.map((a: any) => `${a.title} [${a.severity}]: ${String(a.description).slice(0, 140)}`),
        });
        sources.push({ label: 'JeevanGrid bulletin registry (demo data)', kind: 'official' });
      } else {
        sections.push({
          key: 'alerts',
          title: aiT(language, 'officialWarnings'),
          level: 'info',
          body: 'No active bulletins for your state in the local registry. Authoritative live warnings are issued at SACHET (NDMA) and IMD — the assistant never invents warnings.',
        });
        sources.push({ label: 'SACHET / IMD (linked, not scraped)', kind: 'official' });
      }
    }
    if (args.intents.has('hospital') || args.intents.has('shelter')) {
      const live = (args.facilities?.liveFacilities || []).filter((f: any) =>
        args.intents.has('hospital') && args.intents.has('shelter')
          ? true
          : args.intents.has('hospital')
            ? f.kind === 'hospital'
            : f.kind === 'shelter'
      ).slice(0, 4);
      if (live.length) {
        sections.push({
          key: 'help',
          title: aiT(language, 'nearbyHelp'),
          level: 'info',
          facilities: live.map((h: any) => ({
            name: h.name,
            detail: [h.address, h.distanceKm !== undefined ? `${h.distanceKm} km` : null].filter(Boolean).join(' · ') || 'OpenStreetMap POI',
            phone: h.phone,
            distanceKm: h.distanceKm,
          })),
        });
        sources.push({ label: 'OpenStreetMap live facilities', kind: 'live' });
      } else {
        sections.push({
          key: 'help',
          title: 'Nearby help',
          level: 'info',
          body: 'Live facility lookup is temporarily unavailable. Open the risk map for designated facilities, or call 112 for directions to the nearest help.',
        });
      }
      actions.push({ kind: 'navigate', label: 'Open risk map & facilities', to: `/risk/${encodeURIComponent(locLabel)}` });
    }
    if (args.intents.has('district')) {
      sections.push({
        key: 'district',
        title: `${aiT(language, 'districtInfo')} — ${resolved.district}`,
        level: 'info',
        body: `${resolved.city}, ${resolved.district}, ${resolved.state}. Map zoom level ${resolved.zoom} (${resolved.granularity} view). Boundary linework is sourced from OpenStreetMap.`,
      });
    }
    if (args.intents.has('contacts')) {
      sections.push({
        key: 'contacts',
        title: aiT(language, 'emergencyContacts'),
        level: 'info',
        contacts: HELPLINES.slice(0, 6).map((h) => ({ service: h.service, number: h.number })),
      });
    }
    const wantsKit = args.intents.has('kit');
    const wantsGuidance = args.intents.has('guidance');
    const needsDoSection =
      wantsKit || wantsGuidance || args.intents.has('risk') || args.intents.has('hospital') || args.intents.has('shelter');
    if (needsDoSection) {
      const g = wantsKit
        ? {
            title: aiT(language, 'kit72'),
            level: 'info' as const,
            steps: [
              'Water: 3–4 litres per person per day for 3 days.',
              'Food: dry fruits, roasted chana, biscuits, energy bars.',
              'Medicines: 7-day prescriptions, first-aid kit, ORS, antiseptic.',
              'Light and tools: LED torch, whistle, waterproof matches.',
              'Power and comms: charged power bank, battery radio.',
              'Documents: Aadhaar, PAN and emergency cash in a waterproof pouch.',
            ],
          }
        : guidanceFor(args.q);
      sections.push({ key: 'do', title: g.title, level: g.level, items: g.steps });
      sources.push({ label: 'General safety guidance (NDMA-aligned knowledge)', kind: 'guidance' });
    } else if (sections.length === 0 && !args.intents.has('greeting')) {
      const g = guidanceFor(args.q);
      sections.push({ key: 'do', title: g.title, level: g.level, items: g.steps });
      sources.push({ label: 'General safety guidance (NDMA-aligned knowledge)', kind: 'guidance' });
    }

    if (args.intents.has('greeting') && sections.length === 0) {
      headline = aiT(language, 'greeting');
      sections.push({
        key: 'intro',
        title: aiT(language, 'introTitle'),
        level: 'info',
        items: [
          'Check local disaster risk for your city or district',
          'Explain what to do during floods, earthquakes, cyclones or heat',
          'Find nearby hospitals, shelters and emergency contacts',
          'Prepare a family emergency kit and readiness plan',
        ],
      });
    }

    actions.push(
      { kind: 'navigate', label: aiT(language, 'checkRisk'), to: `/risk/${encodeURIComponent(locLabel)}` },
      { kind: 'tel', label: aiT(language, 'emergencyContacts'), number: '112' }
    );
    if (recommended.length === 0) recommended.push('Follow official DDMA advisories', 'Call 112 for urgent rescue');

    if (args.injectionFlag) {
      sections.push({
        key: 'note',
        title: aiT(language, 'noteTitle'),
        level: 'info',
        body: 'Prompt-override attempts are ignored by design. This assistant only provides safety guidance within its emergency-response role.',
      });
    }

    return this.finalize({
      emergency: false,
      headline,
      sections,
      actions,
      sources,
      steps: args.steps,
      provider: 'local',
      language: args.language,
      languageFallback: args.languageFallback,
      recommendedActions: recommended,
    });
  }

  // -- assembly ---------------------------------------------------------------

  private defaultActions(
    resolved: ReturnType<typeof geoService.resolveLocation>,
    language: SupportedLanguage = 'en'
  ): ReplyAction[] {
    return [
      { kind: 'navigate', label: aiT(language, 'checkRisk'), to: `/risk/${encodeURIComponent(`${resolved.city}, ${resolved.state}`)}` },
      { kind: 'tel', label: aiT(language, 'call112'), number: '112' },
    ];
  }

  private defaultSources(risk: any): OrchestratedReply['sources'] {
    const out: OrchestratedReply['sources'] = [
      { label: 'General safety guidance (NDMA-aligned knowledge)', kind: 'guidance' },
    ];
    if (risk) out.unshift({ label: 'JeevanGrid Risk Engine (modelled estimate)', kind: 'model' });
    return out;
  }

  private finalize(args: {
    emergency: boolean;
    headline: string;
    sections: ReplySection[];
    actions: ReplyAction[];
    sources: OrchestratedReply['sources'];
    steps: ToolStep[];
    provider: OrchestratedReply['provider'];
    llmModel?: string;
    language: SupportedLanguage;
    languageFallback: boolean;
    recommendedActions: string[];
  }): OrchestratedReply {
    // Flat markdown for backward-compatible clients
    const md: string[] = [`**${args.headline}**`];
    for (const s of args.sections) {
      md.push(`\n**${s.title}**`);
      if (s.body) md.push(s.body);
      if (s.items) s.items.forEach((it, i) => md.push(`${i + 1}. ${it}`));
      if (s.contacts) s.contacts.forEach((c) => md.push(`- ${c.service}: ${c.number}`));
      if (s.facilities) s.facilities.forEach((f) => md.push(`- ${f.name} — ${f.detail}${f.phone ? ` (${f.phone})` : ''}`));
    }
    if (args.languageFallback) {
      md.push('\n*Note: this reply is in English — the requested language is not supported yet.*');
    }
    return {
      emergency: args.emergency,
      headline: args.headline,
      sections: args.sections,
      actions: args.actions,
      sources: args.sources,
      toolActivity: args.steps,
      provider: args.provider,
      language: args.language,
      languageFallback: args.languageFallback,
      response: md.join('\n'),
      recommendedActions: args.recommendedActions,
      isLifeThreateningWarning: args.emergency,
      source: args.provider === 'local' ? 'local_aligned_engine' : `${args.provider}_api`,
      modelUsed:
        args.llmModel || (args.provider === 'local' ? 'JeevanGrid Orchestrated Safety Engine' : args.provider),
    };
  }
}

export const aiOrchestrator = new AiOrchestrator();
