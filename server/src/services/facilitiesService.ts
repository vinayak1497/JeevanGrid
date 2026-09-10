import { prisma } from '../utils/prisma';
import { geoService } from './geoService';
import { overpassService, type LiveFacility } from './overpassService';

export interface FacilitiesBundle {
  hospitals: any[];
  shelters: any[];
  liveFacilities: LiveFacility[];
  liveSource: 'overpass' | 'none';
  designatedDataIsDemo: boolean;
}

/** Shared by the REST controller and the AI orchestrator. */
export async function getFacilities(location: string): Promise<FacilitiesBundle> {
  const resolved = await geoService.resolveLocationLive(location);
  const [prismaHospitals, prismaShelters, live] = await Promise.all([
    prisma.hospital
      .findMany({
        where: { OR: [{ state: resolved.state }, { district: resolved.district }] },
        take: 6,
      })
      .catch(() => []),
    prisma.shelter
      .findMany({
        where: { OR: [{ state: resolved.state }, { district: resolved.district }] },
        take: 6,
      })
      .catch(() => []),
    overpassService.getFacilitiesForCoords(resolved.lat, resolved.lng).catch(() => ({ facilities: [], source: 'none' as const })),
  ]);
  return {
    hospitals: prismaHospitals,
    shelters: prismaShelters,
    // Drop untagged OSM nodes ("Unnamed …") — a name is the minimum
    // for a facility to be actionable in an emergency.
    liveFacilities: live.facilities.filter((f) => !/^unnamed\b/i.test(f.name || '')),
    liveSource: live.source,
    designatedDataIsDemo: process.env.DEMO_MODE === 'true',
  };
}
