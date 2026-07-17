import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';

/** User feedback & suggestions submitted from the mobile app. Admin can view and process. */
export const feedbackRoutes = Router();

const processSchema = z.object({
  body: z.object({
    status: z.enum(['RESOLVED', 'DISMISSED']),
  }),
});

// List feedback — admins see their org's feedback; super admin sees all
feedbackRoutes.get(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { status, page = '1', pageSize = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);

    const organizationId = req.actor!.isSuperAdmin
      ? (req.query.organizationId as string | undefined)
      : req.actor!.organizationIds[0] ?? undefined;

    const where: any = { deletedAt: undefined };
    if (organizationId) where.organizationId = organizationId;
    if (status) where.status = status;

    const [rows, total] = await Promise.all([
      prisma.userFeedback.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, mobile: true } },
          organization: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(pageSize),
      }),
      prisma.userFeedback.count({ where }),
    ]);

    return ok(res, rows, { total, page: parseInt(page), pageSize: parseInt(pageSize) });
  }),
);

// Process (resolve/dismiss) a feedback
feedbackRoutes.patch(
  '/:id',
  requireAuth,
  requirePermission('SETTINGS', 'EDIT'),
  validate(processSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const existing = await prisma.userFeedback.findUnique({ where: { id: req.params.id } });
    if (!existing) throw ApiError.notFound('Feedback not found.');

    const updated = await prisma.userFeedback.update({
      where: { id: req.params.id },
      data: {
        status: req.body.status,
        resolvedAt: new Date(),
        resolvedById: req.actor!.userId,
      },
    });
    return ok(res, updated);
  }),
);

// Submit feedback from app (public-facing — any authenticated user)
feedbackRoutes.post(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, category, comment, userName } = req.body;
    if (!comment) throw new ApiError('VALIDATION_ERROR', 'Comment is required.');


    const row = await prisma.userFeedback.create({
      data: {
        organizationId: organizationId ?? null,
        userId: req.actor!.userId,
        userName: userName ?? null,
        category: category ?? 'Application',
        comment,
        status: 'PENDING',
      },
    });
    return ok(res, row);
  }),
);
