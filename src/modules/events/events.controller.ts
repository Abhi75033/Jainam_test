import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import * as eventsService from './events.service';
import { prisma } from '@/config/prisma';
import { recordAudit, auditContextFromRequest } from '@/engines/audit/audit.service';

async function requireMember(userId: string) {
  const member = await prisma.member.findUnique({ where: { userId } });
  if (!member) throw ApiError.notFound('Member profile not found');
  return member;
}

export const createEvent = asyncHandler(async (req: Request, res: Response) => {
  const event = await eventsService.createEvent({
    ...req.body,
    createdById: req.actor!.userId,
    actorIsSuperAdmin: req.actor!.isSuperAdmin,
  });
  await recordAudit({ ...auditContextFromRequest(req), organizationId: event.organizationId, module: 'EVENTS', action: 'CREATE', entityType: 'Event', entityId: event.id, after: event });
  return created(res, event);
});

export const updateEvent = asyncHandler(async (req: Request, res: Response) => {
  const existing = await eventsService.getEvent(req.params.eventId as string);
  if (['COMPLETED', 'GALLERY_UPLOADED', 'ARCHIVED'].includes(existing.status) && !req.actor!.isSuperAdmin) {
    throw ApiError.forbidden('Completed events are locked for organization admins');
  }
  const { visibilityConfig, attachments, ...rest } = req.body;
  const event = await prisma.event.update({
    where: { id: existing.id },
    data: { ...rest, visibilityConfig, attachments, updatedById: req.actor!.userId },
  });
  await recordAudit({ ...auditContextFromRequest(req), organizationId: event.organizationId, module: 'EVENTS', action: 'EDIT', entityType: 'Event', entityId: event.id, before: existing, after: event });

  // Event updated -> notify RSVP + ticket holders (§4.3)
  const [rsvps, tickets] = await Promise.all([
    prisma.eventRsvp.findMany({ where: { eventId: event.id, status: 'CONFIRMED' }, include: { member: { select: { userId: true } } } }),
    prisma.ticket.findMany({ where: { eventId: event.id, status: { in: ['TICKET_GENERATED', 'CHECKED_IN'] } }, include: { buyerMember: { select: { userId: true } } } }),
  ]);
  const userIds = new Set([...rsvps.map((r) => r.member.userId), ...tickets.map((t) => t.buyerMember.userId)]);
  const { enqueueNotification } = await import('@/engines/notification/notification.service');
  await Promise.all(
    Array.from(userIds).map((userId) =>
      enqueueNotification({
        userId,
        templateKey: 'EVENT_UPDATED',
        category: 'SERVICE',
        to: { PUSH: userId, IN_APP: userId },
        body: `${event.title} has been updated. Check the latest details in the app.`,
      }),
    ),
  );

  return ok(res, event);
});

export const transitionEvent = asyncHandler(async (req: Request, res: Response) => {
  const event = await eventsService.transitionEvent(req.params.eventId as string, req.body.status, {
    userId: req.actor!.userId,
    isSuperAdmin: req.actor!.isSuperAdmin,
  });
  return ok(res, event);
});

export const getEvent = asyncHandler(async (req: Request, res: Response) => {
  const event = await eventsService.getEvent(req.params.eventId as string);
  // Draft visible to creator only (§5.9)
  if (event.status === 'DRAFT' && event.createdById !== req.actor!.userId && !req.actor!.isSuperAdmin) {
    throw ApiError.notFound('Event not found');
  }
  return ok(res, event);
});

export const memberEvents = asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const rows = await eventsService.memberEvents(member.id, req.query as any);
  return ok(res, rows);
});

export const rsvp = asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const row = await eventsService.rsvp(req.params.eventId as string, member.id, req.body.attendeeCount);
  return created(res, row);
});

export const cancelRsvp = asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const result = await eventsService.cancelRsvp(req.params.eventId as string, member.id);
  return ok(res, result);
});

export const addGalleryImages = asyncHandler(async (req: Request, res: Response) => {
  const images = await eventsService.addGalleryImages(req.params.eventId as string, req.body.imageUrls);
  return created(res, images);
});

export const addVideoLink = asyncHandler(async (req: Request, res: Response) => {
  const link = await eventsService.addVideoLink(req.params.eventId as string, req.body.url);
  return created(res, link);
});

export const submitFeedback = asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const feedback = await eventsService.submitFeedback(req.params.eventId as string, member.id, req.body.rating, req.body.comment);
  return created(res, feedback);
});

export const cancelEvent = asyncHandler(async (req: Request, res: Response) => {
  const event = await eventsService.cancelEvent(req.params.eventId as string, req.body.reason, req.body.refundPolicyNote, {
    userId: req.actor!.userId,
    isSuperAdmin: req.actor!.isSuperAdmin,
  });
  await recordAudit({ ...auditContextFromRequest(req), organizationId: event.organizationId, module: 'EVENTS', action: 'CANCEL', entityType: 'Event', entityId: event.id, after: { cancellationReason: event.cancellationReason }, isCritical: true });
  return ok(res, event);
});

export const listRsvps = asyncHandler(async (req: Request, res: Response) => {
  const rows = await prisma.eventRsvp.findMany({
    where: { eventId: req.params.eventId as string },
    include: { member: { select: { publicId: true, fullName: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return ok(res, rows);
});

export const exportRsvps = asyncHandler(async (req: Request, res: Response) => {
  const rows = await prisma.eventRsvp.findMany({
    where: { eventId: req.params.eventId as string },
    include: { member: { select: { publicId: true, fullName: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const { sendListExport, parseExportFormat } = await import('@/utils/listExport');
  return sendListExport(
    res,
    parseExportFormat(req.query.format),
    'Event RSVP List',
    rows.map((r) => ({
      member: `${r.member.fullName} (${r.member.publicId})`,
      attendees: r.attendeeCount,
      status: r.status,
      waitingPosition: r.waitingListPosition ?? '',
      rsvpAt: r.createdAt.toISOString(),
    })),
    [
      { key: 'member', header: 'Member' },
      { key: 'attendees', header: 'Attendees' },
      { key: 'status', header: 'Status' },
      { key: 'waitingPosition', header: 'Waiting #' },
      { key: 'rsvpAt', header: 'RSVP At' },
    ],
  );
});

export const orgDashboard = asyncHandler(async (req: Request, res: Response) => {
  const stats = await eventsService.orgEventDashboard(req.params.organizationId as string);
  return ok(res, stats);
});

export const platformDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await eventsService.platformEventDashboard();
  return ok(res, stats);
});
