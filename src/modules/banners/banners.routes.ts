import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireSuperAdmin } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';

/** Promotional banners — Super Admin only */
export const bannerRoutes = Router();

const createBannerSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    imageUrl: z.string().url(),
    redirectUrl: z.string().optional(),
    displayOrder: z.coerce.number().optional(),
  }),
});

const updateBannerSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    imageUrl: z.string().url().optional(),
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
    const { title, imageUrl, redirectUrl, displayOrder } = req.body;
    const banner = await prisma.appBanner.create({
      data: {
        title,
        imageUrl,
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
