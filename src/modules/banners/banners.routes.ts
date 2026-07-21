import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireSuperAdmin } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';
import http from 'http';
import https from 'https';

interface Dimensions {
  width: number;
  height: number;
}

function getImageDimensions(url: string): Promise<Dimensions> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => {
        chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        try {
          const dims = parseImageSize(buffer);
          if (dims) {
            res.destroy(); // stop downloading
            resolve(dims);
          }
        } catch (e) {
          // ignore and keep downloading until we have enough bytes
        }
      });
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        try {
          const dims = parseImageSize(buffer);
          if (dims) {
            resolve(dims);
          } else {
            reject(new Error('Could not parse image dimensions'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function parseImageSize(buffer: Buffer): Dimensions | null {
  // Check for PNG
  if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }
  // Check for JPEG
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buffer.length) {
      const marker = buffer[i];
      const nextMarker = buffer[i + 1];
      if (marker === 0xff && nextMarker !== undefined && nextMarker >= 0xc0 && nextMarker <= 0xc3) {
        const height = buffer.readUInt16BE(i + 5);
        const width = buffer.readUInt16BE(i + 7);
        return { width, height };
      }
      i++;
    }
  }
  return null;
}

/** Promotional banners — Super Admin only */
export const bannerRoutes = Router();

const createBannerSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    imageUrl: z.string().url(),
    deviceType: z.enum(['MOBILE', 'DESKTOP']).optional(),
    redirectUrl: z.string().optional(),
    displayOrder: z.coerce.number().optional(),
  }),
});

const updateBannerSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    imageUrl: z.string().url().optional(),
    deviceType: z.enum(['MOBILE', 'DESKTOP']).optional(),
    redirectUrl: z.string().optional(),
    displayOrder: z.coerce.number().optional(),
    isActive: z.boolean().optional(),
  }),
});

// List all active banners
bannerRoutes.get(
  '/',
  requireAuth,
  asyncHandler(async (_req: Request, res: Response) => {
    const rows = await prisma.appBanner.findMany({
      where: { deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    });
    return ok(res, rows, { total: rows.length });
  }),
);

// Create banner (Super Admin only)
bannerRoutes.post(
  '/',
  requireAuth,
  requireSuperAdmin,
  validate(createBannerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { title, imageUrl, redirectUrl, displayOrder, deviceType } = req.body;
    
    if (imageUrl) {
      try {
        const dims = await getImageDimensions(imageUrl);
        const ratio = dims.width / dims.height;
        const expected = deviceType === 'DESKTOP' ? 5.0 : 3.0;
        const tolerance = deviceType === 'DESKTOP' ? 0.35 : 0.25;
        if (Math.abs(ratio - expected) > tolerance) {
          throw ApiError.validation({ imageUrl: [`Image must match a ${deviceType === 'DESKTOP' ? '5:1' : '3:1'} ratio. Got ${ratio.toFixed(2)}:1.`] });
        }
      } catch (e: any) {
        if (e.statusCode === 400 || e.message?.includes('ratio')) {
          throw e;
        }
        console.warn('Backend banner validation warning:', e.message);
      }
    }

    const banner = await prisma.appBanner.create({
      data: {
        title,
        imageUrl,
        deviceType: deviceType ?? 'MOBILE',
        redirectUrl: redirectUrl ?? null,
        displayOrder: displayOrder ?? 0,
        createdById: req.actor!.userId,
      },
    });
    return created(res, banner);
  }),
);

// Update banner (Super Admin only)
bannerRoutes.patch(
  '/:id',
  requireAuth,
  requireSuperAdmin,
  validate(updateBannerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const banner = await prisma.appBanner.findUnique({ where: { id: req.params.id } });
    if (!banner || banner.deletedAt) throw ApiError.notFound('Banner not found.');
    
    const imageUrl = req.body.imageUrl ?? banner.imageUrl;
    const deviceType = req.body.deviceType ?? banner.deviceType;

    if (req.body.imageUrl || req.body.deviceType) {
      try {
        const dims = await getImageDimensions(imageUrl);
        const ratio = dims.width / dims.height;
        const expected = deviceType === 'DESKTOP' ? 5.0 : 3.0;
        const tolerance = deviceType === 'DESKTOP' ? 0.35 : 0.25;
        if (Math.abs(ratio - expected) > tolerance) {
          throw ApiError.validation({ imageUrl: [`Image must match a ${deviceType === 'DESKTOP' ? '5:1' : '3:1'} ratio. Got ${ratio.toFixed(2)}:1.`] });
        }
      } catch (e: any) {
        if (e.statusCode === 400 || e.message?.includes('ratio')) {
          throw e;
        }
        console.warn('Backend banner validation warning:', e.message);
      }
    }

    const updated = await prisma.appBanner.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() },
    });
    return ok(res, updated);
  }),
);

// Soft-delete banner (Super Admin only)
bannerRoutes.delete(
  '/:id',
  requireAuth,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const banner = await prisma.appBanner.findUnique({ where: { id: req.params.id } });
    if (!banner || banner.deletedAt) throw ApiError.notFound('Banner not found.');
    const deleted = await prisma.appBanner.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), deletedById: req.actor!.userId },
    });
    return ok(res, deleted);
  }),
);
