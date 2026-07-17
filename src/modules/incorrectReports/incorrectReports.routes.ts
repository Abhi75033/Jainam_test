import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';

/** Incorrect information reports flagged by community users from mobile app. */
export const incorrectReportRoutes = Router();

const reviewSchema = z.object({
  body: z.object({
    status: z.enum(['VERIFIED', 'REJECTED', 'CORRECTED']),
    reviewNote: z.string().optional(),
  }),
});

const submitSchema = z.object({
  body: z.object({
    organizationId: z.string().optional(),
    entityType: z.string().min(1),
    entityId: z.string().optional(),
    entityName: z.string().optional(),
    flaggedField: z.string().min(1),
    currentValue: z.string().optional(),
    correctedValue: z.string().min(1),
    reporterName: z.string().optional(),
  }),
});

// List incorrect reports (scoped to org admin or all for super admin)
incorrectReportRoutes.get(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { status, page = '1', pageSize = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);

    const organizationId = req.actor!.isSuperAdmin
      ? (req.query.organizationId as string | undefined)
      : req.actor!.organizationIds[0] ?? undefined;


    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    if (status) where.status = status;

    const [rows, total] = await Promise.all([
      prisma.incorrectReport.findMany({
        where,
        include: {
          reporter: { select: { firstName: true, lastName: true, mobile: true } },
          organization: { select: { name: true, type: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(pageSize),
      }),
      prisma.incorrectReport.count({ where }),
    ]);

    return ok(res, rows, { total, page: parseInt(page), pageSize: parseInt(pageSize) });
  }),
);

// Review (verify / reject / mark corrected) a report
incorrectReportRoutes.patch(
  '/:id',
  requireAuth,
  requirePermission('SETTINGS', 'EDIT'),
  validate(reviewSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const existing = await prisma.incorrectReport.findUnique({ where: { id: req.params.id } });
    if (!existing) throw ApiError.notFound('Report not found.');

    const updated = await prisma.incorrectReport.update({
      where: { id: req.params.id },
      data: {
        status: req.body.status,
        reviewNote: req.body.reviewNote ?? null,
        reviewedAt: new Date(),
        reviewedById: req.actor!.userId,
      },
    });
    return ok(res, updated);
  }),
);

// Submit a report (from member app — any auth user)
incorrectReportRoutes.post(
  '/',
  requireAuth,
  validate(submitSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const row = await prisma.incorrectReport.create({
      data: {
        ...req.body,
        reporterId: req.actor!.userId,
        status: 'PENDING',
      },
    });
    return ok(res, row);
  }),
);
