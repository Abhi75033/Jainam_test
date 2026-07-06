import { EventStatus, Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { nextPublicId } from '@/engines/idGenerator/id.service';
import { getQueue, QUEUE_NAMES } from '@/jobs/queues';
import { enqueueNotification } from '@/engines/notification/notification.service';
import { getEligibleMemberIds } from '@/engines/visibility/visibility.service';
import { MAX_EVENT_GALLERY_IMAGES } from '@/config/constants';

// -----------------------------------------------------------------------------
// Creation & lifecycle (§5.9)
// Free events: org admins. Paid events: SUPER ADMIN ONLY — org admins get a
// blocking response instructing them to raise a support ticket.
// -----------------------------------------------------------------------------

export async function createEvent(input: Record<string, unknown> & { organizationId: string; isPaid: boolean; createdById: string; actorIsSuperAdmin: boolean }) {
  const { actorIsSuperAdmin, createdById, attachments, visibilityConfig, ...rest } = input as any;

  if (input.isPaid && !actorIsSuperAdmin) {
    throw ApiError.forbidden(
      'Paid events can only be created by JiNANAM (Super Admin). Please raise a support ticket of type PAID_EVENT_REQUEST and our team will create it on your behalf.',
    );
  }

  return prisma.$transaction(async (tx) => {
    const publicId = await nextPublicId('EVENT', tx);
    return tx.event.create({
      data: {
        publicId,
        ...rest,
        attachments: attachments as Prisma.InputJsonValue,
        visibilityConfig: visibilityConfig as Prisma.InputJsonValue,
        status: 'DRAFT',
        createdById,
        updatedById: createdById,
      },
    });
  });
}

const LIFECYCLE_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  DRAFT: ['PUBLISHED'],
  PUBLISHED: ['RSVP_SALES_OPEN', 'LIVE'],
  RSVP_SALES_OPEN: ['LIVE'],
  LIVE: ['COMPLETED'],
  COMPLETED: ['GALLERY_UPLOADED', 'ARCHIVED'],
  GALLERY_UPLOADED: ['ARCHIVED'],
  ARCHIVED: [],
};

export async function transitionEvent(eventId: string, to: EventStatus, actor: { userId: string; isSuperAdmin: boolean }) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.deletedAt) throw ApiError.notFound('Event not found');

  // Completed events locked for org admins — only Super Admin can reopen/modify (§5.9)
  if (['COMPLETED', 'GALLERY_UPLOADED', 'ARCHIVED'].includes(event.status) && !actor.isSuperAdmin && to !== 'GALLERY_UPLOADED') {
    throw ApiError.forbidden('Completed events are locked. Only Super Admin can modify them.');
  }

  if (!actor.isSuperAdmin && !LIFECYCLE_TRANSITIONS[event.status].includes(to)) {
    throw ApiError.conflict(`Invalid transition ${event.status} -> ${to}`);
  }

  const updated = await prisma.event.update({ where: { id: eventId }, data: { status: to, updatedById: actor.userId } });

  if (to === 'PUBLISHED') {
    await schedulePublishSideEffects(updated.id);
  }

  return updated;
}

/**
 * Event cancellation (§4.3): notifies RSVP + ticket holders with the reason and
 * refund policy. Refunds themselves remain manual (Super Admin marks refunded).
 */
