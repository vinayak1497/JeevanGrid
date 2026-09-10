/**
 * Normalization: upstream CAP/RSS shapes → DisasterAlert row draft.
 * Controllers never parse external feeds; they call services.
 */

export interface CapInfo {
  identifier?: string | null;
  sender?: string | null;
  sent?: string | null;
  status?: string | null; // Actual | Exercise | System | Test | Draft
  msgType?: string | null; // Alert | Update | Cancel | Ack | Error
  source?: string | null;
  scope?: string | null;
  language?: string | null;
  category?: string | null;
  event?: string | null;
  urgency?: string | null;
  severity?: string | null; // Extreme | Severe | Moderate | Minor | Unknown
  certainty?: string | null;
  effective?: string | null;
  onset?: string | null;
  expires?: string | null;
  headline?: string | null;
  description?: string | null;
  instruction?: string | null;
  areaDesc?: string | null;
  polygon?: string | null;
  circle?: string | null;
  polygonUrl?: string | null;
  geocode?: string | null;
  references?: string | null;
  web?: string | null; // CAP <web> or RSS link — original bulletin URL
  guid?: string | null;
  author?: string | null; // RSS author (e.g. "controlroom@ndma.gov.in (IMD Dehradun)")
}

export interface NormalizedAlertDraft {
  source: string;
  sourceType: 'OFFICIAL';
  sourceAlertId: string;
  sourceUrl: string | null;
  sourceReference: string | null;
  authority: string;
  sender: string | null;
  title: string;
  description: string;
  headline: string | null;
  instruction: string | null;
  hazardType: string;
  eventType: string | null;
  severity: string; // INFO | WATCH | WARNING | CRITICAL
  urgency: string | null;
  certainty: string | null;
  msgType: string | null;
  scope: string | null;
  category: string | null;
  language: string;
  status: string; // ACTIVE | UPDATED | CANCELLED
  state: string;
  district: string;
  latitude: number;
  longitude: number;
  affectedAreas: string | null; // JSON
  geometry: string | null; // JSON
  issuedAt: Date;
  effectiveAt: Date | null;
  onsetAt: Date | null;
  expiresAt: Date | null;
  rawPayload: string;
  isVerified: boolean;
  isLive: boolean;
  isDemoData: boolean;
  lastCheckedAt: Date;
}

export function mapCapSeverityToJeevanGrid(severity: string | null | undefined): string {
  const s = (severity || '').toLowerCase();
  if (s === 'extreme') return 'CRITICAL';
  if (s === 'severe') return 'WARNING';
  if (s === 'moderate') return 'WATCH';
  if (s === 'minor') return 'INFO';
  return 'INFO';
}

export function mapEventToHazardType(event: string | null | undefined): string {
  const e = (event || '').toLowerCase();
  if (/flood|inundat|flash flood|river/.test(e)) return 'Flood';
  if (/cyclone|hurricane|typhoon|depression|storm surge/.test(e)) return 'Cyclone';
  if (/heat|hot|heatwave/.test(e)) return 'Heatwave';
  if (/landslide|rockfall|mudslide|debris/.test(e)) return 'Landslide';
  if (/lightning|thunder/.test(e)) return 'Lightning';
  if (/earthquake|seismic|tsunami/.test(e)) return 'Earthquake';
  if (/rain|monsoon|precip|shower|cloudburst/.test(e)) return 'Rain';
  if (/fire|wildfire|forest fire/.test(e)) return 'Fire';
  if (/tsunami|coast|surge|marine|ocean/.test(e)) return 'Cyclone';
  return 'Rain';
}

