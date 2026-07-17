import { BookingStatus, Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { nextPublicId } from '@/engines/idGenerator/id.service';
import { getQueue, QUEUE_NAMES } from '@/jobs/queues';
import { enqueueNotification } from '@/engines/notification/notification.service';
import { generateReceiptPdf } from '@/engines/export/receipt.service';
import { storage } from '@/utils/storage';
import { addHours } from '@/utils/dateUtils';

// -----------------------------------------------------------------------------
// Booking items (org admin configuration)
// -----------------------------------------------------------------------------

export async function createBookingItem(input: Record<string, unknown> & { organizationId: string; createdById: string }) {
  const { createdById, images, availabilityConfig, bankDetails, ...rest } = input as any;
  return prisma.bookingItem.create({
    data: {
      ...rest,
      images: images as Prisma.InputJsonValue,
      availabilityConfig: availabilityConfig as Prisma.InputJsonValue,
      bankDetails: bankDetails as Prisma.InputJsonValue,
      createdById,
      updatedById: createdById,
    },
  });
}

export async function updateBookingItem(bookingItemId: string, input: Record<string, unknown>, updatedById: string) {
  const { images, availabilityConfig, bankDetails, ...rest } = input as any;
  return prisma.bookingItem.update({
    where: { id: bookingItemId },
    data: {
      ...rest,
      images: images as Prisma.InputJsonValue,
      availabilityConfig: availabilityConfig as Prisma.InputJsonValue,
      bankDetails: bankDetails as Prisma.InputJsonValue,
      updatedById,
    },
  });
}

export async function addBlackoutDate(bookingItemId: string, date: Date, reason?: string) {
  return prisma.bookingBlackoutDate.create({ data: { bookingItemId, date, reason } });
}

/** Admin internal reservations instantly block slots; members see only "Unavailable" (§5.7). */
export async function addInternalReservation(bookingItemId: string, input: { date: Date; slot?: string; reason: string }, createdById: string) {
  return prisma.bookingInternalReservation.create({ data: { bookingItemId, ...input, createdById } });
}

export async function removeInternalReservation(reservationId: string) {
  return prisma.bookingInternalReservation.delete({ where: { id: reservationId } });
}

// -----------------------------------------------------------------------------
// Availability calendar (§5.7)
// -----------------------------------------------------------------------------

type DayAvailability = 'AVAILABLE' | 'RESERVED' | 'BOOKED' | 'UNAVAILABLE' | 'MAINTENANCE';

export async function getAvailabilityCalendar(bookingItemId: string, from: Date, to: Date, options: { isAdmin: boolean }) {
  const item = await prisma.bookingItem.findUnique({ where: { id: bookingItemId } });
  if (!item || item.deletedAt) throw ApiError.notFound('Booking item not found');

  const [blackouts, internalReservations, bookings] = await Promise.all([
    prisma.bookingBlackoutDate.findMany({ where: { bookingItemId, date: { gte: from, lte: to } } }),
    prisma.bookingInternalReservation.findMany({ where: { bookingItemId, date: { gte: from, lte: to } } }),
    prisma.booking.findMany({
      where: {
        bookingItemId,
        deletedAt: null,
        status: { in: ['SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'PAYMENT_PENDING', 'PAYMENT_VERIFICATION', 'CONFIRMED'] },
        dateFrom: { lte: to },
        OR: [{ dateTo: { gte: from } }, { dateTo: null, dateFrom: { gte: from } }],
      },
    }),
  ]);

  const days: { date: string; status: DayAvailability; internalDetails?: string }[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    const dayKey = cursor.toISOString().slice(0, 10);
    const isBlackout = blackouts.some((b) => b.date.toISOString().slice(0, 10) === dayKey);
    const internal = internalReservations.find((r) => r.date.toISOString().slice(0, 10) === dayKey);
    const dayBookingsCount = bookings.filter((b) => {
      const bookFrom = b.dateFrom.toISOString().slice(0, 10);
      const bookTo = (b.dateTo ?? b.dateFrom).toISOString().slice(0, 10);
      return dayKey >= bookFrom && dayKey <= bookTo;
    }).length;

    let status: DayAvailability = 'AVAILABLE';
    if (isBlackout) status = 'MAINTENANCE';
    else if (internal) status = options.isAdmin ? 'RESERVED' : 'UNAVAILABLE'; // members never see internal details
    else if (item.capacityMaxBookings && dayBookingsCount >= item.capacityMaxBookings) status = 'BOOKED';

    days.push({
      date: dayKey,
      status,
      ...(options.isAdmin && internal ? { internalDetails: internal.reason } : {}),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return { item: { id: item.id, name: item.name, type: item.type }, days };
}

// -----------------------------------------------------------------------------
// Member booking flow (§5.7)
// -----------------------------------------------------------------------------

async function pushStatus(bookingId: string, status: BookingStatus, changedById?: string, note?: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  await tx.bookingStatusHistory.create({ data: { bookingId, status, changedById, note } });
  
  // Non-blocking dashboard stats update broadcast
  tx.booking.findUnique({ where: { id: bookingId }, select: { organizationId: true } })
    .then((booking) => {
      if (booking) {
        const { broadcastDashboardUpdate } = require('../dashboard/dashboard.service');
        broadcastDashboardUpdate(booking.organizationId);
      }
    })
    .catch(() => {});
}

export async function submitBooking(memberId: string, input: { bookingItemId: string; dateFrom: Date; dateTo?: Date; slot?: string; peopleCount: number }) {
  const item = await prisma.bookingItem.findUnique({ where: { id: input.bookingItemId } });
  if (!item || item.deletedAt || item.status !== 'ACTIVE') throw ApiError.notFound('Booking item not available');

  if (item.capacityMaxPeople && input.peopleCount > item.capacityMaxPeople) {
    throw ApiError.validation({ peopleCount: [`Maximum ${item.capacityMaxPeople} people allowed`] });
  }

  // Slot conflict check: blackouts + internal reservations + capacity
  const calendar = await getAvailabilityCalendar(input.bookingItemId, input.dateFrom, input.dateTo ?? input.dateFrom, { isAdmin: false });
  const unavailable = calendar.days.find((d) => d.status !== 'AVAILABLE');
  if (unavailable) throw ApiError.conflict(`Selected date ${unavailable.date} is not available (${unavailable.status})`);

  const booking = await prisma.$transaction(async (tx) => {
    const publicId = await nextPublicId('BOOKING', tx);
    const created = await tx.booking.create({
      data: {
        publicId,
        bookingItemId: item.id,
        organizationId: item.organizationId,
        memberId,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        slot: input.slot,
        peopleCount: input.peopleCount,
        amount: item.type === 'PAID' ? item.chargeAmount : 0,
        currency: item.currency,
        status: 'PENDING_APPROVAL',
      },
    });
    await pushStatus(created.id, 'SUBMITTED', memberId, undefined, tx);
    await pushStatus(created.id, 'PENDING_APPROVAL', memberId, undefined, tx);
    return created;
  });

  const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });
  await enqueueNotification({
    userId: member.userId,
    templateKey: 'BOOKING_SUBMITTED',
    category: 'SERVICE',
    to: { PUSH: member.userId, IN_APP: member.userId },
    body: `Your booking ${booking.publicId} for ${item.name} has been submitted and is pending approval.`,
  });

  return booking;
}

export async function decideBooking(bookingId: string, decision: 'APPROVE' | 'REJECT' | 'REQUEST_INFO', actorUserId: string, reason?: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { bookingItem: true, member: true } });
  if (!booking) throw ApiError.notFound('Booking not found');
  if (booking.status !== 'PENDING_APPROVAL') throw ApiError.conflict(`Cannot decide a booking in status ${booking.status}`);

  if (decision === 'REJECT') {
    const updated = await prisma.booking.update({ where: { id: bookingId }, data: { status: 'REJECTED', rejectionReason: reason, updatedById: actorUserId } });
    await pushStatus(bookingId, 'REJECTED', actorUserId, reason);
    await enqueueNotification({
      userId: booking.member.userId,
      templateKey: 'BOOKING_REJECTED',
      category: 'SERVICE',
      to: { PUSH: booking.member.userId, IN_APP: booking.member.userId },
      body: `Your booking ${booking.publicId} was rejected.${reason ? ` Reason: ${reason}` : ''}`,
    });
    return updated;
  }

  if (decision === 'REQUEST_INFO') {
    await pushStatus(bookingId, 'PENDING_APPROVAL', actorUserId, `INFO_REQUESTED: ${reason ?? ''}`);
    await enqueueNotification({
      userId: booking.member.userId,
      templateKey: 'BOOKING_INFO_REQUESTED',
      category: 'SERVICE',
      to: { PUSH: booking.member.userId, IN_APP: booking.member.userId },
      body: `More information is needed for booking ${booking.publicId}: ${reason ?? 'Please contact the organization.'}`,
    });
    return booking;
  }

  // APPROVE
  if (booking.bookingItem.type === 'PAID') {
    const expiresAt = addHours(new Date(), booking.bookingItem.paymentWindowHours);
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'PAYMENT_PENDING', paymentWindowExpiresAt: expiresAt, updatedById: actorUserId },
    });
    await pushStatus(bookingId, 'APPROVED', actorUserId);
    await pushStatus(bookingId, 'PAYMENT_PENDING', actorUserId);

    // BullMQ delayed job for the payment-window countdown (§5.7)
    await getQueue(QUEUE_NAMES.BOOKING_PAYMENT_WINDOW).add(
      'expire',
      { bookingId },
      { delay: booking.bookingItem.paymentWindowHours * 60 * 60 * 1000, jobId: `booking-expiry-${bookingId}` },
    );

    await enqueueNotification({
      userId: booking.member.userId,
      templateKey: 'BOOKING_PAYMENT_WINDOW_STARTED',
      category: 'SERVICE',
      to: { PUSH: booking.member.userId, IN_APP: booking.member.userId },
      body: `Your booking ${booking.publicId} is approved. Complete payment within ${booking.bookingItem.paymentWindowHours} hours to confirm.`,
    });
    return updated;
  }

  const updated = await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED', updatedById: actorUserId } });
  await pushStatus(bookingId, 'APPROVED', actorUserId);
  await pushStatus(bookingId, 'CONFIRMED', actorUserId);
  await issueBookingReceipt(bookingId);
  await enqueueNotification({
    userId: booking.member.userId,
    templateKey: 'BOOKING_CONFIRMED',
    category: 'SERVICE',
    to: { PUSH: booking.member.userId, IN_APP: booking.member.userId },
    body: `Your booking ${booking.publicId} is confirmed.`,
  });
  return updated;
}

