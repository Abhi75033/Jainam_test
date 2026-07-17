import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { enqueueNotification } from '@/engines/notification/notification.service';

/**
 * Spiritual Counting / Digital Mala (§5.18). Delta-based updates so rapid
 * clicking is idempotent-friendly: the client accumulates taps locally and
 * sends deltas; the server applies them atomically and clamps at zero.
 * Milestone notifications fire at each 1000-count boundary crossed.
 */

const MILESTONE_STEP = 1000n;

export async function applyDelta(memberId: string, counterTypeId: string, subTypeId: string | null, delta: number) {
  if (!Number.isInteger(delta) || delta === 0) throw ApiError.validation({ delta: ['Delta must be a non-zero integer'] });

  return prisma.$transaction(async (tx) => {
    const existing = await tx.memberCounter.findFirst({ where: { memberId, counterTypeId, subTypeId } });

    const before = existing?.count ?? 0n;
    let after = before + BigInt(delta);
    if (after < 0n) after = 0n; // never below zero (§5.18)

    const counter = existing
      ? await tx.memberCounter.update({ where: { id: existing.id }, data: { count: after } })
      : await tx.memberCounter.create({ data: { memberId, counterTypeId, subTypeId, count: after } });

    // Milestone crossing (e.g. 1000, 2000, ...)
    if (after / MILESTONE_STEP > before / MILESTONE_STEP) {
      const member = await tx.member.findUniqueOrThrow({ where: { id: memberId }, select: { userId: true } });
      const milestone = (after / MILESTONE_STEP) * MILESTONE_STEP;
      await enqueueNotification({
        userId: member.userId,
        templateKey: 'COUNTER_MILESTONE',
        category: 'SERVICE',
        to: { PUSH: member.userId, IN_APP: member.userId },
        body: `Anumodana! You crossed ${milestone.toString()} counts.`,
      });
    }

    return counter;
  });
}

export async function resetCounter(memberId: string, counterId: string) {
  const counter = await prisma.memberCounter.findUnique({ where: { id: counterId } });
  if (!counter || counter.memberId !== memberId) throw ApiError.notFound('Counter not found');

  await prisma.counterResetLog.create({ data: { memberCounterId: counterId, previousCount: counter.count } });
  return prisma.memberCounter.update({ where: { id: counterId }, data: { count: 0n } });
}

export async function resetAllCounters(memberId: string) {
  const counters = await prisma.memberCounter.findMany({ where: { memberId } });
  for (const counter of counters) {
    await prisma.counterResetLog.create({ data: { memberCounterId: counter.id, previousCount: counter.count } });
  }
  await prisma.memberCounter.updateMany({ where: { memberId }, data: { count: 0n } });
  return { reset: counters.length };
}

export async function myCounters(memberId: string) {
  return prisma.memberCounter.findMany({
    where: { memberId },
    include: { counterType: true, subType: true },
  });
}

/** Temple admin: counts of PRIMARY-linked members only (§5.18). */
export async function orgMemberCounters(organizationId: string, from?: Date, to?: Date) {
  const primaryLinks = await prisma.memberPreferredTemple.findMany({ where: { organizationId, isFavourite: true }, select: { memberId: true } });
  const memberIds = primaryLinks.map((l) => l.memberId);

  const counters = await prisma.memberCounter.findMany({
    where: { memberId: { in: memberIds }, ...(from || to ? { updatedAt: { gte: from, lte: to } } : {}) },
    include: { member: { select: { publicId: true, fullName: true } }, counterType: true, subType: true },
  });

  return counters.map((c) => ({
    member: c.member,
    counterType: c.counterType.name,
    subType: c.subType?.name ?? null,
    total: c.count.toString(),
  }));
}

/** Leaderboards per counter + overall (§5.18). */
export async function leaderboard(filters: { counterTypeId?: string; scope?: 'top' | 'today'; limit?: number }) {
  const limit = filters.limit ?? 20;

  const where: any = {};
  if (filters.counterTypeId) {
    where.counterTypeId = filters.counterTypeId;
  }

  if (filters.scope === 'today') {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    where.updatedAt = { gte: startOfToday };
  }

  const counters = await prisma.memberCounter.findMany({
    where,
    include: { member: { select: { publicId: true, fullName: true, photoUrl: true } }, counterType: true },
    orderBy: { count: 'desc' },
    take: limit,
  });

  return counters.map((c, i) => ({
    rank: i + 1,
    member: c.member,
    counterType: c.counterType.name,
    count: c.count.toString(),
  }));
}


/** Admin overview statistics for spiritual counting dashboard. */
export async function adminOverview() {
  const counterTypes = await prisma.counterType.findMany({
    where: { deletedAt: null },
    include: {
      memberCounters: {
        select: {
          count: true,
          memberId: true,
          updatedAt: true,
        },
      },
    },
  });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return counterTypes.map((ct) => {
    let countSum = 0n;
    const uniqueMembers = new Set<string>();
    let todaySum = 0n;

    for (const mc of ct.memberCounters) {
      countSum += mc.count;
      uniqueMembers.add(mc.memberId);
      if (mc.updatedAt >= startOfToday) {
        todaySum += mc.count;
      }
    }

    return {
      id: ct.id,
      name: ct.name,
      count: Number(countSum),
      memberCount: uniqueMembers.size,
      todayCount: Number(todaySum),
    };
  });
}

/** Create a new counter type. */
export async function createCounterType(name: string) {
  const existing = await prisma.counterType.findFirst({
    where: { name, deletedAt: null },
  });
  if (existing) throw ApiError.conflict('Counter type with this name already exists.');

  return prisma.counterType.create({
    data: { name },
  });
}

/** Delete a counter type. */
export async function deleteCounterType(id: string) {
  const existing = await prisma.counterType.findUnique({
    where: { id },
  });
  if (!existing || existing.deletedAt) throw ApiError.notFound('Counter type not found.');

  return prisma.counterType.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

/** Reset all member counts for a specific counter type. */
export async function resetCounterType(counterTypeId: string) {
  const existing = await prisma.counterType.findUnique({
    where: { id: counterTypeId },
  });
  if (!existing || existing.deletedAt) throw ApiError.notFound('Counter type not found.');

  const counters = await prisma.memberCounter.findMany({
    where: { counterTypeId },
  });

  for (const counter of counters) {
    await prisma.counterResetLog.create({
      data: { memberCounterId: counter.id, previousCount: counter.count },
    });
  }

  await prisma.memberCounter.updateMany({
    where: { counterTypeId },
    data: { count: 0n },
  });

  return { resetCount: counters.length };
}


