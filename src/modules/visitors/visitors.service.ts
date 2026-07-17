import { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { nextPublicId } from '@/engines/idGenerator/id.service';
import { verifySignedToken } from '@/engines/qr/qr.service';
import { enqueueNotification } from '@/engines/notification/notification.service';
import { getIO } from '@/sockets';
import { broadcastDashboardUpdate } from '@/modules/dashboard/dashboard.service';

/**
 * Visitor Management (§5.11) — universal across Temples/Dharamshalas/JCs/Halls/
 * Trust Offices via the polymorphic Organization FK. Guard APIs return only
 * name/photo/ID for members (never confidential data); offline-first sync via
 * idempotency keys; vehicle entries prevent duplicate active entries.
 */

function emitVisitorEvent(organizationId: string, event: string, payload: unknown) {
  try {
    getIO().of('/visitors').to(`org:${organizationId}`).emit(event, payload);
  } catch {
    // no socket server in this process
  }
}

/** Guard-safe member lookup: name/photo/ID ONLY (§5.11). */
export async function guardMemberLookup(memberPublicIdOrQr: string) {
  let publicId = memberPublicIdOrQr;

  // Accept a member QR token as well as a raw JFJM/JFNJM ID
  if (memberPublicIdOrQr.includes('.')) {
    const payload = verifySignedToken<{ purpose: 'MEMBER_ID'; id: string }>(memberPublicIdOrQr);
    if (!payload || payload.purpose !== 'MEMBER_ID') throw ApiError.validation({ qr: ['Invalid member QR'] });
    publicId = payload.id;
  }

  const member = await prisma.member.findUnique({
    where: { publicId },
    select: { id: true, publicId: true, fullName: true, photoUrl: true },
  });
  if (!member) throw ApiError.notFound('No member found for this ID');
  return member;
}

interface CheckInInput {
  organizationId: string;
  entryType: 'MEMBER' | 'NON_MEMBER' | 'VEHICLE';
  memberPublicId?: string;
  visitorName?: string;
  visitorMobile?: string;
  visitorAddress?: string;
  visitorArea?: string;
  visitorCity?: string;
  visitorState?: string;
  visitorPincode?: string;
  numberOfVisitors?: number;
  vehicleNumber?: string;
  vehicleType?: string;
  visitType?: string;
  visitorCategory?: string;
  purpose?: string;
  photoUrl?: string;
  idempotencyKey: string;
  checkInAt?: Date; // provided by offline sync
  checkedInByStaffId?: string;
  deviceId?: string;
  offlineTempId?: string;
  passengerMemberIds?: string;
}

export async function checkIn(input: CheckInInput) {
  // Offline-first idempotency (§5.11): replaying a synced entry returns the original
  const existing = await prisma.visitorEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return { entry: existing, replayed: true };

  let memberId: string | undefined;
  if (input.entryType === 'MEMBER') {
    if (!input.memberPublicId) throw ApiError.validation({ memberPublicId: ['Required for member check-in'] });
    const member = await guardMemberLookup(input.memberPublicId);
    memberId = member.id;

    // Check duplicate active member entry
    const activeMember = await prisma.visitorEntry.findFirst({
      where: { organizationId: input.organizationId, memberId, checkOutAt: null },
    });
    if (activeMember) {
      throw ApiError.conflict(`Member is already inside the premises. Please complete Check-Out before creating a new Check-In.`);
    }
  }

  // Duplicate-active-entry prevention: one active entry per vehicle per location (§5.11, §6)
  if (input.vehicleNumber && !['walk-in', 'no vehicle', 'none', ''].includes(input.vehicleNumber.toLowerCase().trim())) {
    const activeVehicle = await prisma.visitorEntry.findFirst({
      where: { organizationId: input.organizationId, vehicleNumber: input.vehicleNumber, checkOutAt: null },
    });
    if (activeVehicle) {
      throw ApiError.conflict(`This vehicle is already inside the premises. Please complete Check-Out before creating a new Check-In.`);
    }
  }

  const entry = await prisma.$transaction(async (tx) => {
    const publicId = await nextPublicId('VISITOR_ENTRY', tx);
    return tx.visitorEntry.create({
      data: {
        publicId,
        organizationId: input.organizationId,
        entryType: input.entryType,
        memberId,
        visitorName: input.visitorName,
        visitorMobile: input.visitorMobile,
        visitorAddress: input.visitorAddress,
        visitorArea: input.visitorArea,
        visitorCity: input.visitorCity,
        visitorState: input.visitorState,
        visitorPincode: input.visitorPincode,
        numberOfVisitors: input.numberOfVisitors ?? 1,
        vehicleNumber: input.vehicleNumber,
        vehicleType: input.vehicleType,
        visitType: input.visitType,
        visitorCategory: input.visitorCategory,
        purpose: input.purpose,
        photoUrl: input.photoUrl,
        checkInAt: input.checkInAt ?? new Date(),
        checkedInById: input.checkedInByStaffId,
        idempotencyKey: input.idempotencyKey,
        syncStatus: 'SYNCED',
        deviceId: input.deviceId,
        offlineTempId: input.offlineTempId,
        passengerMemberIds: input.passengerMemberIds,
      },
    });
  });

  emitVisitorEvent(input.organizationId, 'visitor:check-in', entry);
  broadcastDashboardUpdate(input.organizationId);

  // Member notification on their own check-in (§4.3)
  if (memberId) {
    const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId }, select: { userId: true } });
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: input.organizationId }, select: { name: true } });
    await enqueueNotification({
      userId: member.userId,
      templateKey: 'VISITOR_CHECK_IN',
      category: 'SERVICE',
      to: { PUSH: member.userId, IN_APP: member.userId },
      body: `You checked in at ${org.name}.`,
    });
  }

  return { entry, replayed: false };
}