function toDateOrNull(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Best-effort centroid from CAP polygon ("lat,lon lat,lon ...") or circle ("lat,lon radius"). */
export function centroidFromGeometry(
  polygon: string | null | undefined,
  circle: string | null | undefined
): { lat: number; lng: number } | null {
  try {
    if (polygon) {
      const pts = polygon
        .trim()
        .split(/\s+/)
        .map((pair) => pair.split(',').map(Number))
        .filter((p) => p.length === 2 && p.every(Number.isFinite)) as Array<[number, number]>;
      if (pts.length > 0) {
        const lat = pts.reduce((a, p) => a + p[0], 0) / pts.length;
        const lng = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      }
    }
    if (circle) {
      const [center] = circle.trim().split(/\s+/);
      if (center) {
        const [lat, lng] = center.split(',').map(Number);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat: lat as number, lng: lng as number };
      }
    }
  } catch {
    // fall through to null
  }
  return null;
}

/** Split a CAP areaDesc like "Assam - Kamrup Metropolitan" into state/district hints. */
export function splitAreaDesc(areaDesc: string | null | undefined): { state: string; district: string } {
  if (!areaDesc) return { state: 'India', district: 'Unknown' };
  const parts = areaDesc.split(/[-–—,;|]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { state: parts[0] as string, district: parts[1] as string };
  return { state: parts[0] as string, district: parts[0] as string };
}

const KNOWN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar', 'Chandigarh', 'Dadra and Nagar Haveli', 'Daman and Diu', 'Jammu and Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry',
];

/**
 * Last-resort state hint: scan district/area free text for an explicit known
 * Indian state/UT name (word-boundary match). Deterministic list matching —
 * never guessed. Returns null when no state name appears.
 */
export function stateFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = ` ${text.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ')} `;
  // Longest names first so "Uttar Pradesh" wins over substring collisions.
  const ordered = [...KNOWN_STATES].sort((a, b) => b.length - a.length);
  for (const s of ordered) {
    if (t.includes(` ${s.toLowerCase()} `)) return s;
  }
  return null;
}

/**
 * Derive a state hint from the CAP sender (e.g. "Uttarakhand-SDMA" → "Uttarakhand").
 * Only matches an explicit known state name — never guessed from free text.
 */
export function stateFromSender(sender: string | null | undefined): string | null {
  if (!sender) return null;
  const m = sender.match(/^\s*([\w\s&()-]+?)\s*-\s*SDMA\s*$/i);
  if (m) {
    const candidate = ((m[1] ?? '') as string).trim().replace(/-/g, ' ').replace(/\s+/g, ' ').toLowerCase();
    const hit = KNOWN_STATES.find((s) => s.toLowerCase() === candidate);
    if (hit) return hit;
  }
  // IMD regional centre offices: the office city deterministically maps to its state.
  const imd = sender.match(/^\s*IMD\s*-\s*([\w\s]+?)\s*$/i);
  if (imd) {
    const city = ((imd[1] ?? '') as string).trim().toLowerCase();
    const officeState: Record<string, string> = {
      agartala: 'Tripura', ahmedabad: 'Gujarat', aizawl: 'Mizoram', bengaluru: 'Karnataka',
      bhopal: 'Madhya Pradesh', bhubaneswar: 'Odisha', chandigarh: 'Chandigarh',
      chennai: 'Tamil Nadu', dehradun: 'Uttarakhand', delhi: 'Delhi', gangtok: 'Sikkim',
      guwahati: 'Assam', hyderabad: 'Telangana', imphal: 'Manipur', itanagar: 'Arunachal Pradesh',
      jaipur: 'Rajasthan', jammu: 'Jammu and Kashmir', kohima: 'Nagaland', kolkata: 'West Bengal',
      leh: 'Ladakh', lucknow: 'Uttar Pradesh', mumbai: 'Maharashtra', nagpur: 'Maharashtra',
      patna: 'Bihar', raipur: 'Chhattisgarh', ranchi: 'Jharkhand', shillong: 'Meghalaya',
      shimla: 'Himachal Pradesh', srinagar: 'Jammu and Kashmir', thiruvananthapuram: 'Kerala',
      vijayawada: 'Andhra Pradesh',
    };
    if (officeState[city]) return officeState[city];
  }
  return null;
}

