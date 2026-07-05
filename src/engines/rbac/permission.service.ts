import { PermissionAction, RoleKey } from '@prisma/client';
import { prisma } from '@/config/prisma';

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
  const isSuperAdmin = user.primaryRoleKey === 'SUPER_ADMIN';

  const [rolePerms, overrides, userOrgs] = await Promise.all([
    prisma.rolePermission.findMany({
      where: { role: { key: user.primaryRoleKey }, allowed: true },
    }),
    prisma.userPermissionOverride.findMany({ where: { userId } }),
    prisma.userOrganization.findMany({ where: { userId } }),
  ]);

  const permissions: PermissionMap = {};
  for (const rp of rolePerms) {
    const list = permissions[rp.module] ?? [];
    if (!list.includes(rp.action)) list.push(rp.action);
    permissions[rp.module] = list;
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
