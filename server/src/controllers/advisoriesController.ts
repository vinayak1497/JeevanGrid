import { Request, Response } from 'express';

/**
 * Official telemetry provenance.
 * SACHET (NDMA) and INCOIS expose no public machine-readable alert APIs,
 * so the engine links officials sources directly instead of fabricating
 * warnings. Only live, keyless feeds (Open-Meteo, USGS, Overpass) are
 * consumed programmatically; everything else is labeled demo data while
 * DEMO_MODE=true.
 */
export function getAdvisorySources(_req: Request, res: Response): void {
  const sachet = process.env.SACHET_BASE_URL || 'https://sachet.ndma.gov.in/';
  const incois = process.env.INCOIS_BASE_URL || 'https://incois.gov.in/';
  res.json({
    demoMode: process.env.DEMO_MODE === 'true',
    liveFeeds: [
      { name: 'Open-Meteo Weather', url: process.env.OPEN_METEO_BASE_URL || 'https://open-meteo.com/', kind: 'programmatic', needsKey: false },
      { name: 'Open-Meteo Air Quality (CAMS)', url: 'https://open-meteo.com/en/docs/air-quality-api', kind: 'programmatic', needsKey: false },
      { name: 'USGS Earthquake Hazards Program', url: process.env.USGS_EARTHQUAKE_API_URL || 'https://earthquake.usgs.gov/', kind: 'programmatic', needsKey: false },
      { name: 'OpenStreetMap Overpass (facilities)', url: process.env.OVERPASS_API_URL || 'https://wiki.openstreetmap.org/wiki/Overpass_API', kind: 'programmatic', needsKey: false },
    ],
    officialBulletins: [
      { name: 'IMD Warnings', url: 'https://mausam.imd.gov.in/' },
      { name: 'SACHET (NDMA Common Alerting Protocol)', url: sachet },
      { name: 'INCOIS Ocean & Tsunami Advisories', url: incois },
      { name: 'CWC Flood Forecast', url: 'https://cwc.gov.in/' },
      { name: 'NDMA Guidelines', url: 'https://ndma.gov.in/' },
    ],
    note: 'Programmatic feeds above are fused live. Bulletin items are authoritative human-issued sources linked, never scraped or fabricated.',
  });
}
