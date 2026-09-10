import { Request, Response } from 'express';
import { riskEngineService } from '../services/riskEngine';

export async function getRiskAnalysis(req: Request, res: Response): Promise<void> {
  try {
    const location = (req.params.location || req.query.location || 'Mumbai') as string;
    const analysis = await riskEngineService.analyzeLocationRisk(location);
    res.json({ analysis });
  } catch (error) {
    console.error('Risk analysis error:', error);
    res.status(500).json({ error: 'Failed to compute disaster risk analysis.' });
  }
}
