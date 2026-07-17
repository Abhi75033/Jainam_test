import { SupportTicketType, TicketStatusGeneric } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { nextPublicId } from '@/engines/idGenerator/id.service';
import { enqueueNotification } from '@/engines/notification/notification.service';

/**
 * Support Ticket module (§5.9): paid-event requests, event-delete requests
 * from admins, calendar corrections, incorrect-info reports. Lifecycle:
 * OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED, worked from a Super Admin queue.
 */

export async function raiseTicket(input: {
  type: SupportTicketType;
  raisedByUserId: string;
  organizationId?: string;
  subject: string;
  description?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}) {
  const publicId = await prisma.$transaction((tx) => nextPublicId('SUPPORT_TICKET', tx));
  return prisma.supportTicket.create({ data: { publicId, ...input } });
}

export async function updateTicketStatus(ticketId: string, status: TicketStatusGeneric, actorUserId: string, resolution?: string) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw ApiError.notFound('Support ticket not found');

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status, resolution, assignedToUserId: actorUserId },
  });

  await enqueueNotification({
    userId: ticket.raisedByUserId,
    templateKey: 'SUPPORT_TICKET_UPDATED',
    category: 'SERVICE',
    to: { PUSH: ticket.raisedByUserId, IN_APP: ticket.raisedByUserId },
    body: `Your support ticket ${ticket.publicId} is now ${status.replace('_', ' ').toLowerCase()}.${resolution ? ` Resolution: ${resolution}` : ''}`,
  });

  return updated;
}

/** Super Admin queue. */
export async function listTickets(filters: { status?: TicketStatusGeneric; type?: SupportTicketType; page: number; pageSize: number }) {
  const where: any = {};
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;

  const [total, rows] = await Promise.all([
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.findMany({
      where,
      include: { organization: { select: { name: true, publicId: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);

  const userIds = Array.from(new Set(rows.map((r) => r.raisedByUserId)));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true, mobile: true },
  });
  const usersMap = new Map(users.map((u) => [u.id, u]));

  const rowsWithUser = rows.map((r) => ({
    ...r,
    raisedByUser: usersMap.get(r.raisedByUserId) || null,
  }));

  return { total, rows: rowsWithUser };
}

/** Member/admin-side tracking of their own tickets. */
export async function listMyTickets(raisedByUserId: string) {
  const rows = await prisma.supportTicket.findMany({
    where: { raisedByUserId },
    include: { organization: { select: { name: true, publicId: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const user = await prisma.user.findUnique({
    where: { id: raisedByUserId },
    select: { id: true, firstName: true, lastName: true, mobile: true },
  });

  return rows.map((r) => ({
    ...r,
    raisedByUser: user || null,
  }));
}
