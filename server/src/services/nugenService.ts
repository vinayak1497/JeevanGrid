import dotenv from 'dotenv';
dotenv.config();

export interface NugenChatOptions {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  context?: string;
  location?: string;
}

export interface NugenChatResult {
  response: string;
  source: 'nugen_api' | 'local_aligned_engine';
  modelUsed?: string;
  isLifeThreateningWarning: boolean;
  recommendedActions: string[];
}

export class NugenService {
  private apiKey: string | undefined;
  private endpoint: string;

  constructor() {
    this.apiKey = process.env.NUGEN_API_KEY;
    this.endpoint = process.env.NUGEN_ENDPOINT || 'https://api.nugen.ai/v1/chat/completions';
  }

  public isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public async generateDisasterGuidance(options: NugenChatOptions): Promise<NugenChatResult> {
    if (this.isAvailable()) {
      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: 'nugen-disaster-aligned-v1',
            messages: [
              {
                role: 'system',
                content: `You are JeevanGrid AI, an emergency response intelligence assistant for India.
You provide concise, actionable life-safety guidance based on NDMA, IMD, and CWC standards.
DO NOT claim you have dispatched emergency teams. For life-threatening emergencies, explicitly tell the user to call 112 immediately.
Keep recommendations calm, numbered, and directly actionable.`,
              },
              ...options.messages,
            ],
            temperature: 0.2,
          }),
        });

        if (response.ok) {
          const data: any = await response.json();
          const replyText = data.choices?.[0]?.message?.content || 'Guidance received from Nugen Aligned Model.';
          return {
            response: replyText,
            source: 'nugen_api',
            modelUsed: 'nugen-disaster-aligned-v1',
            isLifeThreateningWarning: this.detectLifeThreatening(replyText),
            recommendedActions: ['Follow NDMA guidelines', 'Monitor local IMD alerts', 'Call 112 for urgent rescue'],
          };
        }
      } catch (err) {
        console.warn('Nugen API call failed, switching to local aligned disaster engine:', err);
      }
    }

    // Fallback to local rule & RAG engine
    return this.fallbackDisasterReasoning(options);
  }

  private detectLifeThreatening(text: string): boolean {
    const lower = text.toLowerCase();
    return (
      lower.includes('trapped') ||
      lower.includes('gas leak') ||
      lower.includes('chest pain') ||
      lower.includes('electrocution') ||
      lower.includes('swept away') ||
      lower.includes('building collapse') ||
      lower.includes('critical')
    );
  }

  public fallbackDisasterReasoning(options: NugenChatOptions): NugenChatResult {
    const lastUserMessage = options.messages[options.messages.length - 1]?.content || '';
    const query = lastUserMessage.toLowerCase();

    let reply = '';
    let actions: string[] = [];
    let isUrgent = false;

    if (query.includes('flood') || query.includes('water') || query.includes('drowning') || query.includes('submerged')) {
      reply = `**Flood & Waterlogging Protocol (NDMA Aligned):**\n\n` +
        `1. **Immediate Safety:** Move vertically to upper floors or the highest available elevation. Do NOT attempt to wade or drive through flowing water.\n` +
        `2. **Utilities:** Turn off your main electrical trip switch and close the LPG cylinder regulator valve immediately.\n` +
        `3. **Drinking Water:** Boil all drinking water or use chlorine tablets. Floodwaters carry high risk of leptospirosis and pathogens.\n` +
        `4. **Communications:** Keep a battery torch, charged phone, and power bank in a waterproof zip bag.\n\n` +
        `*If water is rising rapidly and you are trapped, call National Emergency 112 or NDRF at 1078 immediately.*`;
      actions = ['Move to higher ground', 'Shut main power and gas', 'Boil all drinking water', 'Call 112 / 1078 if stranded'];
      isUrgent = query.includes('trapped') || query.includes('rising');
    } else if (query.includes('earthquake') || query.includes('tremor') || query.includes('shaking')) {
      reply = `**Earthquake Immediate Action Protocol:**\n\n` +
        `1. **DROP, COVER, HOLD ON:** Drop to your hands and knees under a sturdy table or desk. Cover your head and neck with your arms.\n` +
        `2. **Stay Clear:** Keep away from glass windows, exterior doors, ceiling fans, and heavy shelving.\n` +
        `3. **If Indoors:** Do NOT run outside while shaking is active. Do NOT use elevators under any circumstance.\n` +
        `4. **If Outdoors:** Move to an open clearing away from power lines, tall buildings, and brick perimeter walls.\n` +
        `5. **After Shaking Stops:** Check for gas odors. If you smell gas, open windows, leave the building immediately, and do not switch electrical appliances on/off.`;
      actions = ['Drop, Cover, and Hold On', 'Do NOT use elevators', 'Check for gas leaks after tremors', 'Move away from glass'];
      isUrgent = true;
    } else if (query.includes('gas') || query.includes('smell gas') || query.includes('lpg')) {
      reply = `**⚠️ CRITICAL HAZARD: LPG / Gas Leak Protocol:**\n\n` +
        `1. **DO NOT operate any electrical switches, fans, or matches.** Even a tiny spark can trigger an explosion.\n` +
        `2. **Ventilate:** Open all doors and windows immediately to allow the gas to dissipate.\n` +
        `3. **Regulator:** Close the main LPG cylinder knob or pipe gas shutoff valve clockwise.\n` +
        `4. **Evacuate:** Leave the premises immediately and warn adjacent neighbors.\n` +
        `5. **Call for Help:** From outside the building, call Fire Services (101), National Emergency (112), or your LPG emergency leak helpline (1906).`;
      actions = ['Do NOT touch electrical switches', 'Open all doors and windows', 'Turn off cylinder valve', 'Call 1906 / 112 from outside'];
      isUrgent = true;
    } else if (query.includes('trapped') || query.includes('stuck') || query.includes('cannot get out')) {
      reply = `**🚨 URGENT: Stranded / Trapped Protocol:**\n\n` +
        `*Please remain calm. Take these steps to signal rescue personnel:*\n\n` +
        `1. **Call 112 or 1078 immediately** from your phone and report your exact landmark and floor.\n` +
        `2. **Signal Rescuers:** Tap on metal pipes, beams, or walls using a hard object in triplets (three taps, pause, repeat). Blow a whistle if available.\n` +
        `3. **Conserve Air & Energy:** Cover your mouth with a cloth to avoid inhaling dust and debris. Shout only when you hear rescuers nearby.\n` +
        `4. **Visual Cues:** Wave a bright cloth, towel, or flashlight beam out of an accessible opening if safe to do so.`;
      actions = ['Call 112 immediately', 'Tap on pipes in sets of three', 'Cover mouth to avoid dust', 'Wave bright cloth'];
      isUrgent = true;
    } else if (query.includes('shelter') || query.includes('relief camp')) {
      reply = `**Nearest Relief Shelters & Emergency Accommodations:**\n\n` +
        `Identified municipal disaster shelters are maintained by the District Administration:\n` +
        `• **Bandra Municipal School Relief Shelter** (Capacity: 400 | Hill Road, Bandra West) - Food, First Aid, Drinking Water\n` +
        `• **Andheri Sports Complex Multipurpose Shelter** (Capacity: 1200 | Veera Desai Road) - Medical hub, Power Generator\n` +
        `• **Kurla West Municipal Hall** (Capacity: 350 | Near Kurla Station, LBS Marg) - Inundation relief\n\n` +
        `You can view live shelter availability on the **Disaster Risk Dashboard** or call the District Control Room at **022-26548900**.`;
      actions = ['Visit nearby designated shelter', 'Carry personal ID & medicines', 'Call District Control Room'];
    } else if (query.includes('kit') || query.includes('carry') || query.includes('supplies') || query.includes('bag')) {
      reply = `**Essential 72-Hour Emergency Survival Kit Checklist:**\n\n` +
        `1. **Water:** 3 to 4 liters of potable water per person/day (3 days minimum).\n` +
        `2. **Food:** High-energy non-perishable food (dry fruits, roasted chana, biscuits, energy bars).\n` +
        `3. **Medical:** 7-day supply of daily prescription medicines, first-aid kit, ORS sachets, antiseptic.\n` +
        `4. **Tools & Light:** LED torch with extra batteries, whistle, multi-tool knife, matches in a waterproof container.\n` +
        `5. **Power & Comms:** Fully charged power bank with charging cables, battery AM/FM radio.\n` +
        `6. **Documents:** Waterproof pouch containing Aadhaar, PAN, voter ID, bank passbook, and emergency cash.`;
      actions = ['Prepare 72h family bag', 'Keep waterproof document pouch', 'Store ORS and prescription meds'];
    } else {
      reply = `**JeevanGrid Emergency Safety Intelligence:**\n\n` +
        `For the scenario you described:\n` +
        `• Ensure personal and family physical safety before taking any other action.\n` +
        `• Stay tuned to official alerts from District Disaster Management Authorities (DDMA) and IMD.\n` +
        `• For immediate life safety or rescue assistance, dial **112** (All-India Emergency) or **1078** (NDRF).\n\n` +
        `You can ask me specific questions like:\n` +
        `• *"What should I do during an earthquake?"*\n` +
        `• *"There is flooding near my house"*\n` +
        `• *"What should I pack in an emergency kit?"*\n` +
        `• *"Where is the nearest shelter?"*`;
      actions = ['Follow official civil advisories', 'Keep emergency numbers handy (112, 1078)', 'Check localized risk forecast'];
    }

    return {
      response: reply,
      source: 'local_aligned_engine',
      modelUsed: 'NDMA Aligned Rule & Context Engine (Demo)',
      isLifeThreateningWarning: isUrgent,
      recommendedActions: actions,
    };
  }
}

export const nugenService = new NugenService();
