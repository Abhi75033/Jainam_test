import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireSuperAdmin } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';

/** Subscription plans — Super Admin only */
export const subscriptionPlanRoutes = Router();

const createPlanSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    price: z.coerce.number().min(0),
    currency: z.string().optional(),
    duration: z.enum(['Monthly', 'Annual', 'Lifetime']).optional(),
    features: z.string().min(1),
  }),
});

const updatePlanSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    price: z.coerce.number().min(0).optional(),
    currency: z.string().optional(),
    duration: z.enum(['Monthly', 'Annual', 'Lifetime']).optional(),
    features: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});

// List all subscription plans
subscriptionPlanRoutes.get(
  '/',
  requireAuth,
  asyncHandler(async (_req: Request, res: Response) => {
    const rows = await prisma.subscriptionPlan.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return ok(res, rows, { total: rows.length });
  }),
);

// Create plan (Super Admin only)
subscriptionPlanRoutes.post(
  '/',
  requireAuth,
  requireSuperAdmin,
  validate(createPlanSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, price, currency, duration, features } = req.body;
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        price,
        currency: currency ?? 'INR',
        duration: duration ?? 'Monthly',
        features,
        createdById: req.actor!.userId,
      },
    });
    return created(res, plan);
  }),
);

// Update plan (Super Admin only)
subscriptionPlanRoutes.patch(
  '/:id',
  requireAuth,
  requireSuperAdmin,
  validate(updatePlanSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: req.params.id } });
    if (!plan || plan.deletedAt) throw ApiError.notFound('Subscription plan not found.');
    const updated = await prisma.subscriptionPlan.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() },
    });
    return ok(res, updated);
  }),
);

// Soft-delete plan (Super Admin only)
subscriptionPlanRoutes.delete(
  '/:id',
  requireAuth,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: req.params.id } });
    if (!plan || plan.deletedAt) throw ApiError.notFound('Subscription plan not found.');
    const deleted = await prisma.subscriptionPlan.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), deletedById: req.actor!.userId },
    });
    return ok(res, deleted);
  }),
);
