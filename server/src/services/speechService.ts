/**
 * Speech-to-text provider abstraction (server-side).
 *
 * No STT provider key is configured in this deployment, so transcription
 * requests are declined with a machine-readable status instead of failing
 * silently. Wire a provider into transcribe() when keys become available —
 * the API contract stays stable.
 */

export interface TranscribeResult {
  text: string;
  language: string;
  provider: string;
}

export class SpeechService {
  public providerStatus(): { configured: boolean; provider: string | null } {
    const provider =
      process.env.STT_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai-whisper' : null);
    return { configured: Boolean(provider), provider };
  }

  public async transcribe(_audio: {
    audioBase64: string;
    mimeType?: string;
    language?: string;
  }): Promise<TranscribeResult | null> {
    // No provider configured: caller (controller) maps null -> 503 + guidance
    // to use on-device browser transcription instead.
    return null;
  }
}

export const speechService = new SpeechService();
