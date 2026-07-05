import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { RoleKey } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { enqueueNotification } from '@/engines/notification/notification.service';

const ADMIN_ROLES: RoleKey[] = ['TEMPLE_ADMIN', 'DHARAMSHALA_ADMIN', 'JAIN_CENTER_ADMIN', 'MONK_ADMIN'];

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
