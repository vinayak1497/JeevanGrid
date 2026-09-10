import { Request, Response } from 'express';
import { geoService } from '../services/geoService';
import { getFacilities } from '../services/facilitiesService';

/**
 * Unified facilities endpoint: live OSM/Overpass civic POIs first,
 * Prisma-curated designated facilities always included.
 */
export async function listFacilities(req: Request, res: Response): Promise<void> {
  try {
    const location = (req.query.location as string) || 'Mumbai';
    const resolved = geoService.resolveLocation(location);
    const bundle = await getFacilities(location);

    res.json({
      location: resolved,
      hospitals: bundle.hospitals,
      shelters: bundle.shelters,
      // Seeded registries are evaluation fixtures while DEMO_MODE=true.
      designatedDataIsDemo: bundle.designatedDataIsDemo,
      liveFacilities: bundle.liveFacilities,
      liveSource: bundle.liveSource,
    });
  } catch (error) {
    console.error('Facilities error:', error);
    res.status(500).json({ error: 'Failed to fetch facilities.' });
  }
}
