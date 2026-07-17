import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';

/** Manual vihar location tracking — logged by temple admins for monks without GPS */
export const manualTrackingRoutes = Router();

const createEntrySchema = z.object({
  body: z.object({
    monkId: z.string().optional(),
    monkPublicId: z.string().optional(),
    monkName: z.string().min(1),
    stationName: z.string().min(1),
    notes: z.string().optional(),
    loggedAt: z.string().datetime().optional(),
  }),
});

const updateEntrySchema = z.object({
  body: z.object({
    stationName: z.string().optional(),
    notes: z.string().optional(),
    loggedAt: z.string().datetime().optional(),
  }),
});

// List all manual tracking entries (paginated)
manualTrackingRoutes.get(
  '/',
  requireAuth,
  requirePermission('TRACKING', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 50);
    const monkId = req.query.monkId as string | undefined;
    const q = req.query.q as string | undefined;

    const where: any = { deletedAt: null };
    if (monkId) where.monkId = monkId;
    if (q) {
      where.OR = [
        { monkName: { contains: q, mode: 'insensitive' } },
        { stationName: { contains: q, mode: 'insensitive' } },
        { monkPublicId: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.manualTrackingEntry.count({ where }),
      prisma.manualTrackingEntry.findMany({
        where,
        include: { monk: { select: { id: true, dikshaName: true, photoUrl: true, publicId: true } } },
        orderBy: { loggedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return ok(res, { items, total, page, pageSize });
  }),
);

// Create manual tracking entry
manualTrackingRoutes.post(
  '/',
  requireAuth,
  requirePermission('TRACKING', 'CREATE'),
  validate(createEntrySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { monkId, monkPublicId, monkName, stationName, notes, loggedAt } = req.body;

    // If monkPublicId provided but no monkId, try to resolve
    let resolvedMonkId = monkId;
    if (!resolvedMonkId && monkPublicId) {
      const monk = await prisma.monkProfile.findUnique({ where: { publicId: monkPublicId } });
      if (monk) resolvedMonkId = monk.id;
    }

    const entry = await prisma.manualTrackingEntry.create({
      data: {
        monkId: resolvedMonkId ?? null,
        monkPublicId: monkPublicId ?? null,
        monkName,
        stationName,
        notes: notes ?? null,
        loggedAt: loggedAt ? new Date(loggedAt) : new Date(),
        loggedById: req.actor!.userId,
      },
      include: { monk: { select: { id: true, dikshaName: true, photoUrl: true, publicId: true } } },
    });
    return created(res, entry);
  }),
);

// Update an entry
manualTrackingRoutes.patch(
  '/:id',
  requireAuth,
  requirePermission('TRACKING', 'EDIT'),
  validate(updateEntrySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const entry = await prisma.manualTrackingEntry.findUnique({ where: { id: req.params.id } });
    if (!entry || entry.deletedAt) throw ApiError.notFound('Manual tracking entry not found.');

    const data: any = { ...req.body, updatedAt: new Date() };
    if (req.body.loggedAt) data.loggedAt = new Date(req.body.loggedAt);

    const updated = await prisma.manualTrackingEntry.update({
      where: { id: req.params.id },
      data,
      include: { monk: { select: { id: true, dikshaName: true, photoUrl: true, publicId: true } } },
    });
    return ok(res, updated);
  }),
);

// Delete an entry (soft)
manualTrackingRoutes.delete(
  '/:id',
  requireAuth,
  requirePermission('TRACKING', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const entry = await prisma.manualTrackingEntry.findUnique({ where: { id: req.params.id } });
    if (!entry || entry.deletedAt) throw ApiError.notFound('Manual tracking entry not found.');
    const deleted = await prisma.manualTrackingEntry.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    return ok(res, deleted);
  }),
);
