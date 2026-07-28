import { PermissionAction, RoleKey } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';

export type PermissionMap = Record<string, PermissionAction[]>;

export interface EffectivePermissions {
  role: RoleKey;
  isSuperAdmin: boolean;
  organizationIds: string[];
  permissions: PermissionMap; // module -> allowed actions, global (role defaults)
  organizationOverrides: Record<string, PermissionMap>; // organizationId -> module -> actions
}

/**
 * Configurable Permission Engine (§3).
 *
 * Effective permission for (user, organization, module, action) =
 *   role default (RolePermission)
 *   overridden by any UserPermissionOverride scoped to that organization
 *   overridden by any UserPermissionOverride with organizationId = null (global override for that user)
 *
 * Super Admin bypasses all checks (module/action always allowed, and is not
 * scoped to any single organization — full cross-tenant access).
 */
export async function loadEffectivePermissions(userId: string): Promise<EffectivePermissions> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  // Deactivating an account (e.g. Super Admin toggling an Admin to INACTIVE)
  // must revoke access on the very next request, not just block future logins
  // — otherwise an already-issued access token keeps working until it expires.
  if (['INACTIVE', 'SUSPENDED', 'BLOCKED', 'DELETED'].includes(user.status)) {
    throw ApiError.forbidden(`Account is ${user.status.toLowerCase()}. Contact support.`);
  }

  const isSuperAdmin = user.primaryRoleKey === 'SUPER_ADMIN';

  const [rolePerms, overrides, userOrgs, staff] = await Promise.all([
    prisma.rolePermission.findMany({
      where: { role: { key: user.primaryRoleKey }, allowed: true },
    }),
    prisma.userPermissionOverride.findMany({ where: { userId } }),
    prisma.userOrganization.findMany({ where: { userId } }),
    prisma.staff.findUnique({ where: { userId }, include: { permissions: true } }),
  ]);

  const permissions: PermissionMap = {};

  // Cascading tab-access: once an Admin/Staff has explicitly assigned this
  // staff member module grants (via PATCH /staff/:staffId/permissions or at
  // creation), those per-staff grants become authoritative and REPLACE the
  // shared 'STAFF'-role defaults entirely — this is what lets an Admin give
  // different staff members access to different tabs. Staff with no explicit
  // grants configured yet keep falling back to the role defaults below so
  // existing accounts aren't silently locked out the moment this ships.
  if (staff && staff.permissions.length > 0) {
    for (const p of staff.permissions) {
      permissions[p.module] = (p.actions as unknown as PermissionAction[]) ?? [];
    }
  } else {
    for (const rp of rolePerms) {
      const list = permissions[rp.module] ?? [];
      if (!list.includes(rp.action)) list.push(rp.action);
      permissions[rp.module] = list;
    }
  }

  const organizationOverrides: Record<string, PermissionMap> = {};
  for (const ov of overrides) {
    const bucket = ov.organizationId ?? '__global__';
    const bucketMap: PermissionMap = organizationOverrides[bucket] ?? {};
    const list = bucketMap[ov.module] ?? [];
    const has = list.includes(ov.action);
    const updatedList = ov.allowed && !has ? [...list, ov.action] : !ov.allowed && has ? list.filter((a) => a !== ov.action) : list;
    bucketMap[ov.module] = updatedList;
    organizationOverrides[bucket] = bucketMap;
  }

  return {
    role: user.primaryRoleKey,
    isSuperAdmin,
    organizationIds: userOrgs.map((o) => o.organizationId),
    permissions,
    organizationOverrides,
  };
}

export function isActionAllowed(
  effective: EffectivePermissions,
  module: string,
  action: PermissionAction,
  organizationId?: string,
): boolean {
  if (effective.isSuperAdmin) return true;

  const globalOverride = effective.organizationOverrides.__global__?.[module];
  if (globalOverride) return globalOverride.includes(action);

  if (organizationId) {
    const orgOverride = effective.organizationOverrides[organizationId]?.[module];
    if (orgOverride) return orgOverride.includes(action);
  }

  return effective.permissions[module]?.includes(action) ?? false;
}

/** DELETE is Super Admin only, everywhere (§3) — enforced independent of stored permission rows. */
export function assertNotDeleteUnlessSuperAdmin(effective: EffectivePermissions, action: PermissionAction) {
  if (action === 'DELETE' && !effective.isSuperAdmin) {
    return false;
  }
  return true;
}

/** Returns the module keys a user currently has any permission on — powers GET /me/modules. */
export function listAssignedModules(effective: EffectivePermissions): string[] {
  if (effective.isSuperAdmin) return ['*'];
  const modules = new Set<string>(Object.keys(effective.permissions));
  for (const bucket of Object.values(effective.organizationOverrides)) {
    for (const [module, actions] of Object.entries(bucket)) {
      if (actions.length > 0) modules.add(module);
    }
  }
  return Array.from(modules);
}

/**
 * Cascading tab-access enforcement (§4.1/4.2): an Admin or Staff member may
 * only grant another user (a Staff account they create, or a sub-staff a
 * Staff account creates) access to a module/action they themselves currently
 * hold. Super Admin is unrestricted. Throws ApiError.forbidden listing the
 * first violation if the actor tries to grant something outside their own
 * effective permissions.
 */
export function assertGrantWithinActorPermissions(
  actorEffective: EffectivePermissions,
  requestedGrants: { module: string; actions: string[] }[],
  organizationId?: string,
): void {
  if (actorEffective.isSuperAdmin) return;

  for (const { module, actions } of requestedGrants) {
    const disallowed = actions.filter(
      (action) => !isActionAllowed(actorEffective, module, action as PermissionAction, organizationId),
    );
    if (disallowed.length > 0) {
      throw ApiError.forbidden(
        `You cannot grant "${module}" action(s) [${disallowed.join(', ')}] — you do not have that access yourself`,
      );
    }
  }
}
