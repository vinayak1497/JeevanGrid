/**
 * DeepSeek reasoning/generation provider (server-side only).
 * Never import this module (or its key) into frontend code.
 */

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface Health {
  consecutiveFailures: number;
  lastErrorAt: string | null;
  lastOkAt: string | null;
}

const health: Health = { consecutiveFailures: 0, lastErrorAt: null, lastOkAt: null };

function apiKey(): string {
  return (process.env.DEEPSEEK_API_KEY || process.env.Deepseek || '').trim();
}

export class DeepSeekService {
  public isConfigured(): boolean {
    return apiKey().length > 0;
  }

  public getHealth(): Health & { configured: boolean } {
    return { ...health, configured: this.isConfigured() };
  }

  /**
   * Returns generated text, or null when unavailable (no key / network /
   * provider error). Never throws provider internals to callers.
   */
  public async generate(
    messages: DeepSeekMessage[],
    opts?: { maxTokens?: number; timeoutMs?: number }
  ): Promise<{ text: string; model: string } | null> {
    const key = apiKey();
    if (!key) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts?.timeoutMs ?? 25000);
    try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: messages.slice(-12),
          temperature: 0.2,
          max_tokens: opts?.maxTokens ?? 900,
        }),
      });
      if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`);
      const data: any = await res.json();
      const text = String(data.choices?.[0]?.message?.content || '').trim();
      if (!text) throw new Error('DeepSeek empty completion');
      health.consecutiveFailures = 0;
      health.lastOkAt = new Date().toISOString();
      return { text, model: String(data.model || 'deepseek-chat') };
    } catch (e) {
      health.consecutiveFailures += 1;
      health.lastErrorAt = new Date().toISOString();
      console.warn('DeepSeek unavailable:', (e as Error).message);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const deepseekService = new DeepSeekService();
