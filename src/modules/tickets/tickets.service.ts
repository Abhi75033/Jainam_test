import { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { nextPublicId } from '@/engines/idGenerator/id.service';
import { createSignedToken, verifySignedToken } from '@/engines/qr/qr.service';
import { enqueueNotification } from '@/engines/notification/notification.service';
import { calculateAge } from '@/utils/dateUtils';
import { confirmSeatBooking } from '@/modules/seating/seating.service';
import { SCAN_WINDOW_HOURS_BEFORE_EVENT } from '@/config/constants';

// -----------------------------------------------------------------------------
// Ticket categories (§5.9): unlimited, each with price/capacity/sale window
// -----------------------------------------------------------------------------

export async function createTicketCategory(eventId: string, input: Record<string, unknown>) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.deletedAt) throw ApiError.notFound('Event not found');
  if (!event.isPaid) throw ApiError.conflict('Ticket categories only apply to paid events');
  const { visibilityConfig, ...rest } = input as any;
  return prisma.ticketCategory.create({
    data: { eventId, ...rest, visibilityConfig: visibilityConfig as Prisma.InputJsonValue },
  });
}

// -----------------------------------------------------------------------------
// Attendee validation: enter JiNANAM Member IDs per attendee (§5.9)
// -----------------------------------------------------------------------------

export async function validateAttendeeMemberId(memberPublicId: string) {
  const member = await prisma.member.findUnique({
    where: { publicId: memberPublicId },
    select: { id: true, publicId: true, fullName: true, gender: true, dob: true },
  });
  if (!member) throw ApiError.notFound(`No member found for ID ${memberPublicId}`);
  return {
    memberId: member.id,
    publicId: member.publicId,
    name: member.fullName,
    gender: member.gender,
    age: member.dob ? calculateAge(member.dob) : null,
  };
}

// -----------------------------------------------------------------------------
// Purchase flow (§5.9): category -> quantity -> seats -> attendee IDs -> gateway
// (ticket price only, NO convenience fee) -> confirm -> QR + notifications
// -----------------------------------------------------------------------------

export async function purchaseTickets(input: {
  eventId: string;
  ticketCategoryId: string;
  buyerMemberId: string;
  attendees: { memberPublicId?: string; seatId?: string }[];
  paymentRef: string;
  idempotencyKey: string;
}) {
  // Idempotency: same key returns the previously issued tickets (§7)
  const existingGroup = await prisma.ticket.findFirst({ where: { bookingGroupId: input.idempotencyKey } });
  if (existingGroup) {
    return prisma.ticket.findMany({ where: { bookingGroupId: input.idempotencyKey }, include: { seat: true, ticketCategory: true } });
  }

  const category = await prisma.ticketCategory.findUnique({ where: { id: input.ticketCategoryId }, include: { event: true } });
  if (!category || category.deletedAt) throw ApiError.notFound('Ticket category not found');
  if (category.eventId !== input.eventId) throw ApiError.validation({ ticketCategoryId: ['Category does not belong to this event'] });

  const now = new Date();
  if (category.saleStartAt && now < category.saleStartAt) throw ApiError.conflict('Ticket sales have not started yet');
  if (category.saleEndAt && now > category.saleEndAt) throw ApiError.conflict('Ticket sales have ended');
  if (!['PUBLISHED', 'RSVP_SALES_OPEN', 'LIVE'].includes(category.event.status)) throw ApiError.conflict('Tickets are not on sale for this event');

  const sold = await prisma.ticket.count({ where: { ticketCategoryId: category.id, status: { in: ['PENDING_PAYMENT', 'PAYMENT_SUCCESSFUL', 'TICKET_GENERATED', 'CHECKED_IN'] } } });
  if (sold + input.attendees.length > category.capacity) throw ApiError.conflict('Not enough tickets remaining in this category');

  // Resolve attendee member IDs (guests may be blank per event policy §5.9)
  const resolvedAttendees = await Promise.all(
    input.attendees.map(async (a) => {
      if (!a.memberPublicId) return { attendee: null, seatId: a.seatId };
      const attendee = await validateAttendeeMemberId(a.memberPublicId);
      return { attendee, seatId: a.seatId };
    }),
  );

  const buyer = await prisma.member.findUniqueOrThrow({ where: { id: input.buyerMemberId } });

  const tickets = await prisma.$transaction(async (tx) => {
    const createdTickets = [];
    for (const { attendee, seatId } of resolvedAttendees) {
      const publicId = await nextPublicId('TICKET', tx);
      const qrToken = createSignedToken({
        purpose: 'EVENT_TICKET',
        id: publicId,
        eventId: input.eventId,
        bookingId: input.idempotencyKey,
        // No personal info in the QR payload (§4.5)
      });

      // Reserved seating: confirm the seat lock belongs to this checkout
      if (seatId) {
        await confirmSeatBooking(seatId, input.idempotencyKey, tx);
      }

      const ticket = await tx.ticket.create({
        data: {
          publicId,
          ticketCategoryId: category.id,
          eventId: input.eventId,
          bookingGroupId: input.idempotencyKey,
          buyerMemberId: input.buyerMemberId,
          attendeeMemberId: attendee?.memberId,
          attendeeName: attendee?.name,
          attendeeGender: attendee?.gender ?? undefined,
          attendeeAge: attendee?.age ?? undefined,
          seatId,
          status: 'TICKET_GENERATED', // gateway payment confirmed by paymentRef (§5.9: manual refunds only)
          qrToken,
          paymentRef: input.paymentRef,
          amount: category.price, // ticket price only, NO convenience fee
          currency: category.currency,
        },
      });
      createdTickets.push(ticket);
    }
    return createdTickets;
  });

  await enqueueNotification({
    userId: buyer.userId,
    templateKey: 'TICKET_CONFIRMED',
    category: 'SERVICE',
    to: { PUSH: buyer.userId, IN_APP: buyer.userId, EMAIL: buyer.email ?? undefined },
    body: `Your ${tickets.length} ticket(s) for ${category.event.title} are confirmed. QR codes are in My Tickets.`,
    data: { eventId: input.eventId, ticketIds: tickets.map((t) => t.publicId) },
  });

  return tickets;
}

