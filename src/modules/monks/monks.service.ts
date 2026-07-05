import { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { nextPublicId } from '@/engines/idGenerator/id.service';

/**
 * Monk / MS profiles (§5.4). Shared-profile rule: editable by ALL temple
 * admins (collaborative), delete by Super Admin only, every edit audit-logged.
 * The audit call lives in the controller so it captures actor/IP context.
 */

export async function createMonk(input: Record<string, unknown> & { createdById: string }) {
  const { createdById, emergencyContact, ...rest } = input as any;
  return prisma.$transaction(async (tx) => {
    const publicId = await nextPublicId('MONK', tx);
    return tx.monkProfile.create({
      data: {
        publicId,
        ...rest,
        emergencyContact: emergencyContact as Prisma.InputJsonValue,
        createdById,
        updatedById: createdById,
      },
    });
  });
}

export async function updateMonk(monkId: string, input: Record<string, unknown>, updatedById: string) {
  const existing = await prisma.monkProfile.findUnique({ where: { id: monkId } });
  if (!existing || existing.deletedAt) throw ApiError.notFound('Monk profile not found');
  const { emergencyContact, ...rest } = input as any;
  return prisma.monkProfile.update({
    where: { id: monkId },
    data: { ...rest, emergencyContact: emergencyContact as Prisma.InputJsonValue, updatedById },
  });
}

export async function getMonk(monkId: string) {
  const monk = await prisma.monkProfile.findFirst({
    where: { OR: [{ id: monkId }, { publicId: monkId }], deletedAt: null },
    include: {
      dikshaGuru: { select: { id: true, publicId: true, dikshaName: true, photoUrl: true } },
      currentTemple: { select: { id: true, publicId: true, name: true, city: true } },
      group: { include: { members: { select: { id: true, publicId: true, dikshaName: true } } } },
      community: true,
      subCommunity: true,
      gaccha: true,
    },
  });
  if (!monk) throw ApiError.notFound('Monk profile not found');
  return monk;
}

export async function listMonks(filters: { templeId?: string; groupId?: string; gender?: 'SADHU' | 'SADHVI'; search?: string }) {
  return prisma.monkProfile.findMany({
    where: {
      deletedAt: null,
      currentTempleId: filters.templeId,
      groupId: filters.groupId,
      gender: filters.gender,
      dikshaName: filters.search ? { contains: filters.search, mode: 'insensitive' } : undefined,
    },
    orderBy: { dikshaName: 'asc' },
  });
}

export async function softDeleteMonk(monkId: string, deletedById: string) {
  return prisma.monkProfile.update({ where: { id: monkId }, data: { deletedAt: new Date(), deletedById } });
}

// --- Monk groups ---

export async function createMonkGroup(input: { name: string; leaderMonkId?: string; memberMonkIds?: string[] }) {
  const group = await prisma.monkGroup.create({ data: { name: input.name, leaderMonkId: input.leaderMonkId } });
  if (input.memberMonkIds?.length) {
    await prisma.monkProfile.updateMany({ where: { id: { in: input.memberMonkIds } }, data: { groupId: group.id } });
  }
  return prisma.monkGroup.findUnique({ where: { id: group.id }, include: { members: true } });
}

// --- Join Monk (follow) ---

export async function followMonk(monkId: string, memberId: string) {
  return prisma.monkFollow.upsert({
    where: { monkId_memberId: { monkId, memberId } },
    update: {},
    create: { monkId, memberId },
  });
}

export async function unfollowMonk(monkId: string, memberId: string) {
  await prisma.monkFollow.deleteMany({ where: { monkId, memberId } });
}