export async function checkOut(entryPublicIdOrId: string) {
  const entry = await prisma.visitorEntry.findFirst({
    where: { OR: [{ id: entryPublicIdOrId }, { publicId: entryPublicIdOrId }] },
    include: { member: { select: { userId: true } }, organization: { select: { name: true } } },
  });
  if (!entry) throw ApiError.notFound('Entry not found');
  if (entry.checkOutAt) throw ApiError.conflict('Entry already checked out');

  const checkOutAt = new Date();
  const visitDuration = Math.round((checkOutAt.getTime() - entry.checkInAt.getTime()) / 60000);

  const updated = await prisma.visitorEntry.update({
    where: { id: entry.id },
    data: { checkOutAt, visitDuration },
  });
  emitVisitorEvent(entry.organizationId, 'visitor:check-out', updated);
  broadcastDashboardUpdate(entry.organizationId);

  if (entry.member) {
    await enqueueNotification({
      userId: entry.member.userId,
      templateKey: 'VISITOR_CHECK_OUT',
      category: 'SERVICE',
      to: { PUSH: entry.member.userId, IN_APP: entry.member.userId },
      body: `You checked out of ${entry.organization.name}.`,
    });
  }

  return updated;
}

/** Batch offline sync: applies entries in order, idempotently (§5.11). */
export async function syncOfflineEntries(entries: CheckInInput[], checkedInByStaffId?: string) {
  const results: { idempotencyKey: string; success: boolean; publicId?: string; replayed?: boolean; error?: string }[] = [];
  for (const raw of entries) {
    try {
      const { entry, replayed } = await checkIn({ ...raw, checkedInByStaffId });
      results.push({ idempotencyKey: raw.idempotencyKey, success: true, publicId: entry.publicId, replayed });
    } catch (err) {
      results.push({ idempotencyKey: raw.idempotencyKey, success: false, error: (err as Error).message });
    }
  }
  return results;
}

export async function liveVisitors(organizationId: string) {
  return prisma.visitorEntry.findMany({
    where: { organizationId, checkOutAt: null },
    include: { member: { select: { publicId: true, fullName: true, photoUrl: true } } },
    orderBy: { checkInAt: 'desc' },
  });
}