export async function cancelEvent(eventId: string, reason: string, refundPolicyNote: string | undefined, actor: { userId: string; isSuperAdmin: boolean }) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.deletedAt) throw ApiError.notFound('Event not found');
  if (event.cancelledAt) throw ApiError.conflict('Event is already cancelled');
  if (['COMPLETED', 'GALLERY_UPLOADED', 'ARCHIVED'].includes(event.status) && !actor.isSuperAdmin) {
    throw ApiError.forbidden('Completed events can only be modified by Super Admin');
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: { status: 'ARCHIVED', cancelledAt: new Date(), cancellationReason: reason, refundPolicyNote, updatedById: actor.userId },
  });

  // Remove pending lifecycle/reminder jobs
  const lifecycleJob = await getQueue(QUEUE_NAMES.EVENT_LIFECYCLE).getJob(`event-complete-${eventId}`);
  if (lifecycleJob) await lifecycleJob.remove().catch(() => undefined);

  const [rsvps, tickets] = await Promise.all([
    prisma.eventRsvp.findMany({ where: { eventId, status: { in: ['CONFIRMED', 'WAITING_LIST'] } }, include: { member: { select: { userId: true } } } }),
    prisma.ticket.findMany({ where: { eventId, status: { in: ['TICKET_GENERATED', 'PAYMENT_SUCCESSFUL', 'PENDING_PAYMENT'] } }, include: { buyerMember: { select: { userId: true } } } }),
  ]);
  const userIds = new Set([...rsvps.map((r) => r.member.userId), ...tickets.map((t) => t.buyerMember.userId)]);
  const refundLine = refundPolicyNote ?? (event.isPaid ? 'Ticket refunds will be processed manually — you will be contacted by the JiNANAM team.' : '');
  await Promise.all(
    Array.from(userIds).map((userId) =>
      enqueueNotification({
        userId,
        templateKey: 'EVENT_CANCELLED',
        category: 'SERVICE',
        to: { PUSH: userId, IN_APP: userId },
        body: `${event.title} has been cancelled. Reason: ${reason}. ${refundLine}`.trim(),
      }),
    ),
  );

  return updated;
}

async function schedulePublishSideEffects(eventId: string) {
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
  const now = Date.now();
  const startMs = event.startAt.getTime();
  const endMs = event.endAt.getTime();

  // Auto-complete at end time (§5.9)
  await getQueue(QUEUE_NAMES.EVENT_LIFECYCLE).add('auto-complete', { eventId }, { delay: Math.max(endMs - now, 0), jobId: `event-complete-${eventId}` });

  // Reminder matrix (§4.3)
  const reminders: { key: string; at: number }[] = event.isPaid
    ? [
        { key: 'PAID_24H', at: startMs - 24 * 3600_000 },
        { key: 'PAID_2H', at: startMs - 2 * 3600_000 },
        // "every 3 days until 2 days before" for non-buyers
        ...buildEvery3DaysReminders(now, startMs),
      ]
    : [
        { key: 'FREE_48H', at: startMs - 48 * 3600_000 },
        { key: 'FREE_12H', at: startMs - 12 * 3600_000 },
        { key: 'FREE_2H', at: startMs - 2 * 3600_000 },
      ];

  for (const r of reminders) {
    if (r.at > now) {
      await getQueue(QUEUE_NAMES.EVENT_REMINDERS).add('reminder', { eventId, reminderKey: r.key }, { delay: r.at - now, jobId: `event-reminder-${eventId}-${r.key}` });
    }
  }

  // Automatic feed-card generation (§5.13)
  const { createAutoFeedCard } = await import('@/modules/feed/feed.service');
  await createAutoFeedCard({
    sourceModule: 'EVENTS',
    sourceId: event.id,
    organizationId: event.organizationId,
    title: event.title,
    description: event.description ?? undefined,
    coverUrl: event.bannerUrl ?? undefined,
    visibilityConfig: (event.visibilityConfig as Record<string, unknown>) ?? undefined,
  });

  // Publish notification to eligible members (visibility engine fan-out)
  const config = (event.visibilityConfig ?? { isPublic: true }) as any;
  const eligible = await getEligibleMemberIds(config);
  const members = await prisma.member.findMany({ where: { id: { in: Array.from(eligible) } }, select: { userId: true } });
  await Promise.all(
    members.map((m) =>
      enqueueNotification({
        userId: m.userId,
        templateKey: 'EVENT_PUBLISHED',
        category: 'SERVICE',
        to: { PUSH: m.userId, IN_APP: m.userId },
        body: `New event: ${event.title} on ${event.startAt.toDateString()}. Tap to view details.`,
        data: { eventId: event.id, eventPublicId: event.publicId },
      }),
    ),
  );
}

function buildEvery3DaysReminders(nowMs: number, startMs: number): { key: string; at: number }[] {
  const out: { key: string; at: number }[] = [];
  const cutoff = startMs - 2 * 24 * 3600_000;
  let t = nowMs + 3 * 24 * 3600_000;
  let i = 1;
  while (t < cutoff) {
    out.push({ key: `PAID_3DAY_${i}`, at: t });
    t += 3 * 24 * 3600_000;
    i += 1;
  }
  return out;
}

