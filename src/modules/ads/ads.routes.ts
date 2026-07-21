import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
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
    pricingModel: z.enum(['FLAT', 'CPC', 'CPM']).optional(),
    priceRate: z.number().nonnegative().optional(),
    totalCost: z.number().nonnegative().optional(),
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
    const start = new Date(req.body.startAt);
    const end = new Date(req.body.endAt);
    if (end <= start) {
      throw ApiError.validation({ endAt: ['End date must be after start date'] });
    }
    const pricingModel = req.body.pricingModel || 'FLAT';
    const priceRate = req.body.priceRate || 0;
    let totalCost = req.body.totalCost || 0;
    
    if (pricingModel === 'FLAT') {
      const msDiff = end.getTime() - start.getTime();
      const days = Math.ceil(msDiff / (1000 * 60 * 60 * 24)) || 1;
      totalCost = priceRate * days;
    }

    const ad = await prisma.ad.create({
      data: {
        ...req.body,
        totalCost,
        createdById: req.actor!.userId,
      },
    });
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
    const adId = req.params.adId as string;
    const existing = await prisma.ad.findUnique({ where: { id: adId } });
    if (!existing) throw ApiError.notFound('Ad not found.');

    const start = req.body.startAt ? new Date(req.body.startAt) : new Date(existing.startAt);
    const end = req.body.endAt ? new Date(req.body.endAt) : new Date(existing.endAt);
    if (end <= start) {
      throw ApiError.validation({ endAt: ['End date must be after start date'] });
    }

    const pricingModel = req.body.pricingModel || existing.pricingModel;
    const priceRate = req.body.priceRate !== undefined ? req.body.priceRate : existing.priceRate;
    let totalCost = req.body.totalCost !== undefined ? req.body.totalCost : existing.totalCost;

    if (pricingModel === 'FLAT') {
      const msDiff = end.getTime() - start.getTime();
      const days = Math.ceil(msDiff / (1000 * 60 * 60 * 24)) || 1;
      totalCost = priceRate * days;
    }

    const ad = await prisma.ad.update({
      where: { id: adId },
      data: {
        ...req.body,
        totalCost,
      },
    });
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
