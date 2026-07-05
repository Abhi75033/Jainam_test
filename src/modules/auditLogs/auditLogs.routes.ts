import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';

const listQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().optional(),
    module: z.string().optional(),
    action: z.string().optional(),
    entityType: z.string().optional(),
    isCritical: z.enum(['true', 'false']).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  }),
});

/**
 * Audit log viewer (§4.4). Immutable — READ ONLY routes, no update/delete.
 * Super Admin: full access. Org admins: limited to their own organization.
 */
export const auditLogRoutes = Router();

auditLogRoutes.get(
  '/',
  requireAuth,
  requirePermission('AUDIT_LOGS', 'VIEW'),
  validate(listQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, module, action, entityType, isCritical, from, to, page, pageSize } = req.query as any;

    // Tenant scoping: non-super-admins may only query their own organizations
    let scopedOrgId = organizationId as string | undefined;
    if (!req.actor!.isSuperAdmin) {
      if (scopedOrgId && !req.actor!.organizationIds.includes(scopedOrgId)) throw ApiError.tenantScope();
      if (!scopedOrgId) {
        if (req.actor!.organizationIds.length === 0) throw ApiError.tenantScope('No organization scope');
        scopedOrgId = undefined; // filtered by IN below
      }
    }

    const where = {
      organizationId: req.actor!.isSuperAdmin ? scopedOrgId : scopedOrgId ?? { in: req.actor!.organizationIds },
      module,
      action,
      entityType,
      isCritical: isCritical === undefined ? undefined : isCritical === 'true',
      createdAt: from || to ? { gte: from, lte: to } : undefined,
    };

    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
      }),
    ]);
    return ok(res, rows, { total });
  }),
);
