/**
 * Feature 4 — climate trigger-to-action templates.
 *
 * All triggers are deterministic and documented here. They are suggestions,
 * not government orders. An authorised District Officer must review and
 * activate a playbook; Nugen may only explain or summarise tasks.
 *
 * Trigger policy (single source of truth):
 *  - Official alert severity WARNING or CRITICAL for a mapped hazard.
 *  - JeevanGrid deterministic riskScore >= 60 for the district (High+).
 *  - Manual activation by an officer, and clearly-labelled SIMULATION demos.
 */

export type PlaybookRole =
  | 'DISTRICT_OFFICER'
  | 'HEALTH_OFFICER'
  | 'FIELD_RESPONDER'
  | 'COMMUNITY_VOLUNTEER'
  | 'STATE_EOC';

export interface PlaybookTaskTemplate {
  role: PlaybookRole;
  title: string;
  description: string;
  dueHours: number;
}

export interface PlaybookTemplate {
  id: string;
  hazardType: string;
  name: string;
  summary: string;
  trigger: {
    officialAlertHazards: string[];
    minimumSeverity: 'WATCH' | 'WARNING' | 'CRITICAL';
    riskScoreAtLeast: number;
  };
  tasks: PlaybookTaskTemplate[];
}

export const PLAYBOOK_TRIGGER_POLICY = {
  riskScoreAtLeast: 60,
  minimumSeverity: 'WARNING' as const,
  note: 'Risk score is the existing deterministic JeevanGrid 0-100 score. 60 is the documented High-risk threshold; it is not a forecast of certainty.',
};

