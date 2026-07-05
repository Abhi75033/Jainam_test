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

// Seat locking during checkout (Redis TTL locks, §5.9)
seatingRoutes.post(
  '/seats/:seatId/lock',
  requireAuth,
  validate(lockSeatSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const lock = await seatingService.lockSeat(req.params.seatId as string, req.body.checkoutSessionId);
    return ok(res, lock);
  }),
);

seatingRoutes.post(
  '/seats/:seatId/release',
  requireAuth,
  validate(releaseSeatSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await seatingService.releaseSeat(req.params.seatId as string, req.body.lockToken);
    return ok(res, { released: true });
  }),
);
