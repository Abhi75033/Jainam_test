import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireSuperAdmin } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';

/** Home screen layout sections — Super Admin only */
export const homeSectionRoutes = Router();

const createSectionSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    sectionType: z.enum(['Carousel', 'Grid', 'List', 'Horizontal Cards']).optional(),
    displayOrder: z.coerce.number().optional(),
    config: z.record(z.unknown()).optional(),
  }),
});

const updateSectionSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    sectionType: z.enum(['Carousel', 'Grid', 'List', 'Horizontal Cards']).optional(),
    displayOrder: z.coerce.number().optional(),
    isActive: z.boolean().optional(),
    config: z.record(z.unknown()).optional(),
  }),
});

// List all home sections
homeSectionRoutes.get(
  '/',
  requireAuth,
  asyncHandler(async (_req: Request, res: Response) => {
    const rows = await prisma.appHomeSection.findMany({
      where: { deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    });
    return ok(res, rows, { total: rows.length });
  }),
);

// Create home section (Super Admin only)
homeSectionRoutes.post(
  '/',
  requireAuth,
  requireSuperAdmin,
  validate(createSectionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, sectionType, displayOrder, config } = req.body;
    const section = await prisma.appHomeSection.create({
      data: {
        name,
        sectionType: sectionType ?? 'Carousel',
        displayOrder: displayOrder ?? 0,
        config: config ?? undefined,
        createdById: req.actor!.userId,
      },
    });
    return created(res, section);
  }),
);

// Update home section (Super Admin only)
homeSectionRoutes.patch(
  '/:id',
  requireAuth,
  requireSuperAdmin,
  validate(updateSectionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const section = await prisma.appHomeSection.findUnique({ where: { id: req.params.id } });
    if (!section || section.deletedAt) throw ApiError.notFound('Home section not found.');
    const updated = await prisma.appHomeSection.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() },
    });
    return ok(res, updated);
  }),
);

// Soft-delete home section (Super Admin only)
homeSectionRoutes.delete(
  '/:id',
  requireAuth,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const section = await prisma.appHomeSection.findUnique({ where: { id: req.params.id } });
    if (!section || section.deletedAt) throw ApiError.notFound('Home section not found.');
    const deleted = await prisma.appHomeSection.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), deletedById: req.actor!.userId },
    });
    return ok(res, deleted);
  }),
);
