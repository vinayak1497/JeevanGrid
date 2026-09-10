/**
 * Centralized map provider configuration (JeevanGrid GIS).
 * All providers are keyless and permit embedded use with attribution.
 * Switching basemaps never touches overlays, center, or zoom.
 */

export type BasemapKey = 'standard' | 'satellite' | 'terrain' | 'light' | 'dark';

export interface BasemapDef {
  key: BasemapKey;
  name: string;
  description: string;
  url: string;
  attribution: string;
  subdomains?: string;
  maxZoom: number;
  /** Best suited operational use (shown in the layer panel). */
  bestFor: string;
}

export const BASEMAPS: Record<BasemapKey, BasemapDef> = {
  standard: {
    key: 'standard',
    name: 'Standard',
    description: 'Roads, places & boundaries',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    bestFor: 'Everyday citizen use',
  },
  satellite: {
    key: 'satellite',
    name: 'Satellite',
    description: 'Satellite imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
    bestFor: 'Flood extent · damage · evacuation planning',
  },
  terrain: {
    key: 'terrain',
    name: 'Terrain',
    description: 'Terrain & elevation',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data &copy; OpenStreetMap contributors, SRTM | style &copy; OpenTopoMap (CC-BY-SA)',
    subdomains: 'abc',
    maxZoom: 17,
    bestFor: 'Landslide risk · drainage · hills',
  },
  light: {
    key: 'light',
    name: 'Light',
    description: 'Minimal map for data visualization',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
    bestFor: 'Choropleth · risk visualization · ops',
  },
  dark: {
    key: 'dark',
    name: 'Dark',
    description: 'High-contrast operational view',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
    bestFor: 'Night operations · high contrast',
  },
};

export const BASEMAP_ORDER: BasemapKey[] = ['standard', 'satellite', 'terrain', 'light', 'dark'];

export type OverlayKey =
  | 'risk'
  | 'medical'
  | 'shelters'
  | 'live'
  | 'quakes'
  | 'rivers'
  | 'boundary'
  | 'weather'
  | 'emergency';

export interface OverlayDef {
  key: OverlayKey;
  label: string;
  hint: string;
  defaultOn: boolean;
}

export const OVERLAY_DEFS: OverlayDef[] = [
  { key: 'risk', label: 'Risk Zones', hint: 'District risk-radius highlight', defaultOn: true },
  { key: 'medical', label: 'Hospitals', hint: 'Designated medical facilities', defaultOn: true },
  { key: 'shelters', label: 'Shelters', hint: 'Designated relief shelters', defaultOn: true },
  { key: 'live', label: 'Live OSM', hint: 'Live community facilities', defaultOn: true },
  { key: 'quakes', label: 'Earthquakes', hint: 'USGS observed events', defaultOn: true },
  { key: 'rivers', label: 'Rivers', hint: 'OSM river geometries', defaultOn: false },
  { key: 'boundary', label: 'District Boundaries', hint: 'OSM administrative linework', defaultOn: true },
  { key: 'weather', label: 'Weather', hint: 'Live precipitation radar', defaultOn: false },
  { key: 'emergency', label: 'Emergency Facilities', hint: 'Fire stations & police posts', defaultOn: false },
];

export type ClarityKey = 'minimal' | 'standard' | 'detailed';

export type PresetKey = 'citizen' | 'response' | 'flood' | 'infrastructure';

export const PRESETS: Array<{
  key: PresetKey;
  label: string;
  description: string;
  overlays: OverlayKey[];
}> = [
  {
    key: 'citizen',
    label: 'Citizen',
    description: 'Roads, hospitals, shelters, emergency help',
    overlays: ['risk', 'medical', 'shelters', 'live', 'emergency', 'boundary'],
  },
  {
    key: 'response',
    label: 'Emergency Response',
    description: 'Hospitals, fire/police, shelters, risk zones',
    overlays: ['risk', 'medical', 'shelters', 'live', 'emergency', 'quakes', 'boundary'],
  },
  {
    key: 'flood',
    label: 'Flood Monitoring',
    description: 'Rivers, rainfall radar, risk zones',
    overlays: ['risk', 'rivers', 'weather', 'boundary', 'live', 'medical', 'shelters'],
  },
  {
    key: 'infrastructure',
    label: 'Infrastructure',
    description: 'Roads, bridges, hospitals, critical facilities',
    overlays: ['risk', 'medical', 'live', 'emergency', 'boundary'],
  },
];
