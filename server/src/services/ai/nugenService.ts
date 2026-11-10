/**
 * nugenService — backend-only Nugen disaster-guidance inference.
 *
 * The NUGEN_API_KEY never leaves the server. Nugen receives ONLY a structured
 * conversation context and returns domain-grounded safety guidance. It CANNOT
 * override deterministic risk calculations: the caller keeps CALCULATED risk
 * and NUGEN guidance strictly separate. Any failure (network, auth, timeout,
 * malformed JSON) yields available:false and the deterministic dashboard
 * continues working.
 *
 * API: POST https://api.nugen.in/api/v3/inference/chat/completions
 * Auth: Bearer NUGEN_API_KEY
 * Model: Qwen/Qwen2.5-0.5B-Instruct (or any aligned model via the API)
 */

export interface NugenChatOptions {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  location?: string;
}

export interface NugenChatResult {
  source: 'nugen_api' | 'local_aligned_engine';
  response: string;
  modelUsed: string | null;
}

/**
 * Call the Nugen inference API with a chat-completion request.
 * Returns the model's textual response, or null on any failure.
 */
async function callNugenChat(
  endpoint: string,
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  location?: string,
  timeoutMs = 20000
): Promise<{ text: string | null; model: string | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const body = {
      model: 'Qwen/Qwen2.5-0.5B-Instruct',
      messages: [
        {
          role: 'system',
          content:
            'You are JeevanGrid AI Safety Intelligence, an emergency-response assistant for India. ' +
            'Respond ONLY in English. Never invent government warnings, earthquake predictions, ' +
            'shelter availability, hospital beds, or emergency numbers. Never claim rescue teams ' +
            'were dispatched. Distinguish OFFICIAL WARNING vs MODELLED ESTIMATE vs GENERAL GUIDANCE. ' +
            'For life-threatening situations, tell the user to call 112 immediately.',
        },
        ...messages.map((m) => ({
          role: m.role,
          content: String(m.content || '').slice(0, 2000),
        })),
      ],
      temperature: 0.2,
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => 'non-ok response');
      console.warn(
        `[nugen] API responded ${res.status}: ${txt.slice(0, 200)}`
      );
      return { text: null, model: null };
    }

    const data = (await res.json()) as any;
    const choice = data?.choices?.[0]?.message?.content;
    if (typeof choice !== 'string') {
      return { text: null, model: null };
    }

    return { text: choice, model: body.model };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg !== 'AbortError') {
      console.warn(`[nugen] call failed:`, msg.slice(0, 200));
    }
    return { text: null, model: null };
  } finally {
    clearTimeout(timer);
  }
}

/** Build a local deterministic fallback reply using the orchestrated engine logic. */
function buildLocalFallback(options: NugenChatOptions): string {
  // Construct a minimal safe reply using the prompt patterns from the orchestrator.
  const q =
    options.messages.length > 0
      ? String(options.messages[options.messages.length - 1]?.content || '').toLowerCase()
      : '';

  if (/flood|water|drown|barish|paani/.test(q)) {
    return (
      'Flood and waterlogging protocol:\n' +
      '- Move to upper floors or the highest available ground. Do not wade or drive through flowing water.\n' +
      '- Turn off the main electrical switch and close the LPG regulator valve.\n' +
      '- Boil all drinking water or use chlorine tablets.\n' +
      '- Keep phone, torch and power bank in a waterproof bag.'
    );
  }
  if (/earthquake|tremor|shaking|quake/.test(q)) {
    return (
      'Earthquake immediate actions:\n' +
      '- DROP, COVER, HOLD ON under a sturdy table. Protect head and neck.\n' +
      '- Stay away from glass, windows, exterior walls and heavy shelves.\n' +
      '- Do not use elevators. Do not run outside while shaking continues.\n' +
      '- After shaking: check for gas smell; if present, leave and do not touch switches.'
    );
  }
  if (/fire|burning|smoke|gas leak|lpg/.test(q)) {
    return (
      'Gas leak protocol:\n' +
      '- Do NOT touch any electrical switch, fan or matchstick.\n' +
      '- Open all doors and windows to ventilate.\n' +
      '- Close the cylinder valve clockwise if safe to reach.\n' +
      '- Leave the building and call 101 / 112 / 1906 from outside.'
    );
  }
  if (/heat|loo|temperature.*hot|garmi/.test(q)) {
    return (
      'Extreme heat protocol:\n' +
      '- Avoid sun between 12 PM and 4 PM. Rest in shade or cooled rooms.\n' +
      '- Drink water and ORS frequently, even without thirst.\n' +
      '- Wear light cotton clothing; cover head outdoors.\n' +
      '- Watch for dizziness, nausea, rapid pulse — move to cool place and seek care.'
    );
  }

  // Default general guidance
  return (
    'Safety guidance for your area:\n' +
    '- Check local disaster risk for your city or district.\n' +
    '- Explain what to do during floods, earthquakes, cyclones or heat.\n' +
    '- Find nearby hospitals, shelters and emergency contacts.\n' +
    '- Prepare a family emergency kit and readiness plan.\n' +
    '- For immediate danger, call 112.'
  );
}

/**
 * Generate disaster guidance using the Nugen API, with fallback to the local
 * aligned disaster engine. Never throws; always returns a valid NugenChatResult.
 */
export const nugenService = {
  /**
   * Returns guidance from Nugen API, or falls back to local engine.
   * The returned object is compatible with AiOrchestrator's expected format.
   */
  async generateDisasterGuidance(
    options: NugenChatOptions
  ): Promise<NugenChatResult> {
    const apiKey = process.env.NUGEN_API_KEY?.trim();
    const endpoint = process.env.NUGEN_ENDPOINT ?? 'https://api.nugen.in/api/v3/inference/chat/completions';

    if (!apiKey) {
      // Fall back to local engine when key is not configured
      return {
        source: 'local_aligned_engine',
        response: buildLocalFallback(options),
        modelUsed: null,
      };
    }

    try {
      const result = await callNugenChat(endpoint, apiKey, options.messages, options.location, 20000);

      if (result.text && result.text.trim().length > 0) {
        return {
          source: 'nugen_api' as const,
          response: result.text.trim(),
          modelUsed: result.model,
        };
      }

      // Nugen returned empty/invalid – fall back
      return {
        source: 'local_aligned_engine',
        response: buildLocalFallback(options),
        modelUsed: null,
      };
    } catch (e) {
      // Network/error – fall back gracefully
      console.warn(
        '[nugen] generateDisasterGuidance fallback due to error:',
        (e as Error).message?.slice(0, 160)
      );
      return {
        source: 'local_aligned_engine',
        response: buildLocalFallback(options),
        modelUsed: null,
      };
    }
  },
};