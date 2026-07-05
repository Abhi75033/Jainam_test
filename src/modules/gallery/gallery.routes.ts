import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission, scopeToOrganization } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { prisma } from '@/config/prisma';

const createAlbumSchema = z.object({
  body: z.object({
    organizationId: z.string().min(1),
    eventId: z.string().optional(),
    name: z.string().min(1),
  }),
});

const addImagesSchema = z.object({
  body: z.object({ imageUrls: z.array(z.string().min(1)).min(1) }),
});

/**
 * Org-level Gallery (§5.22): event-wise + general albums; admin uploads;
 * member viewing only — no member downloads (serve view-optimized URLs;
 * the storage layer returns display URLs, originals are not exposed).
 */
export const galleryRoutes = Router();

galleryRoutes.post(
  '/albums',
  requireAuth,
  requirePermission('GALLERY', 'CREATE'),
  scopeToOrganization,
  validate(createAlbumSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const album = await prisma.galleryAlbum.create({ data: req.body });
    return created(res, album);
  }),
);

galleryRoutes.post(
  '/albums/:albumId/images',
  requireAuth,
  requirePermission('GALLERY', 'CREATE'),
  validate(addImagesSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const albumId = req.params.albumId as string;
    const existing = await prisma.galleryImage.count({ where: { albumId } });
    await prisma.galleryImage.createMany({
      data: (req.body.imageUrls as string[]).map((imageUrl, i) => ({ albumId, imageUrl, order: existing + i })),
    });
    const images = await prisma.galleryImage.findMany({ where: { albumId }, orderBy: { order: 'asc' } });
    return created(res, images);
  }),
);

galleryRoutes.get(
  '/org/:organizationId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const albums = await prisma.galleryAlbum.findMany({
      where: { organizationId: req.params.organizationId as string, deletedAt: null },
      include: { images: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, albums);
  }),
);
