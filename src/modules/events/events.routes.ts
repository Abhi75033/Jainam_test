import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, requirePermission, scopeToOrganization } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import {
  createEventSchema,
  updateEventSchema,
  rsvpSchema,
  eventFeedbackSchema,
  addGalleryImagesSchema,
  addVideoLinkSchema,
  memberEventsQuerySchema,
} from './events.dto';
import * as eventsController from './events.controller';

const transitionSchema = z.object({
  body: z.object({ status: z.enum(['DRAFT', 'PUBLISHED', 'RSVP_SALES_OPEN', 'LIVE', 'COMPLETED', 'GALLERY_UPLOADED', 'ARCHIVED']) }),
});

const cancelSchema = z.object({
  body: z.object({ reason: z.string().min(1), refundPolicyNote: z.string().optional() }),
});

export const eventRoutes = Router();

// List endpoints — must be defined BEFORE /:eventId to avoid route conflicts
eventRoutes.get('/', requireAuth, requireRole('SUPER_ADMIN'), eventsController.listAllEvents);
eventRoutes.get('/org/:organizationId', requireAuth, requirePermission('EVENTS', 'VIEW'), scopeToOrganization, eventsController.listOrgEvents);

// Creation: free events by org admins with EVENTS:CREATE; paid events blocked
// for non-Super-Admin inside the service with the "raise support ticket" message (§5.9)
eventRoutes.post('/', requireAuth, requirePermission('EVENTS', 'CREATE'), scopeToOrganization, validate(createEventSchema), eventsController.createEvent);
eventRoutes.get('/member', requireAuth, validate(memberEventsQuerySchema), eventsController.memberEvents);
eventRoutes.get('/:eventId', requireAuth, eventsController.getEvent);
eventRoutes.patch('/:eventId', requireAuth, requirePermission('EVENTS', 'EDIT'), validate(updateEventSchema), eventsController.updateEvent);
eventRoutes.post('/:eventId/transition', requireAuth, requirePermission('EVENTS', 'EDIT'), validate(transitionSchema), eventsController.transitionEvent);
eventRoutes.post('/:eventId/cancel', requireAuth, requirePermission('EVENTS', 'EDIT'), validate(cancelSchema), eventsController.cancelEvent);
eventRoutes.get('/:eventId/rsvps', requireAuth, requirePermission('EVENTS', 'VIEW'), eventsController.listRsvps);
eventRoutes.get('/:eventId/rsvps/export', requireAuth, requirePermission('EVENTS', 'VIEW'), eventsController.exportRsvps);

// RSVP
eventRoutes.post('/:eventId/rsvp', requireAuth, validate(rsvpSchema), eventsController.rsvp);
eventRoutes.post('/:eventId/rsvp/cancel', requireAuth, eventsController.cancelRsvp);

// Post-event
eventRoutes.post('/:eventId/gallery', requireAuth, requirePermission('GALLERY', 'CREATE'), validate(addGalleryImagesSchema), eventsController.addGalleryImages);
eventRoutes.post('/:eventId/video-links', requireAuth, requirePermission('GALLERY', 'CREATE'), validate(addVideoLinkSchema), eventsController.addVideoLink);
eventRoutes.post('/:eventId/feedback', requireAuth, validate(eventFeedbackSchema), eventsController.submitFeedback);
eventRoutes.get('/:eventId/feedback', requireAuth, requirePermission('EVENTS', 'VIEW'), eventsController.listFeedback);

// Dashboards
eventRoutes.get('/dashboard/org/:organizationId', requireAuth, requirePermission('DASHBOARD', 'VIEW'), scopeToOrganization, eventsController.orgDashboard);
eventRoutes.get('/dashboard/platform', requireAuth, requireRole('SUPER_ADMIN'), eventsController.platformDashboard);
