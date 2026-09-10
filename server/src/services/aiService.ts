import { nugenService, NugenChatOptions, NugenChatResult } from './nugenService';

export class AiService {
  public async handleCitizenQuery(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>, location?: string): Promise<NugenChatResult> {
    const options: NugenChatOptions = {
      messages,
      location,
      context: 'JeevanGrid Citizen Emergency Resilience Interface',
    };

    return await nugenService.generateDisasterGuidance(options);
  }
}

export const aiService = new AiService();
