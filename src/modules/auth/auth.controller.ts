import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import * as authService from './auth.service';
import * as adminAccountsService from './adminAccounts.service';
import { loadEffectivePermissions, listAssignedModules } from '@/engines/rbac/permission.service';
import { prisma } from '@/config/prisma';
import { created } from '@/utils/apiResponse';
import { recordAudit, auditContextFromRequest } from '@/engines/audit/audit.service';

export const requestOtp = asyncHandler(async (req: Request, res: Response) => {
  const { mobile, purpose } = req.body;
  const result = await authService.requestOtpForPurpose(mobile, purpose);
  return ok(res, result);
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { mobile, otp, purpose, deviceId, deviceType, os, appVersion } = req.body;
  const result = await authService.verifyOtpAndAuthenticate({
    mobile,
    otp,
    purpose,
    device: { deviceId, deviceType, os, appVersion, ip: req.ip },
  });
  return ok(res, {
    userId: result.user.id,
    publicId: result.user.publicId,
    status: result.user.status,
    role: result.user.primaryRoleKey,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    suspiciousActivity: result.suspicious,
  });
});

export const loginWithPassword = asyncHandler(async (req: Request, res: Response) => {
  const { mobile, password, deviceId, deviceType, os, appVersion } = req.body;
  const result = await authService.loginWithPassword({
    mobile,
    password,
    device: { deviceId, deviceType, os, appVersion, ip: req.ip },
  });
  return ok(res, {
    userId: result.user.id,
    publicId: result.user.publicId,
    role: result.user.primaryRoleKey,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    suspiciousActivity: result.suspicious,
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const result = await authService.refreshTokens(refreshToken);
  return ok(res, result);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(req.actor!.userId, req.body.deviceId);
  return ok(res, { loggedOut: true });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.actor!.userId },
    select: { id: true, publicId: true, mobile: true, email: true, firstName: true, lastName: true, primaryRoleKey: true, status: true, photoUrl: true },
  });
  return ok(res, user);
});

export const myModules = asyncHandler(async (req: Request, res: Response) => {
  const effective = await loadEffectivePermissions(req.actor!.userId);
  return ok(res, {
    modules: listAssignedModules(effective),
    organizationIds: effective.organizationIds,
    isSuperAdmin: effective.isSuperAdmin,
    // module -> allowed actions map so clients can gate UI (canDo) without extra calls
    permissions: effective.permissions,
    organizationOverrides: effective.organizationOverrides,
  });
});

export const createAdminAccount = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminAccountsService.createAdminAccount({ ...req.body, createdById: req.actor!.userId });
  await recordAudit({
    ...auditContextFromRequest(req),
    module: 'SETTINGS',
    action: 'CREATE',
    entityType: 'AdminAccount',
    entityId: result.user.id,
    after: { mobile: result.user.mobile, role: result.user.primaryRoleKey },
    isCritical: true,
  });
  return created(res, { userId: result.user.id, mobile: result.user.mobile, role: result.user.primaryRoleKey, tempPassword: result.tempPassword });
});

export const assignAdminOrganizations = asyncHandler(async (req: Request, res: Response) => {
  const rows = await adminAccountsService.assignAdminToOrganizations(req.params.userId as string, req.body.organizationIds, req.actor!.userId);
  return ok(res, rows);
});

export const listAdmins = asyncHandler(async (req: Request, res: Response) => {
  const admins = await prisma.user.findMany({
    where: {
      primaryRoleKey: {
        in: ['SUPER_ADMIN', 'TEMPLE_ADMIN', 'DHARAMSHALA_ADMIN', 'JAIN_CENTER_ADMIN', 'MONK_ADMIN'],
      },
      deletedAt: null,
    },
    select: {
      id: true,
      publicId: true,
      mobile: true,
      email: true,
      firstName: true,
      lastName: true,
      primaryRoleKey: true,
      status: true,
      createdAt: true,
      userOrganizations: {
        select: {
          id: true,
          organizationId: true,
          roleKey: true,
          organization: {
            select: {
              id: true,
              name: true,
              type: true,
              city: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return ok(res, admins);
});

export const deleteAdminAccount = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  if (userId === req.actor!.userId) {
    throw Object.assign(new Error('You cannot delete your own admin account'), { statusCode: 403 });
  }
  const deletedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      status: 'DELETED',
      deletedAt: new Date(),
      deletedById: req.actor!.userId,
    },
  });
  await recordAudit({
    ...auditContextFromRequest(req),
    module: 'SETTINGS',
    action: 'DELETE',
    entityType: 'AdminAccount',
    entityId: userId,
    before: { mobile: deletedUser.mobile, role: deletedUser.primaryRoleKey },
    isCritical: true,
  });
  return ok(res, { success: true });
});
