import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { prisma } from '@/config/prisma';
import { PermissionAction } from '@prisma/client';
import { recordAudit, auditContextFromRequest } from '@/engines/audit/audit.service';

const upsertSettingSchema = z.object({
  body: z.object({ value: z.unknown() }),
});

const rolePermissionSchema = z.object({
  body: z.object({
    permissions: z.array(
      z.object({
        module: z.string(),
        action: z.enum(['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'REJECT', 'DELETE']),
        allowed: z.boolean(),
      }),
    ),
  }),
});

const overrideSchema = z.object({
  body: z.object({
    organizationId: z.string().nullable().optional(),
    module: z.string(),
    action: z.enum(['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'REJECT', 'DELETE']),
    allowed: z.boolean(),
  }),
});

const thresholdSchema = z.object({ body: z.object({ value: z.number().int().positive() }) });

/** Settings module (§5.23): role management, alert thresholds, notification settings, payment-window defaults. All Super Admin. */
export const settingsRoutes = Router();

settingsRoutes.get('/app', requireAuth, requireRole('SUPER_ADMIN'), asyncHandler(async (_req: Request, res: Response) => {
  const settings = await prisma.appSetting.findMany();
  return ok(res, settings);
}));

settingsRoutes.put('/app/:key', requireAuth, requireRole('SUPER_ADMIN'), validate(upsertSettingSchema), asyncHandler(async (req: Request, res: Response) => {
  const setting = await prisma.appSetting.upsert({
    where: { key: req.params.key as string },
    update: { value: req.body.value as any, updatedById: req.actor!.userId },
    create: { key: req.params.key as string, value: req.body.value as any, updatedById: req.actor!.userId },
  });
  return ok(res, setting);
}));

// Role permission matrix management (§3: Super Admin dynamically allocates modules)
settingsRoutes.get('/roles/:roleKey/permissions', requireAuth, requireRole('SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const role = await prisma.role.findUnique({ where: { key: req.params.roleKey as any }, include: { permissions: true } });
  return ok(res, role);
}));

settingsRoutes.put('/roles/:roleKey/permissions', requireAuth, requireRole('SUPER_ADMIN'), validate(rolePermissionSchema), asyncHandler(async (req: Request, res: Response) => {
  const role = await prisma.role.findUniqueOrThrow({ where: { key: req.params.roleKey as any } });
  for (const p of req.body.permissions as { module: string; action: PermissionAction; allowed: boolean }[]) {
    await prisma.rolePermission.upsert({
      where: { roleId_module_action: { roleId: role.id, module: p.module, action: p.action } },
      update: { allowed: p.allowed },
      create: { roleId: role.id, module: p.module, action: p.action, allowed: p.allowed },
    });
  }
  await recordAudit({ ...auditContextFromRequest(req), module: 'SETTINGS', action: 'PERMISSION_CHANGE', entityType: 'RolePermission', entityId: role.id, after: req.body.permissions, isCritical: true });
  const permissions = await prisma.rolePermission.findMany({ where: { roleId: role.id } });
  return ok(res, permissions);
}));

// Per-user permission overrides
settingsRoutes.post('/users/:userId/permission-overrides', requireAuth, requireRole('SUPER_ADMIN'), validate(overrideSchema), asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, module, action, allowed } = req.body;
  const override = await prisma.userPermissionOverride.upsert({
    where: {
      userId_organizationId_module_action: {
        userId: req.params.userId as string,
        organizationId: organizationId ?? null,
        module,
        action,
      },
    },
    update: { allowed },
    create: { userId: req.params.userId as string, organizationId, module, action, allowed, createdById: req.actor!.userId },
  });
  await recordAudit({ ...auditContextFromRequest(req), module: 'SETTINGS', action: 'PERMISSION_CHANGE', entityType: 'UserPermissionOverride', entityId: override.id, after: override, isCritical: true });
  return ok(res, override);
}));

// Alert thresholds
settingsRoutes.get('/alert-thresholds', requireAuth, requireRole('SUPER_ADMIN'), asyncHandler(async (_req: Request, res: Response) => {
  const thresholds = await prisma.alertThreshold.findMany();
  return ok(res, thresholds);
}));

settingsRoutes.put('/alert-thresholds/:type', requireAuth, requireRole('SUPER_ADMIN'), validate(thresholdSchema), asyncHandler(async (req: Request, res: Response) => {
  const threshold = await prisma.alertThreshold.upsert({
    where: { type: req.params.type as string },
    update: { value: req.body.value },
    create: { type: req.params.type as string, value: req.body.value },
  });
  return ok(res, threshold);
}));

// Login/device history — Super Admin viewable (§5.1)
settingsRoutes.get('/login-history', requireAuth, requireRole('SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { mobile, suspicious } = req.query as { mobile?: string; suspicious?: string };
  const rows = await prisma.loginHistory.findMany({
    where: { mobile, flaggedSuspicious: suspicious === 'true' ? true : undefined },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return ok(res, rows);
}));