/** Member uploads offline-payment proof; idempotency key prevents double submission (§7). */
export async function submitPaymentProof(bookingId: string, memberId: string, input: { paymentReference: string; paymentProofUrl: string; paymentNotes?: string; idempotencyKey: string }) {
  const existing = await prisma.booking.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return existing; // idempotent replay

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { member: true } });
  if (!booking) throw ApiError.notFound('Booking not found');
  if (booking.memberId !== memberId) throw ApiError.forbidden('Not your booking');
  if (booking.status !== 'PAYMENT_PENDING') throw ApiError.conflict(`Cannot submit payment for a booking in status ${booking.status}`);
  if (booking.paymentWindowExpiresAt && booking.paymentWindowExpiresAt < new Date()) {
    throw new ApiError('PAYMENT_WINDOW_EXPIRED', 'The payment window for this booking has expired');
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'PAYMENT_VERIFICATION',
      paymentReference: input.paymentReference,
      paymentProofUrl: input.paymentProofUrl,
      paymentNotes: input.paymentNotes,
      idempotencyKey: input.idempotencyKey,
    },
  });
  await pushStatus(bookingId, 'PAYMENT_VERIFICATION', memberId);
  return updated;
}

export async function verifyPayment(bookingId: string, decision: 'APPROVE' | 'REJECT', actorUserId: string, reason?: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { member: true } });
  if (!booking) throw ApiError.notFound('Booking not found');
  if (booking.status !== 'PAYMENT_VERIFICATION') throw ApiError.conflict(`Cannot verify payment for a booking in status ${booking.status}`);

  if (decision === 'REJECT') {
    // Re-upload flow: back to PAYMENT_PENDING while the window is still open
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'PAYMENT_PENDING', rejectionReason: reason, idempotencyKey: null },
    });
    await pushStatus(bookingId, 'PAYMENT_PENDING', actorUserId, `PAYMENT_REJECTED: ${reason ?? ''}`);
    await enqueueNotification({
      userId: booking.member.userId,
      templateKey: 'BOOKING_PAYMENT_REJECTED',
      category: 'SERVICE',
      to: { PUSH: booking.member.userId, IN_APP: booking.member.userId },
      body: `Payment proof for booking ${booking.publicId} was rejected. Please re-upload before the window expires.${reason ? ` Reason: ${reason}` : ''}`,
    });
    return updated;
  }

  const updated = await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED', updatedById: actorUserId } });
  await pushStatus(bookingId, 'CONFIRMED', actorUserId);

  // Cancel the pending expiry job — payment completed in time
  const job = await getQueue(QUEUE_NAMES.BOOKING_PAYMENT_WINDOW).getJob(`booking-expiry-${bookingId}`);
  if (job) await job.remove().catch(() => undefined);

  await issueBookingReceipt(bookingId);
  await enqueueNotification({
    userId: booking.member.userId,
    templateKey: 'BOOKING_CONFIRMED',
    category: 'SERVICE',
    to: { PUSH: booking.member.userId, IN_APP: booking.member.userId },
    body: `Payment verified — your booking ${booking.publicId} is confirmed. Receipt available in My Bookings.`,
  });
  return updated;
}

