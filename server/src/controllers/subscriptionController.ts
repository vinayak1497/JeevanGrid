import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { alertConfig } from '../services/alerts/alertConfig';

/** District-level official-warning subscriptions (no precise location stored). */
export async function listSubscriptions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const subs = await prisma.alertSubscription.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ subscriptions: subs, pushConfigured: !!alertConfig.vapidPublicKey });
  } catch (error) {
    console.error('List subscriptions error:', error);
    res.status(500).json({ error: 'Failed to load subscriptions.' });
  }
}

export async function upsertSubscription(req: AuthRequest, res: Response): Promise<void> {
  try {
    const district = String(req.body?.district || '').trim();
    const state = String(req.body?.state || '').trim();
    const notificationEnabled = req.body?.notificationEnabled !== false;
    if (!district) {
      res.status(400).json({ error: 'district is required (district-level subscription).' });
      return;
    }
    const sub = await prisma.alertSubscription.upsert({
      where: { userId_district: { userId: req.user!.id, district } },
      update: { state, notificationEnabled },
      create: { userId: req.user!.id, district, state, notificationEnabled },
    });
    res.json({ subscription: sub });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Failed to save subscription.' });
  }
}

export async function deleteSubscription(req: AuthRequest, res: Response): Promise<void> {
  try {
    const existing = await prisma.alertSubscription.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.id) {
      res.status(404).json({ error: 'Subscription not found.' });
      return;
    }
    await prisma.alertSubscription.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to remove subscription.' });
  }
}

/** VAPID public key — safe to expose to browsers. */
export function getVapidPublicKey(_req: AuthRequest, res: Response): void {
  res.json({ vapidPublicKey: alertConfig.vapidPublicKey || null, pushConfigured: !!alertConfig.vapidPublicKey });
}

export async function savePushSubscription(req: AuthRequest, res: Response): Promise<void> {
  try {
    const endpoint = String(req.body?.endpoint || '').trim();
    const p256dh = String(req.body?.keys?.p256dh || req.body?.p256dh || '').trim();
    const auth = String(req.body?.keys?.auth || req.body?.auth || '').trim();
    const district = String(req.body?.district || '').trim();
    if (!endpoint || !p256dh || !auth) {
      res.status(400).json({ error: 'endpoint and keys.p256dh/auth are required.' });
      return;
    }
    const sub = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: req.user!.id, p256dh, auth, district },
      create: { userId: req.user!.id, endpoint, p256dh, auth, district },
    });
    res.json({ ok: true, id: sub.id, pushConfigured: !!alertConfig.vapidPublicKey });
  } catch (error) {
    console.error('Save push subscription error:', error);
    res.status(500).json({ error: 'Failed to save push subscription.' });
  }
}

export async function deletePushSubscription(req: AuthRequest, res: Response): Promise<void> {
  try {
    const endpoint = String(req.body?.endpoint || req.query.endpoint || '').trim();
    if (!endpoint) {
      res.status(400).json({ error: 'endpoint is required.' });
      return;
    }
    const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } });
    if (!existing || existing.userId !== req.user!.id) {
      res.status(404).json({ error: 'Push subscription not found.' });
      return;
    }
    await prisma.pushSubscription.delete({ where: { endpoint } });
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete push subscription error:', error);
    res.status(500).json({ error: 'Failed to remove push subscription.' });
  }
}
