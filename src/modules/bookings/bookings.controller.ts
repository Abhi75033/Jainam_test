import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import * as bookingsService from './bookings.service';
import { prisma } from '@/config/prisma';
import { recordAudit, auditContextFromRequest } from '@/engines/audit/audit.service';

async function requireMember(userId: string) {
  const member = await prisma.member.findUnique({ where: { userId } });
  if (!member) throw ApiError.notFound('Member profile not found');
  return member;
}

export const createBookingItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await bookingsService.createBookingItem({ ...req.body, createdById: req.actor!.userId });
  return created(res, item);
});

export const updateBookingItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await bookingsService.updateBookingItem(req.params.itemId as string, req.body, req.actor!.userId);
  return ok(res, item);
});

export const addBlackoutDate = asyncHandler(async (req: Request, res: Response) => {
  const row = await bookingsService.addBlackoutDate(req.params.itemId as string, req.body.date, req.body.reason);
  return created(res, row);
});

export const addInternalReservation = asyncHandler(async (req: Request, res: Response) => {
  const row = await bookingsService.addInternalReservation(req.params.itemId as string, req.body, req.actor!.userId);
  return created(res, row);
});

export const removeInternalReservation = asyncHandler(async (req: Request, res: Response) => {
  await bookingsService.removeInternalReservation(req.params.reservationId as string);
  return ok(res, { removed: true });
});

export const availabilityCalendar = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = req.query as unknown as { from: Date; to: Date };
  const isAdmin = req.actor!.isSuperAdmin || (req.actor!.permissions.BOOKINGS ?? []).includes('APPROVE');
  const calendar = await bookingsService.getAvailabilityCalendar(req.params.itemId as string, from, to, { isAdmin });
  return ok(res, calendar);
});

export const submitBooking = asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const booking = await bookingsService.submitBooking(member.id, req.body);
  return created(res, booking);
});

export const decideBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await bookingsService.decideBooking(req.params.bookingId as string, req.body.decision, req.actor!.userId, req.body.reason);
  await recordAudit({
    ...auditContextFromRequest(req),
    organizationId: booking.organizationId,
    module: 'BOOKINGS',
    action: `BOOKING_${req.body.decision}`,
    entityType: 'Booking',
    entityId: booking.id,
    after: { status: booking.status },
    isCritical: true,
  });
  return ok(res, booking);
});

export const submitPaymentProof = asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const booking = await bookingsService.submitPaymentProof(req.params.bookingId as string, member.id, req.body);
  return ok(res, booking);
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const booking = await bookingsService.verifyPayment(req.params.bookingId as string, req.body.decision, req.actor!.userId, req.body.reason);
  await recordAudit({
    ...auditContextFromRequest(req),
    organizationId: booking.organizationId,
    module: 'BOOKINGS',
    action: `PAYMENT_${req.body.decision}`,
    entityType: 'Booking',
    entityId: booking.id,
    after: { status: booking.status },
    isCritical: true,
  });
  return ok(res, booking);
});

export const myBookings = asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const query = req.query as unknown as Parameters<typeof bookingsService.listMyBookings>[1];
  const { total, rows } = await bookingsService.listMyBookings(member.id, query);
  return ok(res, rows, { total, page: query.page, pageSize: query.pageSize });
});

export const getBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await bookingsService.getBookingWithTimeline(req.params.bookingId as string);
  const isOwner = booking.member.userId === req.actor!.userId;
  const isOrgAdmin = req.actor!.isSuperAdmin || req.actor!.organizationIds.includes(booking.organizationId);
  if (!isOwner && !isOrgAdmin) throw ApiError.tenantScope();
  return ok(res, booking);
});

export const orgBookings = asyncHandler(async (req: Request, res: Response) => {
  const { status, page = 1, pageSize = 20 } = req.query as any;
  const { total, rows } = await bookingsService.listOrgBookings(req.params.organizationId as string, { status, page: Number(page), pageSize: Number(pageSize) });
  return ok(res, rows, { total });
});