export function normalizeCapInfo(
  cap: CapInfo,
  opts: { source: string; authority: string; fallbackCenter?: { lat: number; lng: number } }
): NormalizedAlertDraft | null {
  if (!cap.identifier || String(cap.identifier).trim() === '') return null; // no provenance → reject
  const sent = toDateOrNull(cap.sent);
  if (!sent) return null; // no issue time → reject

  const msgType = (cap.msgType || 'Alert').trim();
  const status =
    msgType.toLowerCase() === 'cancel' ? 'CANCELLED' : msgType.toLowerCase() === 'update' ? 'UPDATED' : 'ACTIVE';

  const centroid = centroidFromGeometry(cap.polygon, cap.circle);
  const center = centroid ?? opts.fallbackCenter ?? { lat: 21.0, lng: 78.0 };
  // areaDesc from SACHET CAP is usually a district list ("Bageshwar, Pithoragarh, …").
  // State resolution order (deterministic, never fabricated):
  // 1. "State - District" split, 2. sender SDMA/IMD hint, 3. known state name
  // inside the area text, 4. honest "India" fallback.
  const senderState = stateFromSender(cap.sender);
  const areaParts = (cap.areaDesc || '').split(/[-–—;|]/).map((p) => p.trim()).filter(Boolean);
  const district =
    areaParts.length >= 2 && areaParts[1]
      ? (areaParts[1] as string)
      : (cap.areaDesc?.trim().slice(0, 200) || 'Unknown');
  const state =
    areaParts.length >= 2 && areaParts[0]
      ? (areaParts[0] as string)
      : (senderState ?? stateFromText(`${cap.areaDesc || ''} ${district}`) ?? 'India');
  const hazardType = mapEventToHazardType(cap.event);
  const title =
    cap.headline?.trim() ||
    (cap.event ? `${cap.event} — ${cap.areaDesc || 'India'}` : `Official warning — ${cap.areaDesc || 'India'}`);
  const description = cap.description?.trim() || cap.headline?.trim() || title;

  const affected = [cap.areaDesc, cap.geocode].filter(Boolean);
  const geometry =
    cap.polygon || cap.circle || cap.polygonUrl
      ? JSON.stringify({ polygon: cap.polygon ?? null, circle: cap.circle ?? null, polygonUrl: cap.polygonUrl ?? null })
      : null;

  const now = new Date();
  // Prefer the named sender (e.g. "Uttarakhand-SDMA") as issuing authority;
  // single-authority attribution is preserved — never merged across sources.
  const senderName = cap.sender?.trim() || null;
  const authorMatch = cap.author?.match(/\(([^)]+)\)\s*$/);
  const authority = senderName || (authorMatch?.[1]?.trim() ?? null) || opts.authority;
  return {
    source: opts.source,
    sourceType: 'OFFICIAL',
    sourceAlertId: String(cap.identifier).trim(),
    sourceUrl: cap.web?.trim() || cap.guid?.trim() || null,
    sourceReference: cap.guid?.trim() || cap.references?.trim() || null,
    authority,
    sender: senderName,
    title,
    description,
    headline: cap.headline?.trim() || null,
    instruction: cap.instruction?.trim() || null,
    hazardType,
    eventType: cap.event?.trim() || null,
    severity: mapCapSeverityToJeevanGrid(cap.severity),
    urgency: cap.urgency?.trim() || null,
    certainty: cap.certainty?.trim() || null,
    msgType,
    scope: cap.scope?.trim() || null,
    category: cap.category?.trim() || null,
    language: cap.language?.trim() || 'en',
    status,
    state,
    district,
    latitude: center.lat,
    longitude: center.lng,
    affectedAreas: affected.length ? JSON.stringify(affected) : null,
    geometry,
    issuedAt: sent,
    effectiveAt: toDateOrNull(cap.effective),
    onsetAt: toDateOrNull(cap.onset),
    expiresAt: toDateOrNull(cap.expires),
    rawPayload: JSON.stringify({ cap }),
    isVerified: true,
    isLive: status !== 'CANCELLED',
    isDemoData: false,
    lastCheckedAt: now,
  };
}
