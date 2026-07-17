import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import * as supportService from './ticketsSupport.service';

const raiseTicketSchema = z.object({
  body: z.object({
    type: z.enum(['PAID_EVENT_REQUEST', 'EVENT_DELETE_REQUEST', 'CALENDAR_CORRECTION', 'INCORRECT_INFO', 'OTHER']),
    organizationId: z.string().optional(),
    subject: z.string().min(1),
    description: z.string().optional(),
    relatedEntityType: z.string().optional(),
    relatedEntityId: z.string().optional(),
  }),
});

const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
    resolution: z.string().optional(),
  }),
});

const listQuerySchema = z.object({
  query: z.object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
    type: z.enum(['PAID_EVENT_REQUEST', 'EVENT_DELETE_REQUEST', 'CALENDAR_CORRECTION', 'INCORRECT_INFO', 'OTHER']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const ticketsSupportRoutes = Router();

ticketsSupportRoutes.post(
  '/',
  requireAuth,
  validate(raiseTicketSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const nonAdminOrSuperRoles = ['MEMBER', 'NON_JAIN_MEMBER', 'SUPER_ADMIN'];
    if (nonAdminOrSuperRoles.includes(req.actor!.role)) {
      throw ApiError.forbidden('Only administrators (excluding Super Admin) can raise support tickets.');
    }
    const ticket = await supportService.raiseTicket({ ...req.body, raisedByUserId: req.actor!.userId });
    return created(res, ticket);
  }),
);

ticketsSupportRoutes.get(
  '/my',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const tickets = await supportService.listMyTickets(req.actor!.userId);
    return ok(res, tickets);
  }),
);

// Role-aware root list: Super Admin sees the full queue, everyone else their own tickets
ticketsSupportRoutes.get(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    if (req.actor!.isSuperAdmin) {
      const { rows, total } = await supportService.listTickets({ page: 1, pageSize: 100 });
      return ok(res, rows, { total });
    }
    const tickets = await supportService.listMyTickets(req.actor!.userId);
    return ok(res, tickets);
  }),
);

// Super Admin queue + actions (§5.9)
ticketsSupportRoutes.get(
  '/queue',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  validate(listQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { total, rows } = await supportService.listTickets(req.query as any);
    return ok(res, rows, { total });
  }),
);

ticketsSupportRoutes.patch(
  '/:ticketId/status',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  validate(updateStatusSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const ticket = await supportService.updateTicketStatus(req.params.ticketId as string, req.body.status, req.actor!.userId, req.body.resolution);
    return ok(res, ticket);
  }),
);
