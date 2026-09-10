import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export async function listShelters(req: Request, res: Response): Promise<void> {
  try {
    const { district, state } = req.query;
    const where: any = {};
    if (district) where.district = String(district);
    if (state) where.state = String(state);

    const shelters = await prisma.shelter.findMany({ where });
    res.json({ shelters });
  } catch (error) {
    console.error('List shelters error:', error);
    res.status(500).json({ error: 'Failed to fetch shelters.' });
  }
}

export async function listHospitals(req: Request, res: Response): Promise<void> {
  try {
    const { district, state } = req.query;
    const where: any = {};
    if (district) where.district = String(district);
    if (state) where.state = String(state);

    const hospitals = await prisma.hospital.findMany({ where });
    res.json({ hospitals });
  } catch (error) {
    console.error('List hospitals error:', error);
    res.status(500).json({ error: 'Failed to fetch hospitals.' });
  }
}

export async function listResources(req: Request, res: Response): Promise<void> {
  try {
    const { district } = req.query;
    const where: any = {};
    if (district) where.district = String(district);

    const resources = await prisma.resource.findMany({ where });
    res.json({ resources });
  } catch (error) {
    console.error('List resources error:', error);
    res.status(500).json({ error: 'Failed to fetch relief resources.' });
  }
}

export function getHelplines(req: Request, res: Response): void {
  const helplines = [
    { service: 'National Emergency Response Support System', code: '112', purpose: 'Police, Fire, Medical Integrated Dispatch', isTollFree: true },
    { service: 'National Disaster Response Force (NDRF)', code: '1078', purpose: 'Search & Rescue / Flood / Collapse Ops', isTollFree: true },
    { service: 'Medical Emergency & Ambulance', code: '108', purpose: 'Paramedics & Trauma Evacuation', isTollFree: true },
    { service: 'Fire Brigade Services', code: '101', purpose: 'Urban Fire & Chemical Incidents', isTollFree: true },
    { service: 'Women Helpline in Distress', code: '1091', purpose: 'Immediate Protection & Support', isTollFree: true },
    { service: 'State Disaster Management Control (SDMA)', code: '1070', purpose: 'State Emergency Operations Center', isTollFree: true },
    { service: 'District Disaster Control Room (DDMA)', code: '1077', purpose: 'District Collectorate Operations', isTollFree: true },
    { service: 'MCGM Disaster Control Room (Mumbai)', code: '1916', purpose: 'Municipal Flooding & Waterlogging Helpline', isTollFree: true },
  ];

  res.json({ helplines });
}
