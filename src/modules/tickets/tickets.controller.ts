import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import * as ticketsService from './tickets.service';
import { prisma } from '@/config/prisma';

async function requireMember(userId: string) {
  const member = await prisma.member.findUnique({ where: { userId } });
  if (!member) throw ApiError.notFound('Member profile not found');
  return member;
}

export const createTicketCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await ticketsService.createTicketCategory(req.params.eventId as string, req.body);
  return created(res, category);
});

export const validateAttendee = asyncHandler(async (req: Request, res: Response) => {
  const attendee = await ticketsService.validateAttendeeMemberId(req.query.memberPublicId as string);
  return ok(res, attendee);
});

export const purchaseTickets = asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const tickets = await ticketsService.purchaseTickets({
    eventId: req.params.eventId as string,
    ticketCategoryId: req.body.ticketCategoryId,
    buyerMemberId: member.id,
    attendees: req.body.attendees,
    paymentRef: req.body.paymentRef,
    idempotencyKey: req.body.idempotencyKey,
  });
  return created(res, tickets);
});

export const scanTicket = asyncHandler(async (req: Request, res: Response) => {
  // EVENT_SCANNER may or may not have a staff profile; pass null if none
  const staff = await prisma.staff.findUnique({ where: { userId: req.actor!.userId } });
  const result = await ticketsService.scanTicket(req.body.qrToken, staff?.id ?? null, req.body.gate);
  return ok(res, result);
});

export const markRefunded = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await ticketsService.markRefunded(req.params.ticketId as string);
  return ok(res, ticket);
});

export const ticketHistory = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await ticketsService.getTicketStatusHistory(req.params.ticketPublicId as string);
  const isOwner = await prisma.member.findFirst({ where: { userId: req.actor!.userId, OR: [{ ticketsBought: { some: { publicId: ticket.publicId } } }, { ticketsAttending: { some: { publicId: ticket.publicId } } }] } });
  if (!isOwner && !req.actor!.isSuperAdmin) throw ApiError.forbidden('Ticket history is visible to the ticket holder and Super Admin only');
  return ok(res, ticket);
});

export const attendance = asyncHandler(async (req: Request, res: Response) => {
  const stats = await ticketsService.eventAttendance(req.params.eventId as string);
  return ok(res, stats);
});