/** Fired by the event-lifecycle queue at end time: closes RSVP/sales, enables gallery + feedback (§5.9). */
export async function autoCompleteEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return;
  if (['COMPLETED', 'GALLERY_UPLOADED', 'ARCHIVED'].includes(event.status)) return;
  await prisma.event.update({ where: { id: eventId }, data: { status: 'COMPLETED' } });

  // Feedback reminder 24h after completion (§4.3)
  await getQueue(QUEUE_NAMES.EVENT_REMINDERS).add('reminder', { eventId, reminderKey: 'FEEDBACK_24H' }, { delay: 24 * 3600_000, jobId: `event-reminder-${eventId}-FEEDBACK_24H` });
}

/** Reminder dispatcher used by the event-reminders queue. */
export async function sendEventReminder(eventId: string, reminderKey: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.deletedAt) return;

  let recipients: { userId: string }[] = [];
  let body = '';

  if (reminderKey.startsWith('FREE_48H')) {
    // all eligible members
    const eligible = await getEligibleMemberIds((event.visibilityConfig ?? { isPublic: true }) as any);
    recipients = await prisma.member.findMany({ where: { id: { in: Array.from(eligible) } }, select: { userId: true } });
    body = `Reminder: ${event.title} is in 48 hours.`;
  } else if (reminderKey.startsWith('FREE_')) {
    // RSVP'd members only
    const rsvps = await prisma.eventRsvp.findMany({ where: { eventId, status: 'CONFIRMED' }, include: { member: { select: { userId: true } } } });
    recipients = rsvps.map((r) => ({ userId: r.member.userId }));
    body = `Reminder: ${event.title} starts soon. See you there!`;
  } else if (reminderKey.startsWith('PAID_3DAY')) {
    // non-buyers among eligible members
    const eligible = await getEligibleMemberIds((event.visibilityConfig ?? { isPublic: true }) as any);
    const buyers = await prisma.ticket.findMany({ where: { eventId, status: { in: ['PAYMENT_SUCCESSFUL', 'TICKET_GENERATED', 'CHECKED_IN'] } }, select: { buyerMemberId: true } });
    const buyerSet = new Set(buyers.map((b) => b.buyerMemberId));
    const nonBuyers = Array.from(eligible).filter((id) => !buyerSet.has(id));
    recipients = await prisma.member.findMany({ where: { id: { in: nonBuyers } }, select: { userId: true } });
    body = `Tickets for ${event.title} are selling — book yours before they run out!`;
  } else if (reminderKey.startsWith('PAID_')) {
    // ticket holders
    const tickets = await prisma.ticket.findMany({ where: { eventId, status: { in: ['TICKET_GENERATED', 'PAYMENT_SUCCESSFUL'] } }, include: { buyerMember: { select: { userId: true } } } });
    recipients = [...new Map(tickets.map((t) => [t.buyerMember.userId, { userId: t.buyerMember.userId }])).values()];
    body = `Reminder: ${event.title} starts soon. Your ticket QR is in My Tickets.`;
  } else if (reminderKey === 'FEEDBACK_24H') {
    // attended members
    const attended = await prisma.ticket.findMany({ where: { eventId, status: 'CHECKED_IN' }, include: { buyerMember: { select: { userId: true } } } });
    recipients = [...new Map(attended.map((t) => [t.buyerMember.userId, { userId: t.buyerMember.userId }])).values()];
    body = `How was ${event.title}? Share your feedback in the app.`;
  }

  await Promise.all(
    recipients.map((r) =>
      enqueueNotification({
        userId: r.userId,
        templateKey: `EVENT_REMINDER_${reminderKey}`,
        category: 'SERVICE',
        to: { PUSH: r.userId, IN_APP: r.userId },
        body,
        data: { eventId },
      }),
    ),
  );
}

// -----------------------------------------------------------------------------
// RSVP engine with waiting list auto-promotion (§5.9)
// -----------------------------------------------------------------------------

