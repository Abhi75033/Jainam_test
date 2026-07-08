import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, requirePermission, scopeToOrganization } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';

const sendMessageSchema = z.object({
  body: z.object({
    organizationId: z.string().min(1), // sender org (tenant-scope checked)
    toOrgId: z.string().optional(), // omitted = broadcast
    message: z.string().min(1),
  }),
});

/**
 * Temple-to-Temple Communication (§5.21): chat between organizations +
 * broadcast messages. Messages are permanent — no admin deletion; Super Admin
 * delete only (and even that is a soft operation elsewhere; no delete route
 * exists here beyond Super Admin's).
 */
export const communicationRoutes = Router();

communicationRoutes.post(
  '/messages',
  requireAuth,
  requirePermission('COMMUNICATION', 'CREATE'),
  scopeToOrganization,
  validate(sendMessageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const message = await prisma.orgCommunication.create({
      data: {
        fromOrgId: req.body.organizationId,
        toOrgId: req.body.toOrgId,
        message: req.body.message,
        sentById: req.actor!.userId,
      },
    });
    return created(res, message);
  }),
);

communicationRoutes.get(
  '/messages',
  requireAuth,
  requirePermission('COMMUNICATION', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, withOrgId } = req.query as { organizationId?: string; withOrgId?: string };
    if (!organizationId) throw ApiError.validation({ organizationId: ['organizationId is required'] });
    if (!req.actor!.isSuperAdmin && !req.actor!.organizationIds.includes(organizationId)) throw ApiError.tenantScope();

    const messages = await prisma.orgCommunication.findMany({
      where: {
        OR: [
          { fromOrgId: organizationId, toOrgId: withOrgId },
          { fromOrgId: withOrgId, toOrgId: organizationId },
          ...(withOrgId ? [] : [{ fromOrgId: organizationId }, { toOrgId: organizationId }, { toOrgId: null }]),
        ],
      },
      include: {
        fromOrg: { select: { name: true, publicId: true } },
        toOrg: { select: { name: true, publicId: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    return ok(res, messages);
  }),
);

// Root list: Super Admin sees all org-to-org traffic
communicationRoutes.get(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.actor!.isSuperAdmin) throw ApiError.forbidden('Platform-wide communication list is Super Admin only');
    const messages = await prisma.orgCommunication.findMany({
      include: {
        fromOrg: { select: { name: true, publicId: true } },
        toOrg: { select: { name: true, publicId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return ok(res, messages);
  }),
);

// Org-scoped list alias (tenant-scoped)
communicationRoutes.get(
  '/org/:organizationId',
  requireAuth,
  requirePermission('COMMUNICATION', 'VIEW'),
  scopeToOrganization,
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.params.organizationId as string;
    const messages = await prisma.orgCommunication.findMany({
      where: { OR: [{ fromOrgId: organizationId }, { toOrgId: organizationId }, { toOrgId: null }] },
      include: {
        fromOrg: { select: { name: true, publicId: true } },
        toOrg: { select: { name: true, publicId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return ok(res, messages);
  }),
);

// Super Admin delete only (§5.21)
communicationRoutes.delete(
  '/messages/:messageId',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.orgCommunication.delete({ where: { id: req.params.messageId as string } });
    return ok(res, { deleted: true });
  }),
);