// -----------------------------------------------------------------------------
// QR Scanner APIs (EVENT_SCANNER role, §5.9)
// -----------------------------------------------------------------------------

export async function scanTicket(qrToken: string, scannerStaffId: string | null, gate?: string) {
  const payload = verifySignedToken<{ purpose: 'EVENT_TICKET'; id: string; eventId: string }>(qrToken);
  if (!payload || payload.purpose !== 'EVENT_TICKET') {
    throw ApiError.validation({ qrToken: ['Invalid or tampered QR code'] });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { publicId: payload.id },
    include: {
      event: true,
      ticketCategory: { select: { name: true } },
      seat: { select: { label: true } },
      attendeeMember: { select: { publicId: true, fullName: true } },
      buyerMember: { select: { publicId: true, fullName: true } },
    },
  });

  if (!ticket) throw ApiError.notFound('Ticket not found');
  if (ticket.eventId !== payload.eventId) throw ApiError.validation({ qrToken: ['Ticket does not belong to this event'] });

  // Scan window: 24h before start until event end (§5.9)
  const now = new Date();
  const windowStart = new Date(ticket.event.startAt.getTime() - SCAN_WINDOW_HOURS_BEFORE_EVENT * 3600_000);
  if (now < windowStart) throw ApiError.conflict('Scanning opens 24 hours before the event starts');
  if (now > ticket.event.endAt) throw ApiError.conflict('Event has ended — scan window closed');

  if (!['TICKET_GENERATED', 'PAYMENT_SUCCESSFUL'].includes(ticket.status)) {
    if (ticket.status === 'CHECKED_IN') {
      // Duplicate scan (§5.9): "Ticket Already Used" + first scan time/gate/scanner
      const history = (ticket.scanHistory as any[]) ?? [];
      const firstScan = history[0];
      const updatedHistory = [...history, { at: now.toISOString(), gate, scannerStaffId, result: 'DUPLICATE' }];
      await prisma.ticket.update({ where: { id: ticket.id }, data: { scanHistory: updatedHistory as Prisma.InputJsonValue } });

      throw new ApiError('CONFLICT', `Ticket Already Used — first scanned at ${firstScan?.at ?? ticket.checkedInAt?.toISOString()}${firstScan?.gate ? `, gate ${firstScan.gate}` : ''}${firstScan?.scannerName ? `, by ${firstScan.scannerName}` : ''}`);
    }
    throw ApiError.conflict(`Ticket is not valid for entry (status: ${ticket.status})`);
  }

  let scannerName: string | undefined;
  if (scannerStaffId) {
    const scanner = await prisma.staff.findUnique({ where: { id: scannerStaffId }, include: { member: { select: { fullName: true } } } });
    scannerName = scanner?.member.fullName;
  }

  const scanEntry = { at: now.toISOString(), gate, scannerStaffId, scannerName, result: 'CHECKED_IN' };
  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      status: 'CHECKED_IN',
      checkedInAt: now,
      checkedInById: scannerStaffId,
      scanHistory: [scanEntry] as Prisma.InputJsonValue,
    },
  });

  // Scanner sees only what §5.9 permits: name, member ID, category, seat, booking ID, status
  return {
    valid: true,
    ticketPublicId: updated.publicId,
    memberName: ticket.attendeeMember?.fullName ?? ticket.attendeeName ?? ticket.buyerMember.fullName,
    memberPublicId: ticket.attendeeMember?.publicId ?? ticket.buyerMember.publicId,
    category: ticket.ticketCategory.name,
    seat: ticket.seat?.label ?? null,
    bookingId: ticket.bookingGroupId,
    status: 'CHECKED_IN' as const,
    checkedInAt: now,
  };
}

/** Manual refund marking — Super Admin only (§5.9: "Refunds are manual"). */
export async function markRefunded(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw ApiError.notFound('Ticket not found');
  return prisma.ticket.update({ where: { id: ticketId }, data: { status: 'REFUNDED_MANUAL' } });
}

export async function getTicketStatusHistory(ticketPublicId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { publicId: ticketPublicId },
    include: { event: { select: { title: true } }, ticketCategory: { select: { name: true } } },
  });
  if (!ticket) throw ApiError.notFound('Ticket not found');
  return ticket;
}

/** Realtime attendance counts for event dashboards. */
export async function eventAttendance(eventId: string) {
  const [total, checkedIn] = await Promise.all([
    prisma.ticket.count({ where: { eventId, status: { in: ['TICKET_GENERATED', 'CHECKED_IN'] } } }),
    prisma.ticket.count({ where: { eventId, status: 'CHECKED_IN' } }),
  ]);
  return { total, checkedIn, pct: total > 0 ? Math.round((checkedIn / total) * 100) : 0 };
}
