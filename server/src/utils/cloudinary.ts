import crypto from 'crypto';

/**
 * Cloudinary signed image upload (server-side only).
 * Uses the configured CLOUDINARY_* credentials; never exposes the API secret.
 * Without credentials the caller gets a typed "unavailable" result and the
 * report keeps its existing photoUrl behaviour.
 */
export interface ImageUploadResult {
  ok: boolean;
  url?: string;
  publicId?: string;
  reason?: string;
}

const DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i;

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

export async function uploadImageDataUrl(dataUrl: string, folder = 'jeevangrid/reports'): Promise<ImageUploadResult> {
  if (!isCloudinaryConfigured()) return { ok: false, reason: 'CLOUDINARY_NOT_CONFIGURED' };
  const match = DATA_URL_RE.exec(String(dataUrl || ''));
  if (!match) return { ok: false, reason: 'INVALID_IMAGE_DATA_URL' };
  const base64 = match[2].replace(/\s/g, '');
  if (base64.length > 7_000_000) return { ok: false, reason: 'IMAGE_TOO_LARGE' };

  const cloud = process.env.CLOUDINARY_CLOUD_NAME as string;
  const apiKey = process.env.CLOUDINARY_API_KEY as string;
  const apiSecret = process.env.CLOUDINARY_API_SECRET as string;
  const timestamp = Math.floor(Date.now() / 1000);
  const params = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto.createHash('sha1').update(`${params}${apiSecret}`).digest('hex');

  const body = new URLSearchParams({
    file: `data:image/${match[1]};base64,${base64}`,
    api_key: apiKey,
    timestamp: String(timestamp),
    folder,
    signature,
  });

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const payload: any = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, reason: payload?.error?.message || `CLOUDINARY_HTTP_${res.status}` };
      return { ok: true, url: String(payload.secure_url), publicId: String(payload.public_id || '') };
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    return { ok: false, reason: (e as Error).message.slice(0, 160) };
  }
}
