import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export async function listGuides(req: Request, res: Response): Promise<void> {
  try {
    const guides = await prisma.safetyGuide.findMany();
    // Parse JSON fields
    const parsed = guides.map((g) => ({
      ...g,
      beforeSteps: JSON.parse(g.beforeSteps),
      duringSteps: JSON.parse(g.duringSteps),
      afterSteps: JSON.parse(g.afterSteps),
      dos: JSON.parse(g.dos),
      donts: JSON.parse(g.donts),
      kitItems: JSON.parse(g.kitItems),
      evacuationTriggers: JSON.parse(g.evacuationTriggers),
    }));

    res.json({ guides: parsed });
  } catch (error) {
    console.error('List guides error:', error);
    res.status(500).json({ error: 'Failed to fetch safety guides.' });
  }
}

export async function getGuideBySlug(req: Request, res: Response): Promise<void> {
  try {
    const { slug } = req.params;
    const guide = await prisma.safetyGuide.findUnique({
      where: { slug },
    });

    if (!guide) {
      res.status(404).json({ error: 'Safety guide not found.' });
      return;
    }

    const parsed = {
      ...guide,
      beforeSteps: JSON.parse(guide.beforeSteps),
      duringSteps: JSON.parse(guide.duringSteps),
      afterSteps: JSON.parse(guide.afterSteps),
      dos: JSON.parse(guide.dos),
      donts: JSON.parse(guide.donts),
      kitItems: JSON.parse(guide.kitItems),
      evacuationTriggers: JSON.parse(guide.evacuationTriggers),
    };

    res.json({ guide: parsed });
  } catch (error) {
    console.error('Get guide error:', error);
    res.status(500).json({ error: 'Failed to fetch safety guide.' });
  }
}
