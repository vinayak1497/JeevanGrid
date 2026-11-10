import { Request, Response, NextFunction } from 'express';

/**
 * Small in-process fixed-window limiter for new public write / AI / external
 * API surfaces. Per-instance only (Render runs one scheduler instance); a
 * multi-instance deployment should move this to Redis. No new dependency.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(options: { windowMs: number; max: number; name: string }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    sweep(now);
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const key = `${options.name}:${ip}`;
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }
    if (bucket.count >= options.max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      res.status(429).json({ error: 'Too many requests. Please wait and retry.', retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) });
      return;
    }
    bucket.count += 1;
    next();
  };
}
