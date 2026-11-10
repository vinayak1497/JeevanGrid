import { Request, Response } from 'express';
import { z } from 'zod';
import { isCloudinaryConfigured, uploadImageDataUrl } from '../utils/cloudinary';

const schema = z.object({
  dataUrl: z.string().min(30).max(10_000_000),
  folder: z.enum(['jeevangrid/reports', 'jeevangrid/sitreps']).optional(),
});

export async function uploadReportPhoto(req: Request, res: Response): Promise<void> {
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: 'A valid image data URL is required (max 10 MB).' });
    return;
  }
  if (!isCloudinaryConfigured()) {
    res.status(503).json({
      error: 'Photo storage is not configured. Submit the report without a photo, or configure CLOUDINARY_* on the server.',
      code: 'PHOTO_STORAGE_UNAVAILABLE',
    });
    return;
  }
  const result = await uploadImageDataUrl(parsed.data.dataUrl, parsed.data.folder || 'jeevangrid/reports');
  if (!result.ok) {
    const status = result.reason === 'IMAGE_TOO_LARGE' ? 413 : result.reason === 'INVALID_IMAGE_DATA_URL' ? 400 : 502;
    res.status(status).json({ error: result.reason || 'Image upload failed.' });
    return;
  }
  res.status(201).json({
    url: result.url,
    publicId: result.publicId,
    provider: 'cloudinary',
    note: 'Uploaded media is served from Cloudinary. Do not upload identity documents or unnecessary personal data.',
  });
}
