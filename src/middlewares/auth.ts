import { NextFunction, Request, Response } from 'express';
import { PermissionAction } from '@prisma/client';
import { ApiError } from '@/utils/ApiError';
import { verifyAccessToken } from '@/engines/rbac/jwt.service';
import { loadEffectivePermissions, isActionAllowed } from '@/engines/rbac/permission.service';

/**
 * requireAuth -> requirePermission(module, action) -> scopeToOrganization
 * as mandated by §3: "APIs must validate role AND organization scope on every request."
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized('Missing bearer token');
    const token = header.slice('Bearer '.length);

    const payload = verifyAccessToken(token);
    const effective = await loadEffectivePermissions(payload.sub);

    req.actor = {
      userId: payload.sub,
      publicId: payload.publicId ?? '',
      role: effective.role,
      organizationIds: effective.organizationIds,
      isSuperAdmin: effective.isSuperAdmin,
      permissions: effective.permissions,
      deviceId: payload.deviceId,
    };
    (req as any).effectivePermissions = effective;
    next();
  } catch {
    next(ApiError.unauthorized('Invalid or expired token'));
  }
}

/**
 * Checks the caller has `action` on `module`. DELETE is hard-blocked for
 * everyone except Super Admin regardless of stored permission rows (§3).
 */
export function requirePermission(module: string, action: PermissionAction) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const effective = (req as any).effectivePermissions;
    if (!effective) return next(ApiError.unauthorized());

    if (action === 'DELETE' && !effective.isSuperAdmin) {
      return next(ApiError.forbidden('DELETE is restricted to Super Admin'));
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    if (!isActionAllowed(effective, module, action, organizationId)) {
      return next(ApiError.forbidden(`Missing permission ${module}:${action}`));
    }
    next();
  };
}

/** Enforces tenant isolation: org admins can only touch their assigned organization(s). */
export function scopeToOrganization(req: Request, _res: Response, next: NextFunction) {
  const actor = req.actor;
  if (!actor) return next(ApiError.unauthorized());
  if (actor.isSuperAdmin) return next();

  const organizationId = resolveOrganizationIdFromRequest(req);
  if (!organizationId) return next(ApiError.tenantScope('Organization context is required'));
  if (!actor.organizationIds.includes(organizationId)) {
    return next(ApiError.tenantScope());
  }
  next();
}

function resolveOrganizationIdFromRequest(req: Request): string | undefined {
  return (
    (req.params.organizationId as string | undefined) ??
    (req.body?.organizationId as string | undefined) ??
    (req.query.organizationId as string | undefined)
  );
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.actor) return next(ApiError.unauthorized());
    if (req.actor.isSuperAdmin || roles.includes(req.actor.role)) return next();
    next(ApiError.forbidden());
  };
}