interface SearchQuery {
  memberPublicId?: string;
  vehicleNumber?: string;
  entryPublicId?: string;
  visitorCategory?: string;
  visitType?: string;
  vehicleType?: string;
  visitStatus?: string; // Currently Inside | Checked Out
  memberVerification?: string; // Verified JiNANAM Member | Manual Visitor
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

export async function searchEntries(organizationId: string, query: SearchQuery) {
  const where: Prisma.VisitorEntryWhereInput = {
    organizationId,
    publicId: query.entryPublicId ? { contains: query.entryPublicId, mode: 'insensitive' } : undefined,
    vehicleNumber: query.vehicleNumber ? { contains: query.vehicleNumber, mode: 'insensitive' } : undefined,
    visitorCategory: query.visitorCategory || undefined,
    visitType: query.visitType || undefined,
    vehicleType: query.vehicleType || undefined,
  };

  if (query.memberPublicId) {
    where.member = { publicId: { contains: query.memberPublicId, mode: 'insensitive' } };
  }

  if (query.visitStatus === 'Currently Inside' || query.visitStatus === 'Inside') {
    where.checkOutAt = null;
  } else if (query.visitStatus === 'Checked Out') {
    where.checkOutAt = { not: null };
  }

  if (query.memberVerification === 'Verified JiNANAM Member' || query.memberVerification === 'Verified') {
    where.memberId = { not: null };
  } else if (query.memberVerification === 'Manual Visitor' || query.memberVerification === 'Manual') {
    where.memberId = null;
  }

  if (query.from || query.to) {
    where.checkInAt = {
      gte: query.from || undefined,
      lte: query.to || undefined,
    };
  }

  const [total, rows] = await Promise.all([
    prisma.visitorEntry.count({ where }),
    prisma.visitorEntry.findMany({
      where,
      include: { member: { select: { publicId: true, fullName: true, photoUrl: true } } },
      orderBy: { checkInAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { total, rows };
}

/** Member-visible visit history: duration + vehicle (§5.11). */
export async function memberVisitHistory(memberId: string) {
  const entries = await prisma.visitorEntry.findMany({
    where: { memberId },
    include: { organization: { select: { name: true, publicId: true } } },
    orderBy: { checkInAt: 'desc' },
    take: 100,
  });
  return entries.map((e) => ({
    entryId: e.publicId,
    organization: e.organization,
    checkInAt: e.checkInAt,
    checkOutAt: e.checkOutAt,
    durationMinutes: e.visitDuration ?? (e.checkOutAt ? Math.round((e.checkOutAt.getTime() - e.checkInAt.getTime()) / 60000) : null),
    vehicleNumber: e.vehicleNumber,
  }));
}

/** Peak-hour / repeat-visitor / duration analytics (§5.11). */
export async function visitorAnalytics(organizationId: string, from: Date, to: Date) {
  const entries = await prisma.visitorEntry.findMany({
    where: { organizationId, checkInAt: { gte: from, lte: to } },
    select: { checkInAt: true, checkOutAt: true, memberId: true, entryType: true, numberOfVisitors: true, vehicleNumber: true },
  });

  const live = await prisma.visitorEntry.findMany({
    where: { organizationId, checkOutAt: null },
  });

  const visitorsCurrentlyInside = live.reduce((acc, curr) => acc + (curr.numberOfVisitors || 1), 0);
  const vehiclesCurrentlyInside = live.filter(v => v.vehicleNumber && !['walk-in', 'no vehicle', 'none', ''].includes(v.vehicleNumber.toLowerCase().trim())).length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todaysCheckIns = entries.filter(e => e.checkInAt >= todayStart).length;
  const todaysCheckOuts = entries.filter(e => e.checkOutAt && e.checkOutAt >= todayStart).length;

  const hourBuckets = new Array(24).fill(0) as number[];
  const memberVisits = new Map<string, number>();
  let totalDuration = 0;
  let durationsCounted = 0;

  for (const e of entries) {
    const hour = e.checkInAt.getHours();
    hourBuckets[hour] = (hourBuckets[hour] ?? 0) + 1;
    if (e.memberId) memberVisits.set(e.memberId, (memberVisits.get(e.memberId) ?? 0) + 1);
    if (e.checkOutAt) {
      totalDuration += (e.checkOutAt.getTime() - e.checkInAt.getTime()) / 60000;
      durationsCounted += 1;
    }
  }

  let maxCount = 0;
  let peakHour = 0;
  for (let i = 0; i < 24; i++) {
    if (hourBuckets[i]! > maxCount) {
      maxCount = hourBuckets[i]!;
      peakHour = i;
    }
  }

  return {
    totalEntries: entries.length,
    visitorsCurrentlyInside,
    vehiclesCurrentlyInside,
    todaysCheckIns,
    todaysCheckOuts,
    byType: {
      member: entries.filter((e) => e.entryType === 'MEMBER').length,
      nonMember: entries.filter((e) => e.entryType === 'NON_MEMBER').length,
      vehicle: entries.filter((e) => e.entryType === 'VEHICLE').length,
    },
    peakVisitingHour: maxCount > 0 ? `${peakHour}:00` : '—',
    repeatVisitors: Array.from(memberVisits.values()).filter((v) => v > 1).length,
    avgDurationMinutes: durationsCounted > 0 ? Math.round(totalDuration / durationsCounted) : null,
  };
}