/** Fired by the BullMQ delayed job when the payment window lapses (§5.7): auto-cancel, release slot, notify. */
export async function expireBookingPaymentWindow(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { member: true } });
  if (!booking) return;
  if (!['PAYMENT_PENDING', 'PAYMENT_VERIFICATION'].includes(booking.status)) return; // already resolved

  await prisma.booking.update({ where: { id: bookingId }, data: { status: 'EXPIRED' } });
  await pushStatus(bookingId, 'EXPIRED', undefined, 'Payment window timed out');

  await enqueueNotification({
    userId: booking.member.userId,
    templateKey: 'BOOKING_AUTO_CANCELLED',
    category: 'SERVICE',
    to: { PUSH: booking.member.userId, IN_APP: booking.member.userId },
    body: `Booking ${booking.publicId} was auto-cancelled because payment was not completed within the payment window. The slot has been released.`,
  });
}

// -----------------------------------------------------------------------------
// Receipts (§5.7)
// -----------------------------------------------------------------------------

async function issueBookingReceipt(bookingId: string) {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { member: true, organization: true, bookingItem: true },
  });

  const receiptPublicId = await prisma.$transaction((tx) => nextPublicId('RECEIPT', tx));

  const pdf = await generateReceiptPdf({
    receiptNumber: receiptPublicId,
    type: 'BOOKING',
    organizationName: booking.organization.name,
    trustRegistrationNumber: booking.organization.trustRegistrationNumber ?? undefined,
    is80gEligible: booking.organization.is80gEligible,
    memberName: booking.member.fullName,
    memberPublicId: booking.member.publicId,
    amount: booking.amount.toString(),
    currency: booking.currency,
    issuedAt: new Date(),
    lineItems: [
      { label: 'Booking ID', value: booking.publicId },
      { label: 'Item', value: booking.bookingItem.name },
      { label: 'Date(s)', value: `${booking.dateFrom.toISOString().slice(0, 10)}${booking.dateTo ? ` to ${booking.dateTo.toISOString().slice(0, 10)}` : ''}` },
      ...(booking.paymentReference ? [{ label: 'Payment Reference', value: booking.paymentReference }] : []),
    ],
  });

  const stored = await storage.save(pdf, `${receiptPublicId}.pdf`, 'application/pdf', 'receipts');

  return prisma.receipt.create({
    data: {
      publicId: receiptPublicId,
      type: 'BOOKING',
      organizationId: booking.organizationId,
      memberId: booking.memberId,
      bookingId: booking.id,
      amount: booking.amount,
      currency: booking.currency,
      pdfUrl: stored.url,
    },
  });
}

