import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission, scopeToOrganization } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';

/** FAQ management per organization — Temple/Dharamshala/JainCenter admins manage their own FAQs. */
export const faqRoutes = Router();

const createFaqSchema = z.object({
  body: z.object({
    organizationId: z.string().min(1),
    question: z.string().min(1),
    answer: z.string().min(1),
    category: z.string().optional(),
    displayOrder: z.coerce.number().optional(),
  }),
});

const updateFaqSchema = z.object({
  body: z.object({
    question: z.string().optional(),
    answer: z.string().optional(),
    category: z.string().optional(),
    displayOrder: z.coerce.number().optional(),
    isActive: z.boolean().optional(),
  }),
});

// List FAQs for an organization
faqRoutes.get(
  '/org/:organizationId',
  requireAuth,
  scopeToOrganization,
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params;
    const rows = await prisma.orgFaq.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return ok(res, rows, { total: rows.length });
  }),
);

// Create FAQ
faqRoutes.post(
  '/',
  requireAuth,
  requirePermission('ANNOUNCEMENTS', 'CREATE'),
  validate(createFaqSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, question, answer, category, displayOrder } = req.body;
    const faq = await prisma.orgFaq.create({
      data: {
        organizationId,
        question,
        answer,
        category: category ?? 'General',
        displayOrder: displayOrder ?? 0,
        createdById: req.actor!.userId,
      },
    });
    return created(res, faq);
  }),
);

// Update FAQ
faqRoutes.patch(
  '/:id',
  requireAuth,
  requirePermission('ANNOUNCEMENTS', 'EDIT'),
  validate(updateFaqSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const faq = await prisma.orgFaq.findUnique({ where: { id: req.params.id } });
    if (!faq || faq.deletedAt) throw ApiError.notFound('FAQ not found.');

    const updated = await prisma.orgFaq.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() },
    });
    return ok(res, updated);
  }),
);

// Soft delete FAQ
faqRoutes.delete(
  '/:id',
  requireAuth,
  requirePermission('ANNOUNCEMENTS', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const faq = await prisma.orgFaq.findUnique({ where: { id: req.params.id } });
    if (!faq) throw ApiError.notFound('FAQ not found.');

    const deleted = await prisma.orgFaq.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), deletedById: req.actor!.userId },
    });
    return ok(res, deleted);
  }),
);
