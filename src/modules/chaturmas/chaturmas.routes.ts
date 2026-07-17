import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission, scopeToOrganization } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';

/** Chaturmas seasonal stay records per organization. */
export const chaturmasRoutes = Router();

const createChaturmasSchema = z.object({
  body: z.object({
    organizationId: z.string().min(1),
    monkId: z.string().optional(),
    monkName: z.string().min(1),
    locationName: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    contactPerson: z.string().optional(),
    contactMobile: z.string().optional(),
    status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
    notes: z.string().optional(),
  }),
});

const updateChaturmasSchema = z.object({
  body: z.object({
    monkName: z.string().optional(),
    locationName: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    contactPerson: z.string().optional(),
    contactMobile: z.string().optional(),
    status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
    notes: z.string().optional(),
  }),
});

// List Chaturmas plans for an organization
chaturmasRoutes.get(
  '/org/:organizationId',
  requireAuth,
  scopeToOrganization,
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params;
    const rows = await prisma.chaturmasPlan.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        monk: { select: { publicId: true, dikshaName: true, photoUrl: true } },
      },
      orderBy: { startDate: 'desc' },
    });
    return ok(res, rows, { total: rows.length });
  }),
);

// Get single Chaturmas plan
chaturmasRoutes.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const row = await prisma.chaturmasPlan.findUnique({
      where: { id: req.params.id },
      include: { monk: { select: { publicId: true, dikshaName: true, photoUrl: true } } },
    });
    if (!row || row.deletedAt) throw ApiError.notFound('Chaturmas plan not found.');
    return ok(res, row);
  }),
);

// Create Chaturmas plan
chaturmasRoutes.post(
  '/',
  requireAuth,
  requirePermission('EVENTS', 'CREATE'),
  validate(createChaturmasSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const plan = await prisma.chaturmasPlan.create({
      data: {
        ...req.body,
        createdById: req.actor!.userId,
      },
    });
    return created(res, plan);
  }),
);

// Update Chaturmas plan
chaturmasRoutes.patch(
  '/:id',
  requireAuth,
  requirePermission('EVENTS', 'EDIT'),
  validate(updateChaturmasSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const existing = await prisma.chaturmasPlan.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) throw ApiError.notFound('Chaturmas plan not found.');

    const updated = await prisma.chaturmasPlan.update({
      where: { id: req.params.id },
      data: { ...req.body },
    });
    return ok(res, updated);
  }),
);

// Soft delete
chaturmasRoutes.delete(
  '/:id',
  requireAuth,
  requirePermission('EVENTS', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const existing = await prisma.chaturmasPlan.findUnique({ where: { id: req.params.id } });
    if (!existing) throw ApiError.notFound('Chaturmas plan not found.');
    const deleted = await prisma.chaturmasPlan.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    return ok(res, deleted);
  }),
);
