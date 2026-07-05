import { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { nextPublicId } from '@/engines/idGenerator/id.service';
import { getQueue, QUEUE_NAMES } from '@/jobs/queues';
import { enqueueNotification } from '@/engines/notification/notification.service';
import { createSignedToken, renderQrBuffer } from '@/engines/qr/qr.service';
import { storage } from '@/utils/storage';
import PDFDocument from 'pdfkit';

/**
 * 99 Management — Yatra Tours (§5.19).
 * Jatra target locks once the first member is added; monk linking mandatory;
 * parents get read-only tour access + all notifications; milestone
 * notifications at 25/50/75/100%; digital certificate on hitting the target.
 */

// -----------------------------------------------------------------------------
// Tour creation & lifecycle
// -----------------------------------------------------------------------------

export async function createTour(input: {
  name: string;
  categoryId: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  description?: string;
  coverUrl?: string;
  jatraTarget: number;
  primaryMonkId: string;
  monkGroupId?: string;
  createdById: string;
}) {
  const monk = await prisma.monkProfile.findUnique({ where: { id: input.primaryMonkId } });
  if (!monk || monk.deletedAt) throw ApiError.validation({ primaryMonkId: ['Monk linking is mandatory — provide a valid JFMS monk'] });

  return prisma.$transaction(async (tx) => {
    const publicId = await nextPublicId('TOUR', tx);
    return tx.tour.create({ data: { publicId, ...input } });
  });
}

export async function updateTour(tourId: string, input: Record<string, unknown>, actor: { userId: string; isSuperAdmin: boolean }) {
  const tour = await prisma.tour.findUnique({ where: { id: tourId } });
  if (!tour || tour.deletedAt) throw ApiError.notFound('Tour not found');

  // Only Super Admin edits after completion (§5.19)
  if (['COMPLETED', 'ARCHIVED'].includes(tour.status) && !actor.isSuperAdmin) {
    throw ApiError.forbidden('Completed tours can only be modified by Super Admin');
  }

  // Target locked once first member added; only Super Admin can modify after (§5.19)
  if (input.jatraTarget !== undefined && tour.targetLocked && !actor.isSuperAdmin) {
    throw ApiError.forbidden('Jatra target is locked — only Super Admin can modify it after members are added');
  }

  return prisma.tour.update({ where: { id: tourId }, data: input as any });
}

export async function transitionTour(tourId: string, status: 'DRAFT' | 'ACTIVE' | 'ONGOING' | 'COMPLETED' | 'ARCHIVED', _actorUserId: string) {
  const tour = await prisma.tour.findUnique({ where: { id: tourId } });
  if (!tour) throw ApiError.notFound('Tour not found');
  const updated = await prisma.tour.update({ where: { id: tourId }, data: { status } });

  if (['ACTIVE', 'ONGOING', 'COMPLETED'].includes(status)) {
    const key = status === 'ACTIVE' ? 'TOUR_CREATED' : status === 'ONGOING' ? 'TOUR_STARTED' : 'TOUR_COMPLETED';
    await notifyTourAudience(tourId, key, `Tour "${tour.name}" is now ${status.toLowerCase()}.`);
  }
  return updated;
}

// -----------------------------------------------------------------------------
// Participants — only by JiNANAM Member ID (§5.19)
// -----------------------------------------------------------------------------

export async function addParticipant(tourId: string, memberPublicId: string, parentMemberPublicId?: string) {
  const tour = await prisma.tour.findUnique({ where: { id: tourId } });
  if (!tour || tour.deletedAt) throw ApiError.notFound('Tour not found');

  const member = await prisma.member.findUnique({ where: { publicId: memberPublicId } });
  if (!member) throw ApiError.notFound(`No member found for ID ${memberPublicId} — participants can only be added by JiNANAM Member ID`);

  let parentMemberId: string | undefined;
  if (parentMemberPublicId) {
    const parent = await prisma.member.findUnique({ where: { publicId: parentMemberPublicId } });
    if (!parent) throw ApiError.notFound(`Parent must be a JiNANAM member — no member found for ${parentMemberPublicId}`);
    parentMemberId = parent.id;
  }

  const participant = await prisma.$transaction(async (tx) => {
    const created = await tx.tourParticipant.create({
      data: { tourId, memberId: member.id, parentMemberId },
    });
    // LOCK the target on first participant (§5.19)
    if (!tour.targetLocked) {
      await tx.tour.update({ where: { id: tourId }, data: { targetLocked: true } });
    }
    return created;
  });

  await enqueueNotification({
    userId: member.userId,
    templateKey: 'TOUR_MEMBER_ADDED',
    category: 'SERVICE',
    to: { PUSH: member.userId, IN_APP: member.userId },
    body: `You have been added to tour "${tour.name}" (${tour.publicId}). Please complete your medical form in the app before the tour starts.`,
  });
  if (parentMemberId) {
    const parent = await prisma.member.findUniqueOrThrow({ where: { id: parentMemberId }, select: { userId: true } });
    await enqueueNotification({
      userId: parent.userId,
      templateKey: 'TOUR_PARENT_LINKED',
      category: 'SERVICE',
      to: { PUSH: parent.userId, IN_APP: parent.userId },
      body: `You are linked as the parent contact for ${member.fullName} on tour "${tour.name}". You'll receive all tour updates.`,
    });
  }

  return participant;
}

/** Auto-fetched full profile incl. medical + emergency — visible ONLY to tour admin + Super Admin (route-guarded). */
export async function getParticipantProfile(participantId: string) {
  const participant = await prisma.tourParticipant.findUnique({
    where: { id: participantId },
    include: {
      member: true,
      parentMember: { select: { publicId: true, fullName: true, mobile: true } },
      medicalForm: true,
      roomAssignments: { include: { tourRoom: true } },
      dailyJatraCounts: { orderBy: { date: 'asc' } },
      milestones: true,
      attendance: { orderBy: { date: 'asc' } },
    },
  });
  if (!participant) throw ApiError.notFound('Participant not found');
  return participant;
}

export async function submitMedicalForm(participantId: string, memberUserId: string, form: Record<string, unknown>) {
  const participant = await prisma.tourParticipant.findUnique({ where: { id: participantId }, include: { member: true } });
  if (!participant) throw ApiError.notFound('Participant not found');
  if (participant.member.userId !== memberUserId) throw ApiError.forbidden('You can only complete your own medical form');

  const { emergencyContact, doctorContact, ...rest } = form as any;
  return prisma.tourMedicalForm.upsert({
    where: { participantId },
    update: { ...rest, emergencyContact: emergencyContact as Prisma.InputJsonValue, doctorContact: doctorContact as Prisma.InputJsonValue },
    create: { participantId, ...rest, emergencyContact: emergencyContact as Prisma.InputJsonValue, doctorContact: doctorContact as Prisma.InputJsonValue },
  });
}

// -----------------------------------------------------------------------------
// Sponsors
// -----------------------------------------------------------------------------

export async function addSponsor(tourId: string, input: { name: string; memberPublicId?: string; categoryId?: string; description?: string; amount?: number; contact?: string }) {
  let memberId: string | undefined;
  if (input.memberPublicId) {
    const member = await prisma.member.findUnique({ where: { publicId: input.memberPublicId } });
    memberId = member?.id;
  }
  return prisma.tourSponsor.create({
    data: {
      tourId,
      name: input.name,
      memberId,
      categoryId: input.categoryId,
      description: input.description,
      amount: input.amount,
      contact: input.contact,
    },
  });
}

// -----------------------------------------------------------------------------
// Accommodation: locations -> rooms; assignment; permanent change log (§5.19)
// -----------------------------------------------------------------------------

export async function addAccommodationLocation(tourId: string, name: string) {
  return prisma.tourAccommodationLocation.create({ data: { tourId, name } });
}

export async function addTourRoom(locationId: string, input: { name: string; type?: string; capacity: number }) {
  return prisma.tourRoom.create({ data: { locationId, ...input } });
}

export async function assignRoom(participantId: string, tourRoomId: string, changedById: string, dates?: { checkInDate?: Date; checkOutDate?: Date }) {
  const room = await prisma.tourRoom.findUnique({ where: { id: tourRoomId }, include: { _count: { select: { assignments: true } } } });
  if (!room) throw ApiError.notFound('Room not found');
  if (room._count.assignments >= room.capacity) throw ApiError.conflict(`Room ${room.name} is at capacity (${room.capacity})`);

  const existing = await prisma.tourRoomAssignment.findFirst({ where: { participantId } });

  const assignment = existing
    ? await prisma.tourRoomAssignment.update({ where: { id: existing.id }, data: { tourRoomId, ...dates } })
    : await prisma.tourRoomAssignment.create({ data: { participantId, tourRoomId, ...dates } });

  // Room changes recorded permanently (§5.19)
  await prisma.tourRoomChangeLog.create({
    data: { participantId, fromRoomId: existing?.tourRoomId ?? null, toRoomId: tourRoomId, changedById },
  });

  const participant = await prisma.tourParticipant.findUniqueOrThrow({
    where: { id: participantId },
    include: { member: { select: { userId: true } }, parentMember: { select: { userId: true } }, tour: { select: { name: true } } },
  });
  await notifyParticipantAndParent(participant, 'TOUR_ROOM_CHANGED', `Your room on tour "${participant.tour.name}" is now ${room.name}.`);

  return assignment;
}

/** Auto-calculated occupancy (§5.19). */
export async function accommodationOccupancy(tourId: string) {
  const locations = await prisma.tourAccommodationLocation.findMany({
    where: { tourId },
    include: { rooms: { include: { _count: { select: { assignments: true } } } } },
  });
  return locations.map((loc) => ({
    location: loc.name,
    rooms: loc.rooms.map((r) => ({ name: r.name, capacity: r.capacity, occupied: r._count.assignments, occupancyPct: Math.round((r._count.assignments / r.capacity) * 100) })),
  }));
}

// -----------------------------------------------------------------------------
// Daily jatra counting + milestones + certificate (§5.19)
// -----------------------------------------------------------------------------

const MILESTONES = [25, 50, 75, 100] as const;

export async function enterDailyJatraCount(participantId: string, date: Date, count: number, enteredById: string) {
  const participant = await prisma.tourParticipant.findUnique({
    where: { id: participantId },
    include: { tour: true, member: { select: { userId: true, fullName: true } }, parentMember: { select: { userId: true } } },
  });
  if (!participant) throw ApiError.notFound('Participant not found');

  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  const result = await prisma.$transaction(async (tx) => {
    const previousAgg = await tx.tourDailyJatraCount.aggregate({
      where: { participantId, date: { not: day } },
      _sum: { count: true },
    });
    const previousTotal = previousAgg._sum.count ?? 0;
    const cumulative = previousTotal + count;

    const row = await tx.tourDailyJatraCount.upsert({
      where: { participantId_date: { participantId, date: day } },
      update: { count, cumulativeCount: cumulative, enteredById },
      create: { participantId, date: day, count, cumulativeCount: cumulative, enteredById },
    });

    return { row, cumulative };
  });

  const target = participant.tour.jatraTarget;
  const pct = Math.floor((result.cumulative / target) * 100);

  for (const milestone of MILESTONES) {
    if (pct >= milestone) {
      const existing = await prisma.tourMilestone.findUnique({ where: { participantId_milestonePct: { participantId, milestonePct: milestone } } });
      if (!existing) {
        await prisma.tourMilestone.create({ data: { participantId, milestonePct: milestone } });
        await notifyParticipantAndParent(participant, 'TOUR_MILESTONE', `${participant.member.fullName} reached ${milestone}% of the ${target}-jatra target on "${participant.tour.name}"!`);

        // Members hitting target auto-receive a digital certificate (§5.19)
        if (milestone === 100) {
          await getQueue(QUEUE_NAMES.TOUR_MILESTONES).add('certificate', { participantId }, { jobId: `tour-cert-${participantId}` });
        }
      }
    }
  }

  return { ...result.row, progressPct: Math.min(pct, 100) };
}

/** Digital certificate (PDF + QR) generation — runs in the tour-milestones queue. */
export async function generateTourCertificate(participantId: string) {
  const participant = await prisma.tourParticipant.findUnique({
    where: { id: participantId },
    include: { tour: true, member: true },
  });
  if (!participant) return;

  const milestone = await prisma.tourMilestone.findUnique({ where: { participantId_milestonePct: { participantId, milestonePct: 100 } } });
  if (!milestone || milestone.certificateUrl) return; // already generated

  const qrToken = createSignedToken({ purpose: 'TOUR_CERTIFICATE', id: participantId, tourId: participant.tourId });
  const qrPng = await renderQrBuffer(qrToken);

  const pdf: Buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 60 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(28).font('Helvetica-Bold').text('Certificate of Completion', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).font('Helvetica').text('JiNANAM — Connecting Jain Life', { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(18).text(`${participant.member.fullName} (${participant.member.publicId})`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(
      `has successfully completed the ${participant.tour.jatraTarget}-Jatra target on "${participant.tour.name}" (${participant.tour.publicId}).`,
      { align: 'center' },
    );
    doc.moveDown(2);
    doc.image(qrPng, doc.page.width / 2 - 50, doc.y, { width: 100 });
    doc.end();
  });

  const stored = await storage.save(pdf, `certificate-${participant.member.publicId}-${participant.tour.publicId}.pdf`, 'application/pdf', 'certificates');
  await prisma.tourMilestone.update({ where: { id: milestone.id }, data: { certificateUrl: stored.url } });

  await prisma.memberActivityAggregate.update({
    where: { memberId: participant.memberId },
    data: { certificatesCount: { increment: 1 }, toursCount: { increment: 1 } },
  }).catch(() => undefined);

  await notifyParticipantAndParent(
    { member: { userId: participant.member.userId }, parentMember: null, tour: { name: participant.tour.name } } as any,
    'TOUR_CERTIFICATE_GENERATED',
    `Congratulations! Your completion certificate for "${participant.tour.name}" is ready to download.`,
  );
}

// -----------------------------------------------------------------------------
// Attendance, communication (text-only, permanent), daily schedules
// -----------------------------------------------------------------------------

export async function markAttendance(participantId: string, date: Date, status: 'PRESENT' | 'ABSENT' | 'NOT_WELL') {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return prisma.tourAttendance.upsert({
    where: { participantId_date: { participantId, date: day } },
    update: { status },
    create: { participantId, date: day, status },
  });
}

/** Text-only posts, chronological, permanent — never deleted even post-tour (§5.19). */
export async function postCommunication(tourId: string, message: string, postedById: string) {
  const post = await prisma.tourCommunication.create({ data: { tourId, message, postedById } });
  const tour = await prisma.tour.findUniqueOrThrow({ where: { id: tourId }, select: { name: true } });
  await notifyTourAudience(tourId, 'TOUR_COMMUNICATION', `New update on "${tour.name}": ${message.slice(0, 120)}`);
  return post;
}

export async function listCommunications(tourId: string) {
  return prisma.tourCommunication.findMany({ where: { tourId }, orderBy: { createdAt: 'asc' } });
}

export async function publishDailySchedule(tourId: string, date: Date, scheduleText: string) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const schedule = await prisma.tourDailySchedule.upsert({
    where: { tourId_date: { tourId, date: day } },
    update: { scheduleText },
    create: { tourId, date: day, scheduleText },
  });
  const tour = await prisma.tour.findUniqueOrThrow({ where: { id: tourId }, select: { name: true } });
  await notifyTourAudience(tourId, 'TOUR_DAILY_SCHEDULE', `Today's schedule for "${tour.name}" is published.`);
  return schedule;
}

// -----------------------------------------------------------------------------
// Admin participant dashboard (§5.19)
// -----------------------------------------------------------------------------

export async function tourDashboard(tourId: string) {
  const tour = await prisma.tour.findUnique({ where: { id: tourId } });
  if (!tour) throw ApiError.notFound('Tour not found');

  const participants = await prisma.tourParticipant.findMany({
    where: { tourId, status: 'ACTIVE' },
    include: { member: { select: { gender: true } }, medicalForm: { select: { id: true } } },
  });

  return {
    tour: { publicId: tour.publicId, name: tour.name, target: tour.jatraTarget, startDate: tour.startDate, endDate: tour.endDate, status: tour.status },
    totals: {
      participants: participants.length,
      male: participants.filter((p) => p.member.gender?.toUpperCase().startsWith('M')).length,
      female: participants.filter((p) => p.member.gender?.toUpperCase().startsWith('F')).length,
      parentsLinked: participants.filter((p) => p.parentMemberId).length,
      medicalComplete: participants.filter((p) => p.medicalForm).length,
      medicalPending: participants.filter((p) => !p.medicalForm).length,
    },
  };
}

export async function getTour(tourIdOrPublicId: string) {
  const tour = await prisma.tour.findFirst({
    where: { OR: [{ id: tourIdOrPublicId }, { publicId: tourIdOrPublicId }], deletedAt: null },
    include: {
      category: true,
      primaryMonk: { select: { publicId: true, dikshaName: true, photoUrl: true } },
      monkGroup: true,
      sponsors: { include: { category: true } },
      _count: { select: { participants: true } },
    },
  });
  if (!tour) throw ApiError.notFound('Tour not found');
  return tour;
}

// -----------------------------------------------------------------------------
// Notification helpers — member AND linked parent get everything (§5.19)
// -----------------------------------------------------------------------------

async function notifyParticipantAndParent(
  participant: { member: { userId: string }; parentMember: { userId: string } | null; tour: { name: string } },
  templateKey: string,
  body: string,
) {
  const userIds = [participant.member.userId, participant.parentMember?.userId].filter(Boolean) as string[];
  await Promise.all(
    userIds.map((userId) =>
      enqueueNotification({ userId, templateKey, category: 'SERVICE', to: { PUSH: userId, IN_APP: userId }, body }),
    ),
  );
}

async function notifyTourAudience(tourId: string, templateKey: string, body: string) {
  const participants = await prisma.tourParticipant.findMany({
    where: { tourId, status: 'ACTIVE' },
    include: { member: { select: { userId: true } }, parentMember: { select: { userId: true } } },
  });
  const userIds = new Set<string>();
  for (const p of participants) {
    userIds.add(p.member.userId);
    if (p.parentMember) userIds.add(p.parentMember.userId);
  }
  await Promise.all(
    Array.from(userIds).map((userId) =>
      enqueueNotification({ userId, templateKey, category: 'SERVICE', to: { PUSH: userId, IN_APP: userId }, body }),
    ),
  );
}
