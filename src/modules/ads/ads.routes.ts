import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { prisma } from '@/config/prisma';

const createAdSchema = z.object({
  body: z.object({
    bannerUrl: z.string().min(1),
    targetLink: z.string().optional(),
    slot: z.enum(['TOP_BANNER', 'IN_FEED']),
    targeting: z
      .object({
        all: z.boolean().default(true),
        cities: z.array(z.string()).optional(),
        states: z.array(z.string()).optional(),
        countries: z.array(z.string()).optional(),
      })
      .optional(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
  }),
});

const updateAdSchema = z.object({ body: createAdSchema.shape.body.partial().extend({ isActive: z.boolean().optional() }) });

/** Ads (§5.13): Super Admin only — slots, geo targeting, scheduling; expired ads auto-hidden. */
export const adRoutes = Router();

adRoutes.post(
  '/',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  validate(createAdSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const ad = await prisma.ad.create({ data: { ...req.body, createdById: req.actor!.userId } });
    return created(res, ad);
  }),
);

adRoutes.get(
  '/',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    // Active list hides expired ads (§5.13/§5.14)
    const showExpired = req.query.includeExpired === 'true';
    const ads = await prisma.ad.findMany({
      where: showExpired ? {} : { endAt: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, ads);
  }),
);

adRoutes.patch(
  '/:adId',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  validate(updateAdSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const ad = await prisma.ad.update({ where: { id: req.params.adId as string }, data: req.body });
    return ok(res, ad);
  }),
);

// Click/view tracking (any member)
adRoutes.post(
  '/:adId/click',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.ad.update({ where: { id: req.params.adId as string }, data: { clickCount: { increment: 1 } } });
    return ok(res, { tracked: true });
  }),
);

adRoutes.post(
  '/:adId/view',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.ad.update({ where: { id: req.params.adId as string }, data: { viewCount: { increment: 1 } } });
    return ok(res, { tracked: true });
  }),
);
