import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requireAuth } from '@/middlewares/auth';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { storage } from '@/utils/storage';
import { ApiError } from '@/utils/ApiError';

/**
 * Generic file upload used by the admin panel (gallery images, banners,
 * payment proofs, staff documents). Accepts a single multipart file under
 * the field name `file` and returns `{ url }` served from /static.
 */
const ALLOWED_MIME = /^(image\/(png|jpe?g|webp|gif|svg\+xml)|application\/pdf)$/;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadRoutes = Router();

uploadRoutes.post(
  '/',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw ApiError.validation({ file: ['No file provided (expected multipart field "file")'] });
    if (!ALLOWED_MIME.test(req.file.mimetype)) {
      throw ApiError.validation({ file: [`Unsupported file type: ${req.file.mimetype}`] });
    }
    const stored = await storage.save(req.file.buffer, req.file.originalname, req.file.mimetype, 'uploads');
    return ok(res, { url: stored.url, key: stored.key, sizeBytes: stored.sizeBytes, mimeType: stored.mimeType });
  }),
);