export const PLAYBOOK_TEMPLATES: PlaybookTemplate[] = [
  {
    id: 'flood',
    hazardType: 'Flood',
    name: 'Flood preparedness',
    summary: 'Pre-position resources, verify vulnerable localities and prepare evacuation routes before inundation.',
    trigger: { officialAlertHazards: ['Flood', 'Rain', 'Cyclone'], minimumSeverity: 'WARNING', riskScoreAtLeast: 60 },
    tasks: [
      { role: 'DISTRICT_OFFICER', title: 'Review high-exposure localities', description: 'Open the impact assessment for the warning polygon and identify the most exposed wards and facilities.', dueHours: 2 },
      { role: 'DISTRICT_OFFICER', title: 'Review evacuation requirements', description: 'Confirm shelter options and whether evacuation is needed. Do not claim a route is safe without verified road conditions.', dueHours: 4 },
      { role: 'DISTRICT_OFFICER', title: 'Check responder availability', description: 'Confirm on-duty field responders and assign standby teams to high-risk areas.', dueHours: 4 },
      { role: 'HEALTH_OFFICER', title: 'Review hospital readiness', description: 'Check bed, oxygen and emergency department readiness for the affected district.', dueHours: 4 },
      { role: 'HEALTH_OFFICER', title: 'Review waterborne and vector risk', description: 'Prepare guidance for contaminated water, dengue and leptospirosis risk after flooding.', dueHours: 8 },
      { role: 'FIELD_RESPONDER', title: 'Verify assigned vulnerable locations', description: 'Check the assigned list of elderly, disabled and isolated households. Report access problems.', dueHours: 3 },
      { role: 'FIELD_RESPONDER', title: 'Report blocked roads', description: 'Submit ground reports for blocked or flooded roads. Unverified reports do not automatically close a route.', dueHours: 4 },
      { role: 'COMMUNITY_VOLUNTEER', title: 'Notify assigned communities', description: 'Share the official warning and local shelter information with assigned households.', dueHours: 2 },
      { role: 'COMMUNITY_VOLUNTEER', title: 'Check on vulnerable households', description: 'Contact or visit assigned vulnerable households and report unmet assistance needs.', dueHours: 4 },
      { role: 'COMMUNITY_VOLUNTEER', title: 'Report ground conditions', description: 'Submit water level, road and access observations with a timestamp.', dueHours: 4 },
      { role: 'STATE_EOC', title: 'Review district readiness', description: 'Review activation progress and district resource gaps in the State EOC dashboard.', dueHours: 6 },
      { role: 'STATE_EOC', title: 'Identify resource shortages', description: 'Flag shortages that require inter-district support; do not issue orders from the platform.', dueHours: 8 },
    ],
  },
  {
    id: 'extreme_rainfall',
    hazardType: 'Extreme Rainfall',
    name: 'Extreme rainfall preparedness',
    summary: 'Prepare for intense rainfall, localised waterlogging and possible flash flooding.',
    trigger: { officialAlertHazards: ['Rain', 'Flood', 'Cyclone'], minimumSeverity: 'WARNING', riskScoreAtLeast: 60 },
    tasks: [
      { role: 'DISTRICT_OFFICER', title: 'Review rainfall warning and exposure', description: 'Review the rainfall warning, timeframe and estimated exposed population.', dueHours: 2 },
      { role: 'DISTRICT_OFFICER', title: 'Pre-position pumps and teams', description: 'Confirm dewatering pumps and responder teams are available for known waterlogging points.', dueHours: 4 },
      { role: 'HEALTH_OFFICER', title: 'Check emergency department surge plan', description: 'Confirm hospitals can handle waterborne illness and injury surges.', dueHours: 6 },
      { role: 'FIELD_RESPONDER', title: 'Inspect known waterlogging points', description: 'Report current conditions at assigned low-lying locations.', dueHours: 3 },
      { role: 'COMMUNITY_VOLUNTEER', title: 'Warn low-lying households', description: 'Share the official warning and basic safety guidance with assigned households.', dueHours: 2 },
      { role: 'STATE_EOC', title: 'Monitor district readiness', description: 'Track activation progress and escalate resource gaps.', dueHours: 6 },
    ],
  },
  {
    id: 'heatwave',
    hazardType: 'Heatwave',
    name: 'Heatwave response',
    summary: 'Protect vulnerable people, outdoor workers and health facilities during extreme heat.',
    trigger: { officialAlertHazards: ['Heatwave'], minimumSeverity: 'WARNING', riskScoreAtLeast: 60 },
    tasks: [
      { role: 'DISTRICT_OFFICER', title: 'Review heat exposure and cooling sites', description: 'Identify high-exposure localities and confirm available cooling centres.', dueHours: 3 },
      { role: 'HEALTH_OFFICER', title: 'Review heat illness readiness', description: 'Confirm ORS, cooling supplies and heat-stroke protocols at health facilities.', dueHours: 4 },
      { role: 'FIELD_RESPONDER', title: 'Check assigned vulnerable households', description: 'Visit or contact elderly and isolated residents at highest risk.', dueHours: 4 },
      { role: 'COMMUNITY_VOLUNTEER', title: 'Share heat safety guidance', description: 'Distribute official heat safety guidance and drinking-water locations.', dueHours: 2 },
      { role: 'STATE_EOC', title: 'Monitor heat action progress', description: 'Track task completion and flag districts needing support.', dueHours: 6 },
    ],
  },
  {
    id: 'earthquake',
    hazardType: 'Earthquake',
    name: 'Earthquake response readiness',
    summary: 'Prepare search-and-rescue, hospital surge and structural safety checks after a significant earthquake.',
    trigger: { officialAlertHazards: ['Earthquake'], minimumSeverity: 'WARNING', riskScoreAtLeast: 60 },
    tasks: [
      { role: 'DISTRICT_OFFICER', title: 'Confirm incident command activation', description: 'Verify the district incident command structure and communication channels.', dueHours: 1 },
      { role: 'DISTRICT_OFFICER', title: 'Review structural damage reports', description: 'Collect verified reports from field teams; do not declare buildings safe remotely.', dueHours: 3 },
      { role: 'HEALTH_OFFICER', title: 'Confirm trauma capacity', description: 'Check trauma beds, blood availability and ambulance readiness.', dueHours: 2 },
      { role: 'FIELD_RESPONDER', title: 'Check assigned facilities', description: 'Inspect assigned hospitals, shelters and access roads for damage.', dueHours: 2 },
      { role: 'COMMUNITY_VOLUNTEER', title: 'Report trapped or injured people', description: 'Submit verified location details for people needing rescue; do not enter unsafe structures.', dueHours: 1 },
      { role: 'STATE_EOC', title: 'Coordinate resource requests', description: 'Track district requests for rescue teams and medical supplies.', dueHours: 3 },
    ],
  },
  {
    id: 'landslide',
    hazardType: 'Landslide',
    name: 'Landslide preparedness',
    summary: 'Monitor unstable slopes, close only verified dangerous roads and prepare evacuation options.',
    trigger: { officialAlertHazards: ['Landslide'], minimumSeverity: 'WARNING', riskScoreAtLeast: 60 },
    tasks: [
      { role: 'DISTRICT_OFFICER', title: 'Review vulnerable slopes and settlements', description: 'Identify settlements below known unstable slopes and review evacuation options.', dueHours: 2 },
      { role: 'DISTRICT_OFFICER', title: 'Confirm road closure information', description: 'Only use authority-verified road closures for routing decisions.', dueHours: 3 },
      { role: 'FIELD_RESPONDER', title: 'Inspect assigned slope locations', description: 'Report cracks, movement or blocked drains with GPS and photos.', dueHours: 3 },
      { role: 'COMMUNITY_VOLUNTEER', title: 'Alert assigned hillside households', description: 'Share official guidance and evacuation points with assigned households.', dueHours: 2 },
      { role: 'STATE_EOC', title: 'Review district readiness', description: 'Track activation progress and inter-district support needs.', dueHours: 6 },
    ],
  },
  {
    id: 'air_pollution',
    hazardType: 'Severe Air Pollution',
    name: 'Severe air pollution response',
    summary: 'Protect respiratory-vulnerable groups and prepare health advisories during severe air pollution.',
    trigger: { officialAlertHazards: ['Air Pollution'], minimumSeverity: 'WARNING', riskScoreAtLeast: 60 },
    tasks: [
      { role: 'DISTRICT_OFFICER', title: 'Review AQI hotspots and advisories', description: 'Review monitored AQI hotspots and official health advisories.', dueHours: 3 },
      { role: 'HEALTH_OFFICER', title: 'Review respiratory surge readiness', description: 'Check inhaler, oxygen and paediatric respiratory capacity.', dueHours: 4 },
      { role: 'FIELD_RESPONDER', title: 'Check assigned sensitive facilities', description: 'Verify conditions at schools, clinics and outdoor work sites.', dueHours: 4 },
      { role: 'COMMUNITY_VOLUNTEER', title: 'Share protection guidance', description: 'Share official guidance for children, elderly and people with respiratory illness.', dueHours: 2 },
      { role: 'STATE_EOC', title: 'Monitor district response', description: 'Track task completion and regional AQI trends.', dueHours: 6 },
    ],
  },
];

export function findTemplate(templateId: string): PlaybookTemplate | undefined {
  return PLAYBOOK_TEMPLATES.find((t) => t.id === templateId);
}

export function templateForHazard(hazardType: string): PlaybookTemplate | undefined {
  const h = String(hazardType || '').toLowerCase();
  if (/flood/.test(h)) return findTemplate('flood');
  if (/rain/.test(h)) return findTemplate('extreme_rainfall');
  if (/heat/.test(h)) return findTemplate('heatwave');
  if (/earthquake|quake/.test(h)) return findTemplate('earthquake');
  if (/landslide/.test(h)) return findTemplate('landslide');
  if (/air|pollution|aqi|smog/.test(h)) return findTemplate('air_pollution');
  return undefined;
}
