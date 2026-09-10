/**
 * nugenHealthService — backend-only Nugen Healthcare interpretation.
 *
 * The NUGEN_API_KEY never leaves the server. Nugen receives ONLY a structured
 * evidence object and returns a domain-grounded interpretation. It CANNOT
 * override deterministic risk calculations: the caller keeps CALCULATED
 * ENVIRONMENTAL RISK and NUGEN HEALTH INTERPRETATION strictly separate.
 * Any failure (network, auth, malformed JSON) yields available:false and the
 * deterministic dashboard continues working.
 */

export interface NugenEvidence {
  location: string;
  timestamp: string;
  climate: Record<string, unknown>;
  rainfall: Record<string, unknown>;
  temperature: Record<string, unknown>;
  humidity: Record<string, unknown>;
  aqi: Record<string, unknown>;
  floodRisk: Record<string, unknown>;
  vulnerability: Record<string, unknown>;
  healthIndicators: Record<string, unknown>;
}

export interface NugenHealthInterpretation {
  whyItMatters: string[];
  vulnerableGroups: string[];
  preparednessActions: string[];
  dataGaps: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  uncertaintyNotes: string;
}

export interface NugenHealthResult {
  available: boolean;
  modelUsed: string | null;
  interpretation: NugenHealthInterpretation | null;
  interpretedAt: string | null;
  reason: string;
}

const CANDIDATE_MODELS: string[] = [
  (process.env.NUGEN_HEALTH_MODEL || '').trim(),
  'nugen-healthcare-india',
  'nugen-disaster-aligned-v1',
].filter(Boolean) as string[];

let workingModel: string | null = null;

const SYSTEM_PROMPT = `You are a public-health reasoning assistant supporting India's disaster health preparedness. You receive a STRUCTURED EVIDENCE OBJECT of environmental observations and pre-calculated environmental risk indicators.

STRICT RULES:
1. Interpret ONLY the evidence provided. Never invent measurements, case counts, epidemiological statistics, or outbreak claims.
2. Never diagnose any individual. Speak about population-level preparedness only.
3. Never claim a disease outbreak exists without authoritative surveillance evidence (none is provided here — say so if relevant).
4. Never contradict the provided calculated risk levels; you may explain and contextualize them.
5. This is NOT an official government warning and NOT medical advice.
6. RESPOND WITH STRICT JSON ONLY — no markdown, no prose outside JSON — matching EXACTLY this schema:
{
  "whyItMatters": ["..."],
  "vulnerableGroups": ["..."],
  "preparednessActions": ["..."],
  "dataGaps": ["..."],
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "uncertaintyNotes": "..."
}
Keep each array to at most 5 short items. Base confidence on how complete the evidence is.`;

function extractJson(text: string): unknown | null {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const tryParse = (s: string): unknown | null => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  const direct = tryParse(cleaned);
  if (direct !== null && typeof direct === 'object') return direct;
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const sliced = tryParse(cleaned.slice(start, end + 1));
    if (sliced !== null && typeof sliced === 'object') return sliced;
  }
  return null;
}

function sanitizeStringArray(v: unknown, maxItems = 5, maxLen = 280): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === 'string' && x.trim().length > 0)
    .map((x) => String(x).trim().slice(0, maxLen))
    .slice(0, maxItems);
}

function validateInterpretation(raw: unknown): NugenHealthInterpretation | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const confidence = r.confidence === 'HIGH' || r.confidence === 'MEDIUM' || r.confidence === 'LOW' ? r.confidence : null;
  if (!confidence) return null;
  const out: NugenHealthInterpretation = {
    whyItMatters: sanitizeStringArray(r.whyItMatters),
    vulnerableGroups: sanitizeStringArray(r.vulnerableGroups),
    preparednessActions: sanitizeStringArray(r.preparednessActions),
    dataGaps: sanitizeStringArray(r.dataGaps),
    confidence,
    uncertaintyNotes: typeof r.uncertaintyNotes === 'string' ? r.uncertaintyNotes.slice(0, 500) : '',
  };
  if (!out.whyItMatters.length || !out.preparednessActions.length) return null;
  return out;
}

async function callModel(
  endpoint: string,
  apiKey: string,
  model: string,
  evidence: NugenEvidence,
  scenarioLabel: string | null,
  timeoutMs = 25000
): Promise<NugenHealthInterpretation | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const userContent =
      (scenarioLabel ? `SCENARIO SIMULATION (${scenarioLabel}) — NOT a forecast. ` : '') +
      `Evidence object (JSON):\n${JSON.stringify(evidence).slice(0, 12000)}` +
      (scenarioLabel
        ? `\nExplain how preparedness priorities CHANGE under this scenario versus the live assessment. Label everything as scenario-based.`
        : '');
    const res = await fetch(endpoint, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) return null;
    return validateInterpretation(extractJson(text));
  } catch (e) {
    console.warn(`[nugen-health] model ${model} call failed:`, (e as Error).message.slice(0, 160));
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export class NugenHealthService {
  private apiKey: string | undefined;
  private endpoint: string;

  constructor(overrides?: { apiKey?: string; endpoint?: string }) {
    this.apiKey = overrides?.apiKey ?? process.env.NUGEN_API_KEY;
    this.endpoint =
      overrides?.endpoint ?? process.env.NUGEN_ENDPOINT ?? 'https://api.nugen.ai/v1/chat/completions';
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Interpret evidence with the healthcare-domain Nugen model.
   * Tries NUGEN_HEALTH_MODEL → nugen-healthcare-india → the configured
   * available model, and remembers whichever responds. NEVER throws.
   */
  public async interpret(
    evidence: NugenEvidence,
    scenarioLabel: string | null = null
  ): Promise<NugenHealthResult> {
    if (!this.isConfigured()) {
      return {
        available: false,
        modelUsed: null,
        interpretation: null,
        interpretedAt: null,
        reason: 'Nugen API key not configured (NUGEN_API_KEY). Deterministic assessment unaffected.',
      };
    }
    const apiKey = this.apiKey as string;
    const ordered = workingModel
      ? [workingModel, ...CANDIDATE_MODELS.filter((m) => m !== workingModel)]
      : [...CANDIDATE_MODELS];
    for (const model of ordered) {
      const parsed = await callModel(this.endpoint, apiKey, model, evidence, scenarioLabel);
      if (parsed) {
        workingModel = model;
        return {
          available: true,
          modelUsed: model,
          interpretation: parsed,
          interpretedAt: new Date().toISOString(),
          reason: 'ok',
        };
      }
    }
    return {
      available: false,
      modelUsed: null,
      interpretation: null,
      interpretedAt: null,
      reason: 'Nugen healthcare models unreachable or returned unusable output. Deterministic assessment unaffected.',
    };
  }

  /** Test hook: forget the cached working model. */
  public static resetWorkingModel(): void {
    workingModel = null;
  }
}

export const nugenHealthService = new NugenHealthService();