export async function rsvp(eventId: string, memberId: string, attendeeCount: number) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.deletedAt) throw ApiError.notFound('Event not found');
  if (!['PUBLISHED', 'RSVP_SALES_OPEN'].includes(event.status)) throw ApiError.conflict('RSVP is not open for this event');

  const existing = await prisma.eventRsvp.findUnique({ where: { eventId_memberId: { eventId, memberId } } });
  if (existing && existing.status !== 'CANCELLED') throw ApiError.conflict('You have already RSVPed to this event');

  return prisma.$transaction(async (tx) => {
    let status: 'CONFIRMED' | 'WAITING_LIST' = 'CONFIRMED';
    let waitingListPosition: number | null = null;

    if (event.rsvpCapacity) {
      const agg = await tx.eventRsvp.aggregate({ where: { eventId, status: 'CONFIRMED' }, _sum: { attendeeCount: true } });
      const confirmed = agg._sum.attendeeCount ?? 0;
      if (confirmed + attendeeCount > event.rsvpCapacity) {
        if (!event.waitingListEnabled) throw ApiError.conflict('Event is full');
        status = 'WAITING_LIST';
        const lastPosition = await tx.eventRsvp.count({ where: { eventId, status: 'WAITING_LIST' } });
        waitingListPosition = lastPosition + 1;
      }
    }

    const row = existing
      ? await tx.eventRsvp.update({ where: { id: existing.id }, data: { status, attendeeCount, waitingListPosition } })
      : await tx.eventRsvp.create({ data: { eventId, memberId, attendeeCount, status, waitingListPosition } });

    const member = await tx.member.findUniqueOrThrow({ where: { id: memberId }, select: { userId: true } });
    await enqueueNotification({
      userId: member.userId,
      templateKey: status === 'CONFIRMED' ? 'RSVP_CONFIRMED' : 'WAITING_LIST_ADDED',
      category: 'SERVICE',
      to: { PUSH: member.userId, IN_APP: member.userId },
      body: status === 'CONFIRMED' ? `Your RSVP for ${event.title} is confirmed.` : `${event.title} is full — you're #${waitingListPosition} on the waiting list.`,
    });

    return row;
  });
}

export async function cancelRsvp(eventId: string, memberId: string) {
  const existing = await prisma.eventRsvp.findUnique({ where: { eventId_memberId: { eventId, memberId } } });
  if (!existing || existing.status === 'CANCELLED') throw ApiError.notFound('No active RSVP found');

  await prisma.eventRsvp.update({ where: { id: existing.id }, data: { status: 'CANCELLED', waitingListPosition: null } });
  if (existing.status === 'CONFIRMED') {
    await promoteFromWaitingList(eventId);
  }
  return { cancelled: true };
}

/** Slot frees -> promote longest-waiting -> notify (§5.9). */
async function promoteFromWaitingList(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event?.rsvpCapacity) return;

  const agg = await prisma.eventRsvp.aggregate({ where: { eventId, status: 'CONFIRMED' }, _sum: { attendeeCount: true } });
  let available = event.rsvpCapacity - (agg._sum.attendeeCount ?? 0);
  if (available <= 0) return;

  const waiting = await prisma.eventRsvp.findMany({
    where: { eventId, status: 'WAITING_LIST' },
    orderBy: { waitingListPosition: 'asc' },
    include: { member: { select: { userId: true } } },
  });

  for (const w of waiting) {
    if (w.attendeeCount > available) continue;
    await prisma.eventRsvp.update({ where: { id: w.id }, data: { status: 'CONFIRMED', waitingListPosition: null, promotedAt: new Date() } });
    available -= w.attendeeCount;
    await enqueueNotification({
      userId: w.member.userId,
      templateKey: 'WAITING_LIST_PROMOTED',
      category: 'SERVICE',
      to: { PUSH: w.member.userId, IN_APP: w.member.userId },
      body: `Good news! A spot opened up — your RSVP for ${event.title} is now confirmed.`,
    });
    if (available <= 0) break;
  }
}

// -----------------------------------------------------------------------------
// Gallery + feedback (§5.9 post-event)
// -----------------------------------------------------------------------------

