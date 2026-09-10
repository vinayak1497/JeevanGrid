/**
 * Canonical emergency helplines (single source of truth).
 * Used by the AI orchestrator and tool responses.
 */
export interface Helpline {
  service: string;
  number: string;
  purpose: string;
}

export const HELPLINES: Helpline[] = [
  { service: 'National Emergency Response Support', number: '112', purpose: 'Police, Fire, Medical integrated dispatch' },
  { service: 'NDRF Search & Rescue', number: '1078', purpose: 'Flood, collapse and rescue operations' },
  { service: 'Medical Emergency & Ambulance', number: '108', purpose: 'Paramedics and trauma evacuation' },
  { service: 'Fire Brigade Services', number: '101', purpose: 'Urban fire and chemical incidents' },
  { service: 'State Emergency Operations (SDMA)', number: '1070', purpose: 'State emergency operations center' },
  { service: 'District Control Room (DDMA)', number: '1077', purpose: 'District collectorate operations' },
  { service: 'LPG Leak Emergency', number: '1906', purpose: 'Gas leak response' },
];
