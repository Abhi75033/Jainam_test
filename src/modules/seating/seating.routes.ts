import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import * as seatingService from './seating.service';

const createLayoutSchema = z.object({
  body: z.object({
    sections: z
      .array(
        z.object({
          name: z.string().min(1),
          mode: z.enum(['OPEN', 'RESERVED']),
          rows: z.array(z.object({ name: z.string().min(1), seats: z.array(z.string().min(1)).min(1) })),
        }),
      )
      .min(1),
  }),
});

const lockSeatSchema = z.object({ body: z.object({ checkoutSessionId: z.string().min(8) }) });
const releaseSeatSchema = z.object({ body: z.object({ lockToken: z.string().min(8) }) });

const createSectionSchema = z.object({
  body: z.object({ eventId: z.string().min(1), name: z.string().min(1), mode: z.enum(['OPEN', 'RESERVED']).default('OPEN') }),
});
const createRowSchema = z.object({ body: z.object({ label: z.string().min(1) }) });
const createSeatsSchema = z.object({ body: z.object({ count: z.number().int().min(1).max(500) }) });

export const seatingRoutes = Router();

// Layout management — Super Admin (paid events are Super Admin-created)
seatingRoutes.post(
  '/events/:eventId/layout',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  validate(createLayoutSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const sections = await seatingService.createSeatingLayout(req.params.eventId as string, req.body.sections);
    return created(res, sections);
  }),
);

seatingRoutes.get(
  '/events/:eventId/seat-map',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const map = await seatingService.getSeatMap(req.params.eventId as string);
    return ok(res, map);
  }),
);

// Admin-panel alias: wraps the seat map in { sections } with row `label` fields
seatingRoutes.get(
  '/event/:eventId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const sections = await seatingService.getSeatMap(req.params.eventId as string);
    return ok(res, {
      sections: sections.map((s) => ({
        id: s.id,
        name: s.name,
        mode: s.mode,
        rows: s.rows.map((r) => ({ id: r.id, label: r.name, seats: r.seats })),
      })),
    });
  }),
);

// Incremental layout builder used by the admin panel (sections → rows → seats)
seatingRoutes.post(
  '/sections',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  validate(createSectionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const section = await seatingService.createSection(req.body.eventId, req.body.name, req.body.mode);
    return created(res, section);
  }),
);

seatingRoutes.post(
  '/sections/:sectionId/rows',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  validate(createRowSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const row = await seatingService.createRow(req.params.sectionId as string, req.body.label);
    return created(res, row);
  }),
);

seatingRoutes.post(
  '/rows/:rowId/seats',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  validate(createSeatsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const seats = await seatingService.addSeatsToRow(req.params.rowId as string, req.body.count);
    return created(res, seats);
  }),
);

// Seat locking during checkout (Redis TTL locks, §5.9).
// Super Admins may lock/release without a checkout session (manual blocking).
seatingRoutes.post(
  '/seats/:seatId/lock',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.body?.checkoutSessionId && req.actor!.isSuperAdmin) {
      const seat = await seatingService.adminLockSeat(req.params.seatId as string);
      return ok(res, seat);
    }
    lockSeatSchema.parse({ body: req.body });
    const lock = await seatingService.lockSeat(req.params.seatId as string, req.body.checkoutSessionId);
    return ok(res, lock);
  }),
);

seatingRoutes.post(
  '/seats/:seatId/release',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.body?.lockToken && req.actor!.isSuperAdmin) {
      const seat = await seatingService.adminReleaseSeat(req.params.seatId as string);
      return ok(res, seat);
    }
    releaseSeatSchema.parse({ body: req.body });
    await seatingService.releaseSeat(req.params.seatId as string, req.body.lockToken);
    return ok(res, { released: true });
  }),
);
