import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, requirePermission } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';
import * as calendarService from './calendar.service';

const upsertEntriesSchema = z.object({
  body: z.object({
    year: z.number().int(),
    entries: z
      .array(z.object({ gregorianDate: z.coerce.date(), tithiName: z.string().min(1), description: z.string().optional() }))
      .min(1)
      .max(366),
  }),
});

const correctionTicketSchema = z.object({
  body: z.object({
    raisedByOrgId: z.string().optional(),
    calendarTypeId: z.string().min(1),
    date: z.coerce.date(),
    issue: z.string().min(1),
  }),
});

const correctionDecisionSchema = z.object({
  body: z.object({ status: z.enum(['IN_PROGRESS', 'RESOLVED', 'CLOSED']), resolution: z.string().optional() }),
});

export const calendarRoutes = Router();

// Super Admin: per-type per-year entries (§5.17)
calendarRoutes.put('/types/:calendarTypeId/entries', requireAuth, requireRole('SUPER_ADMIN'), validate(upsertEntriesSchema), asyncHandler(async (req: Request, res: Response) => {
  const count = await calendarService.upsertEntries(req.params.calendarTypeId as string, req.body.year, req.body.entries);
  return ok(res, { entriesForYear: count });
}));

calendarRoutes.get('/types', requireAuth, asyncHandler(async (_req: Request, res: Response) => {
  const types = await prisma.tithiCalendarType.findMany({ where: { deletedAt: null } });
  return ok(res, types);
}));

// Member endpoints: today's tithi (own calendar, or peek another type via ?typeId=)
calendarRoutes.get('/today', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  let calendarTypeId = req.query.typeId as string | undefined;
  if (!calendarTypeId) {
    const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });
    calendarTypeId = member?.tithiCalendarTypeId ?? undefined;
  }
  if (!calendarTypeId) throw ApiError.validation({ typeId: ['Select a tithi calendar in settings or pass ?typeId='] });
  const entry = await calendarService.todaysTithi(calendarTypeId);
  return ok(res, entry ?? { message: 'No tithi available' });
}));

calendarRoutes.get('/month', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { typeId, year, month } = req.query as any;
  if (!typeId || !year || !month) throw ApiError.validation({ query: ['typeId, year, month are required'] });
  const entries = await calendarService.monthView(String(typeId), Number(year), Number(month));
  return ok(res, entries);
}));

// Member changes their calendar (immediately affects notifications + views §5.17)
calendarRoutes.patch('/my-calendar', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { typeId } = req.body as { typeId?: string };
  if (!typeId) throw ApiError.validation({ typeId: ['typeId is required'] });
  const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });
  if (!member) throw ApiError.notFound('Member profile not found');
  const updated = await prisma.member.update({ where: { id: member.id }, data: { tithiCalendarTypeId: typeId } });
  return ok(res, { tithiCalendarTypeId: updated.tithiCalendarTypeId });
}));

// Correction tickets: temple admin raises -> Super Admin decides (§5.17)
calendarRoutes.post('/correction-tickets', requireAuth, requirePermission('CALENDAR', 'VIEW'), validate(correctionTicketSchema), asyncHandler(async (req: Request, res: Response) => {
  const ticket = await calendarService.raiseCorrectionTicket(req.body);
  return created(res, ticket);
}));

calendarRoutes.get('/correction-tickets', requireAuth, requireRole('SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const tickets = await calendarService.listCorrectionTickets(req.query.status as any);
  return ok(res, tickets);
}));

calendarRoutes.patch('/correction-tickets/:ticketId', requireAuth, requireRole('SUPER_ADMIN'), validate(correctionDecisionSchema), asyncHandler(async (req: Request, res: Response) => {
  const ticket = await calendarService.decideCorrectionTicket(req.params.ticketId as string, req.body.status, req.body.resolution);
  return ok(res, ticket);
}));
