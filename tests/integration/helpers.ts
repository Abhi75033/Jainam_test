import { PrismaClient, RoleKey, PermissionAction } from '@prisma/client';
import crypto from 'crypto';
import { signAccessToken } from '@/engines/rbac/jwt.service';
import { nextPublicId } from '@/engines/idGenerator/id.service';

/**
 * Shared fixtures for the DB-gated end-to-end flow tests (RUN_INTEGRATION=1).
 * Creates real rows via Prisma and signs real JWTs, so the tests exercise the
 * full middleware chain (requireAuth -> requirePermission -> scopeToOrganization).
 */

export const prismaTest = new PrismaClient();

export function uniqueMobile(): string {
  return `+91${(7000000000 + crypto.randomInt(0, 999999999)).toString().slice(0, 10)}`;
}

const ROLE_PERMS: Partial<Record<RoleKey, [string, PermissionAction[]][]>> = {
  TEMPLE_ADMIN: [
    ['BOOKINGS', ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'REJECT']],
    ['DONATIONS', ['VIEW', 'APPROVE', 'REJECT']],
    ['EVENTS', ['VIEW', 'CREATE', 'EDIT']],
    ['TOURS', ['VIEW', 'CREATE', 'EDIT']],
    ['VISITORS', ['VIEW', 'CREATE', 'EDIT']],
    ['MEMBERS', ['VIEW', 'CREATE']],
    ['GALLERY', ['VIEW', 'CREATE', 'EDIT']],
  ],
  MEMBER: [
    ['BOOKINGS', ['VIEW', 'CREATE']],
    ['DONATIONS', ['VIEW', 'CREATE']],
    ['EVENTS', ['VIEW']],
    ['TICKETS', ['VIEW', 'CREATE']],
  ],
  SECURITY_GUARD: [['VISITORS', ['VIEW', 'CREATE', 'EDIT']]],
  EVENT_SCANNER: [['TICKETS', ['VIEW', 'EDIT']]],
};

/** Ensures roles + permissions exist even if prisma/seed.ts hasn't run against the test DB. */
export async function ensureRoleSeeded(key: RoleKey) {
  const role = await prismaTest.role.upsert({
    where: { key },
    update: {},
    create: { key, name: key },
  });
  for (const [module, actions] of ROLE_PERMS[key] ?? []) {
    for (const action of actions) {
      await prismaTest.rolePermission.upsert({
        where: { roleId_module_action: { roleId: role.id, module, action } },
        update: { allowed: true },
        create: { roleId: role.id, module, action, allowed: true },
      });
    }
  }
}

export async function createOrgFixture(type: 'TEMPLE' | 'DHARAMSHALA' = 'TEMPLE') {
  const publicId = await prismaTest.$transaction((tx) => nextPublicId(type === 'TEMPLE' ? 'TEMPLE' : 'DHARAMSHALA', tx));
  return prismaTest.organization.create({
    data: { publicId, type, name: `Test ${type} ${publicId}`, status: 'ACTIVE', country: 'India' },
  });
}

export async function createActor(role: RoleKey, organizationIds: string[] = []) {
  await ensureRoleSeeded(role);
  const mobile = uniqueMobile();

  const memberPrefix = role === 'NON_JAIN_MEMBER' ? 'NON_JAIN_MEMBER' : 'JAIN_MEMBER';
  const publicId = await prismaTest.$transaction((tx) => nextPublicId(memberPrefix, tx));

  const user = await prismaTest.user.create({
    data: { mobile, publicId, primaryRoleKey: role, status: 'ACTIVE', mobileVerifiedAt: new Date() },
  });

  const member = await prismaTest.member.create({
    data: {
      userId: user.id,
      publicId,
      category: role === 'NON_JAIN_MEMBER' ? 'NON_JAIN' : 'JAIN',
      firstName: `Test-${role}`,
      fullName: `Test ${role} ${publicId}`,
      mobile,
      status: 'ACTIVE',
    },
  });

  for (const organizationId of organizationIds) {
    await prismaTest.userOrganization.create({ data: { userId: user.id, organizationId, roleKey: role } });
  }

  const token = signAccessToken({
    sub: user.id,
    publicId,
    role,
    isSuperAdmin: role === 'SUPER_ADMIN',
    deviceId: 'test-device',
  });

  return { user, member, token, mobile };
}

export async function createSuperAdmin() {
  await ensureRoleSeeded('SUPER_ADMIN');
  const mobile = uniqueMobile();
  const user = await prismaTest.user.create({
    data: { mobile, primaryRoleKey: 'SUPER_ADMIN', status: 'ACTIVE', mobileVerifiedAt: new Date() },
  });
  const token = signAccessToken({ sub: user.id, publicId: null, role: 'SUPER_ADMIN', isSuperAdmin: true, deviceId: 'test-device' });
  return { user, token };
}