export async function addGalleryImages(eventId: string, imageUrls: string[]) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw ApiError.notFound('Event not found');
  if (!['COMPLETED', 'GALLERY_UPLOADED', 'ARCHIVED'].includes(event.status)) {
    throw ApiError.conflict('Gallery can only be uploaded after the event completes');
  }

  const count = await prisma.eventGalleryImage.count({ where: { eventId } });
  if (count + imageUrls.length > MAX_EVENT_GALLERY_IMAGES) {
    throw ApiError.validation({ imageUrls: [`Maximum ${MAX_EVENT_GALLERY_IMAGES} images per event (currently ${count})`] });
  }

  await prisma.eventGalleryImage.createMany({ data: imageUrls.map((imageUrl, i) => ({ eventId, imageUrl, order: count + i })) });
  await prisma.event.update({ where: { id: eventId }, data: { status: 'GALLERY_UPLOADED' } });

  // Auto feed-card for the gallery update (§5.13)
  const { createAutoFeedCard } = await import('@/modules/feed/feed.service');
  await createAutoFeedCard({
    sourceModule: 'GALLERY',
    sourceId: eventId,
    organizationId: event.organizationId,
    title: `Photos from ${event.title}`,
    coverUrl: imageUrls[0],
    visibilityConfig: (event.visibilityConfig as Record<string, unknown>) ?? undefined,
  });

  // Gallery-upload notification to ATTENDEES ONLY (§5.9)
  const attendees = await prisma.ticket.findMany({ where: { eventId, status: 'CHECKED_IN' }, include: { buyerMember: { select: { userId: true } } } });
  const rsvpAttendees = await prisma.eventRsvp.findMany({ where: { eventId, status: 'CONFIRMED' }, include: { member: { select: { userId: true } } } });
  const userIds = new Set<string>([...attendees.map((t) => t.buyerMember.userId), ...rsvpAttendees.map((r) => r.member.userId)]);

  await Promise.all(
    Array.from(userIds).map((userId) =>
      enqueueNotification({
        userId,
        templateKey: 'EVENT_GALLERY_UPLOADED',
        category: 'SERVICE',
        to: { PUSH: userId, IN_APP: userId },
        body: `Photos from ${event.title} are now available in the gallery.`,
      }),
    ),
  );

  return prisma.eventGalleryImage.findMany({ where: { eventId }, orderBy: { order: 'asc' } });
}

export async function addVideoLink(eventId: string, url: string) {
  // Unlimited video LINKS; no video upload (§5.9)
  return prisma.eventVideoLink.create({ data: { eventId, url } });
}

export async function submitFeedback(eventId: string, memberId: string, rating: number, comment?: string) {
  // Feedback accepted from Attended members only (§5.9)
  const attended = await prisma.ticket.findFirst({ where: { eventId, status: 'CHECKED_IN', OR: [{ buyerMemberId: memberId }, { attendeeMemberId: memberId }] } });
  const rsvped = await prisma.eventRsvp.findFirst({ where: { eventId, memberId, status: 'CONFIRMED' } });
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw ApiError.notFound('Event not found');
  if (!['COMPLETED', 'GALLERY_UPLOADED', 'ARCHIVED'].includes(event.status)) throw ApiError.conflict('Feedback opens after the event completes');
  if (!attended && !rsvped) throw ApiError.forbidden('Only attendees can submit feedback');

  return prisma.eventFeedback.upsert({
    where: { eventId_memberId: { eventId, memberId } },
    update: { rating, comment },
    create: { eventId, memberId, rating, comment },
  });
}

// -----------------------------------------------------------------------------
// Member app endpoints (§5.9): Upcoming / Today / My RSVP / My Tickets / Waiting List / Past
// -----------------------------------------------------------------------------

