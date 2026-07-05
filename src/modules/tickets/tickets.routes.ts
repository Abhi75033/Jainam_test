import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { createTicketCategorySchema, purchaseTicketsSchema, scanTicketSchema } from '@/modules/events/events.dto';
import * as ticketsController from './tickets.controller';

const attendeeLookupSchema = z.object({ query: z.object({ memberPublicId: z.string().min(1) }) });

export const ticketRoutes = Router();

// Ticket categories — Super Admin only, since only Super Admin creates paid events (§5.9)
ticketRoutes.post('/events/:eventId/categories', requireAuth, requireRole('SUPER_ADMIN'), validate(createTicketCategorySchema), ticketsController.createTicketCategory);

// Attendee member-ID validation during checkout (§5.9)
ticketRoutes.get('/validate-attendee', requireAuth, validate(attendeeLookupSchema), ticketsController.validateAttendee);

// Purchase (gateway payment ref + idempotency key)
ticketRoutes.post('/events/:eventId/purchase', requireAuth, validate(purchaseTicketsSchema), ticketsController.purchaseTickets);

// Scanner APIs — EVENT_SCANNER role (also usable by Super Admin) (§5.9)
ticketRoutes.post('/scan', requireAuth, requireRole('EVENT_SCANNER'), validate(scanTicketSchema), ticketsController.scanTicket);
ticketRoutes.get('/events/:eventId/attendance', requireAuth, requireRole('EVENT_SCANNER', 'TEMPLE_ADMIN', 'JAIN_CENTER_ADMIN', 'DHARAMSHALA_ADMIN'), ticketsController.attendance);

// Manual refund marking — Super Admin only (§5.9)
ticketRoutes.post('/:ticketId/refund', requireAuth, requireRole('SUPER_ADMIN'), ticketsController.markRefunded);

// Status history — member (own) + Super Admin (§5.9)
ticketRoutes.get('/:ticketPublicId/history', requireAuth, ticketsController.ticketHistory);