// -----------------------------------------------------------------------------
// My Bookings (§5.7): unified across orgs/categories, past auto-scoped, never deleted
// -----------------------------------------------------------------------------

export async function listMyBookings(memberId: string, query: { scope: 'upcoming' | 'past' | 'all'; month?: number; year?: number; categoryId?: string; organizationId?: string; page: number; pageSize: number }) {
  const now = new Date();
  const where: Prisma.BookingWhereInput = {
    memberId,
    deletedAt: null,
    organizationId: query.organizationId,
    bookingItem: query.categoryId ? { categoryId: query.categoryId } : undefined,
  };

  if (query.scope === 'upcoming') {
    where.dateFrom = { gte: now };
    where.status = { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'] };
  } else if (query.scope === 'past') {
    where.OR = [{ dateFrom: { lt: now } }, { status: { in: ['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'] } }];
  }

  if (query.month && query.year) {
    where.dateFrom = {
      gte: new Date(query.year, query.month - 1, 1),
      lt: new Date(query.year, query.month, 1),
    };
  } else if (query.year) {
    where.dateFrom = { gte: new Date(query.year, 0, 1), lt: new Date(query.year + 1, 0, 1) };
  }

  const [total, rows] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      include: {
        bookingItem: { select: { name: true, categoryId: true, type: true } },
        organization: { select: { name: true, publicId: true } },
        statusHistory: { orderBy: { changedAt: 'asc' } },
        receipt: { select: { publicId: true, pdfUrl: true } },
      },
      orderBy: { dateFrom: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { total, rows };
}

export async function getBookingWithTimeline(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      bookingItem: true,
      organization: { select: { name: true, publicId: true } },
      member: { select: { fullName: true, publicId: true, userId: true } },
      statusHistory: { orderBy: { changedAt: 'asc' } },
      receipt: true,
    },
  });
  if (!booking) throw ApiError.notFound('Booking not found');
  return booking;
}

/** Org admin occupancy view (§5.7). */
export async function listOrgBookings(organizationId: string, query: { status?: BookingStatus; page: number; pageSize: number }) {
  const where: Prisma.BookingWhereInput = { organizationId, deletedAt: null, status: query.status };
  const [total, rows] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      include: { bookingItem: { select: { name: true } }, member: { select: { fullName: true, publicId: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { total, rows };
}
