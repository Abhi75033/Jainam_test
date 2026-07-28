import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Prisma, PermissionAction, RoleKey } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { enqueueNotification } from '@/engines/notification/notification.service';
import { MODULES } from '@/config/constants';

const ADMIN_ROLES: RoleKey[] = ['TEMPLE_ADMIN', 'DHARAMSHALA_ADMIN', 'JAIN_CENTER_ADMIN', 'MONK_ADMIN'];

// DELETE stays Super-Admin-only everywhere regardless of stored permissions
// (see assertNotDeleteUnlessSuperAdmin) — no point granting it to an Admin.
const GRANTABLE_ACTIONS: PermissionAction[] = ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'REJECT'];

/**
 * §5.1: "Admin/staff accounts are NEVER self-registered — created only by Super
 * Admin (admins) ... credentials delivered via notification."
 * §3: "Super Admin dynamically allocates modules/features to every admin ...
 * Create/Delete Admin: Yes (Super Admin) / No (Temple Admin — edit own only)."
 */
export async function createAdminAccount(input: {
  mobile: string;
  firstName: string;
  lastName?: string;
  role: RoleKey;
  organizationIds: string[];
  createdById: string;
}) {
  if (!ADMIN_ROLES.includes(input.role)) throw ApiError.validation({ role: ['Must be one of ' + ADMIN_ROLES.join(', ')] });

  const existing = await prisma.user.findUnique({ where: { mobile: input.mobile } });
  if (existing) throw ApiError.conflict('This mobile number is already registered');

  const tempPassword = crypto.randomBytes(6).toString('hex');
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        mobile: input.mobile,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash,
        primaryRoleKey: input.role,
        status: 'ACTIVE',
        createdByAdmin: true,
        createdById: input.createdById,
      },
    });

    for (const organizationId of input.organizationIds) {
      await tx.userOrganization.create({
        data: { userId: created.id, organizationId, roleKey: input.role, assignedById: input.createdById },
      });
    }

    return created;
  });

  await enqueueNotification({
    userId: user.id,
    templateKey: 'ADMIN_ACCOUNT_CREATED',
    category: 'SERVICE',
    to: { WHATSAPP: input.mobile, SMS: input.mobile },
    body: `Your JiNANAM ${input.role.replace('_', ' ')} account has been created. Mobile: ${input.mobile}, temporary password: ${tempPassword}. Please log in and change it immediately.`,
  });

  return { user, tempPassword: process.env.NODE_ENV === 'production' ? undefined : tempPassword };
}

/** Temple/Dharamshala/JC admins may edit their own account only — never create/delete other admins (§3). */
export async function updateOwnAdminProfile(userId: string, input: { firstName?: string; lastName?: string; photoUrl?: string }) {
  return prisma.user.update({ where: { id: userId }, data: input });
}

/**
 * §4.1: Super Admin dynamically restricts which sidebar tabs/modules a
 * specific Admin can see and use. Implemented as a full-replace over the
 * existing UserPermissionOverride model (global scope, organizationId=null)
 * — every module gets an explicit allow/deny row so this Admin's access no
 * longer silently inherits the shared role-wide default matrix, letting two
 * Admins with the same RoleKey have different tab sets.
 */
export async function setAdminModuleGrants(targetUserId: string, grantedModules: string[], actingSuperAdminId: string) {
  const target = await prisma.user.findUniqueOrThrow({ where: { id: targetUserId } });
  if (!ADMIN_ROLES.includes(target.primaryRoleKey)) {
    throw ApiError.validation({ userId: ['Target user is not an admin account'] });
  }

  const grantedSet = new Set(grantedModules);
  const allModuleKeys = Object.values(MODULES);

  await prisma.$transaction(async (tx) => {
    await tx.userPermissionOverride.deleteMany({ where: { userId: targetUserId, organizationId: null } });

    const rows: Prisma.UserPermissionOverrideCreateManyInput[] = [];
    for (const module of allModuleKeys) {
      const allowed = grantedSet.has(module);
      for (const action of GRANTABLE_ACTIONS) {
        rows.push({ userId: targetUserId, organizationId: null, module, action, allowed, createdById: actingSuperAdminId });
      }
    }
    await tx.userPermissionOverride.createMany({ data: rows });
  });

  return prisma.userPermissionOverride.findMany({ where: { userId: targetUserId, organizationId: null } });
}

/**
 * §A8/A9: Super Admin can deactivate/reactivate an Admin without deleting the
 * account. INACTIVE blocks both future logins (auth.service login checks) and
 * every already-authenticated request (loadEffectivePermissions), so toggling
 * this instantly revokes whatever tab/module access that Admin currently holds.
 */
export async function setAdminActiveStatus(targetUserId: string, active: boolean, actingSuperAdminId: string) {
  const target = await prisma.user.findUniqueOrThrow({ where: { id: targetUserId } });
  if (!ADMIN_ROLES.includes(target.primaryRoleKey)) {
    throw ApiError.validation({ userId: ['Target user is not an admin account'] });
  }
  if (targetUserId === actingSuperAdminId) {
    throw ApiError.forbidden('You cannot deactivate your own admin account');
  }
  if (['DELETED', 'SUSPENDED', 'BLOCKED'].includes(target.status)) {
    throw ApiError.validation({ status: ['This account is deleted/suspended/blocked and cannot be toggled here'] });
  }

  return prisma.user.update({
    where: { id: targetUserId },
    data: { status: active ? 'ACTIVE' : 'INACTIVE' },
  });
}

export async function assignAdminToOrganizations(userId: string, organizationIds: string[], assignedById: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!ADMIN_ROLES.includes(user.primaryRoleKey)) throw ApiError.validation({ userId: ['Target user is not an admin account'] });

  for (const organizationId of organizationIds) {
    await prisma.userOrganization.upsert({
      where: { userId_organizationId: { userId, organizationId } },
      update: {},
      create: { userId, organizationId, roleKey: user.primaryRoleKey, assignedById },
    });
  }
  return prisma.userOrganization.findMany({ where: { userId } });
}