export async function memberEvents(memberId: string, query: { scope: string; organizationId?: string; year?: number; month?: number; page: number; pageSize: number }) {
  const now = new Date();
  const skip = (query.page - 1) * query.pageSize;
  const take = query.pageSize;

  switch (query.scope) {
    case 'today': {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);
      return prisma.event.findMany({
        where: { deletedAt: null, status: { in: ['PUBLISHED', 'RSVP_SALES_OPEN', 'LIVE'] }, startAt: { gte: dayStart, lt: dayEnd }, organizationId: query.organizationId },
        orderBy: { startAt: 'asc' },
        skip,
        take,
      });
    }
    case 'my-rsvp':
      return prisma.eventRsvp.findMany({
        where: { memberId, status: 'CONFIRMED' },
        include: { event: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      });
    case 'waiting-list':
      return prisma.eventRsvp.findMany({
        where: { memberId, status: 'WAITING_LIST' },
        include: { event: true },
        orderBy: { waitingListPosition: 'asc' },
        skip,
        take,
      });
    case 'my-tickets':
      return prisma.ticket.findMany({
        where: { OR: [{ buyerMemberId: memberId }, { attendeeMemberId: memberId }] },
        include: { event: { select: { title: true, startAt: true, venue: true, publicId: true } }, ticketCategory: { select: { name: true } }, seat: { select: { label: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      });
    case 'past': {
      // Past events archive browsable by org -> year -> month, retained permanently (§5.9, DECISIONS.md D-004)
      const where: Prisma.EventWhereInput = {
        deletedAt: null,
        status: { in: ['COMPLETED', 'GALLERY_UPLOADED', 'ARCHIVED'] },
        organizationId: query.organizationId,
      };
      if (query.year && query.month) {
        where.startAt = { gte: new Date(query.year, query.month - 1, 1), lt: new Date(query.year, query.month, 1) };
      } else if (query.year) {
        where.startAt = { gte: new Date(query.year, 0, 1), lt: new Date(query.year + 1, 0, 1) };
      }
      return prisma.event.findMany({ where, orderBy: { startAt: 'desc' }, skip, take });
    }
    case 'upcoming':
    default:
      return prisma.event.findMany({
        where: { deletedAt: null, status: { in: ['PUBLISHED', 'RSVP_SALES_OPEN'] }, startAt: { gte: now }, organizationId: query.organizationId },
        orderBy: { startAt: 'asc' },
        skip,
        take,
      });
  }
}

export async function getEvent(eventIdOrPublicId: string) {
  const event = await prisma.event.findFirst({
    where: { OR: [{ id: eventIdOrPublicId }, { publicId: eventIdOrPublicId }], deletedAt: null },
    include: {
      organization: { select: { name: true, publicId: true } },
      category: true,
      ticketCategories: { where: { deletedAt: null } },
      galleryImages: { orderBy: { order: 'asc' } },
      videoLinks: true,
    },
  });
  if (!event) throw ApiError.notFound('Event not found');
  return event;
}

// -----------------------------------------------------------------------------
// Dashboards (§5.9 part 10)
// -----------------------------------------------------------------------------

export async function orgEventDashboard(organizationId: string) {
  const [byStatus, rsvpAgg, waitingCount, checkedIn, totalTickets, feedbackAgg] = await Promise.all([
    prisma.event.groupBy({ by: ['status'], where: { organizationId, deletedAt: null }, _count: true }),
    prisma.eventRsvp.aggregate({ where: { event: { organizationId } }, _sum: { attendeeCount: true } }),
    prisma.eventRsvp.count({ where: { event: { organizationId }, status: 'WAITING_LIST' } }),
    prisma.ticket.count({ where: { event: { organizationId }, status: 'CHECKED_IN' } }),
    prisma.ticket.count({ where: { event: { organizationId }, status: { in: ['TICKET_GENERATED', 'CHECKED_IN'] } } }),
    prisma.eventFeedback.aggregate({ where: { event: { organizationId } }, _avg: { rating: true }, _count: true }),
  ]);

  return {
    totalsByStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
    totalRsvps: rsvpAgg._sum.attendeeCount ?? 0,
    waitingList: waitingCount,
    attendancePct: totalTickets > 0 ? Math.round((checkedIn / totalTickets) * 100) : null,
    feedback: { average: feedbackAgg._avg.rating, count: feedbackAgg._count },
  };
}

/** Super Admin national dashboard incl. revenue — Super Admin only (§5.9). */
export async function platformEventDashboard() {
  const [events, revenue, ticketsSold] = await Promise.all([
    prisma.event.count({ where: { deletedAt: null } }),
    prisma.ticket.aggregate({ where: { status: { in: ['TICKET_GENERATED', 'CHECKED_IN'] } }, _sum: { amount: true } }),
    prisma.ticket.count({ where: { status: { in: ['TICKET_GENERATED', 'CHECKED_IN'] } } }),
  ]);
  return { totalEvents: events, revenue: revenue._sum.amount ?? 0, ticketsSold };
}
