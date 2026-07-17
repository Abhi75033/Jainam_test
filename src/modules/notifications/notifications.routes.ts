import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';
import { markNotificationOpened } from '@/engines/notification/notification.service';

const prefSchema = z.object({
  body: z.object({
    channel: z.enum(['PUSH', 'WHATSAPP', 'SMS', 'EMAIL', 'IN_APP']),
    category: z.enum(['SERVICE', 'MARKETING']),
    enabled: z.boolean(),
  }),
});

export const notificationRoutes = Router();

// In-app notification inbox (from NotificationLog)
notificationRoutes.get('/my', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, pageSize = 30 } = req.query as any;
  const where = { recipientUserId: req.actor!.userId, channel: 'IN_APP' };
  const [total, rows] = await Promise.all([
    prisma.notificationLog.count({ where }),
    prisma.notificationLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (Number(page) - 1) * Number(pageSize), take: Number(pageSize) }),
  ]);
  return ok(res, rows, { total });
}));

// Mark opened — powers "Notification Sent / Opened" analytics (§4.3)
notificationRoutes.post('/:notificationId/opened', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const log = await prisma.notificationLog.findUnique({ where: { id: req.params.notificationId as string } });
  if (!log || log.recipientUserId !== req.actor!.userId) throw ApiError.notFound('Notification not found');
  await markNotificationOpened(log.id);
  return ok(res, { opened: true });
}));

// Channel preferences (service vs marketing separately, §5.2)
notificationRoutes.get('/preferences', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });
  if (!member) return ok(res, []); // accounts without a member profile have no preferences
  const prefs = await prisma.memberNotificationPreference.findMany({ where: { memberId: member.id } });
  return ok(res, prefs);
}));

notificationRoutes.put('/preferences', requireAuth, validate(prefSchema), asyncHandler(async (req: Request, res: Response) => {
  const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });
  if (!member) throw ApiError.notFound('Member profile not found');
  const pref = await prisma.memberNotificationPreference.upsert({
    where: { memberId_channel_category: { memberId: member.id, channel: req.body.channel, category: req.body.category } },
    update: { enabled: req.body.enabled },
    create: { memberId: member.id, channel: req.body.channel, category: req.body.category, enabled: req.body.enabled },
  });
  return ok(res, pref);
}));

// ─── Broadcast / "Send Reminder" (Dashboard quick action, §4.3) ───────────────
const broadcastSchema = z.object({
  body: z.object({
    message: z.string().min(1).max(1000),
    targetAudience: z.enum(['ALL', 'VOLUNTEERS_ONLY', 'ACTIVE_MEMBERS', 'INACTIVE_MEMBERS', 'TEMPLE_ADMINS']).default('ALL'),
    channel: z.enum(['IN_APP', 'PUSH', 'EMAIL', 'WHATSAPP', 'SMS']).default('IN_APP'),
  }),
});

notificationRoutes.post('/broadcast', requireAuth, validate(broadcastSchema), asyncHandler(async (req: Request, res: Response) => {
  if (!req.actor!.isSuperAdmin) throw ApiError.forbidden('Only Super Admins can broadcast notifications');

  const { message, targetAudience, channel } = req.body;
  const { enqueueNotification } = await import('@/engines/notification/notification.service');

  // Resolve target user IDs based on audience
  let userIds: string[] = [];

  if (targetAudience === 'ALL' || targetAudience === 'ACTIVE_MEMBERS') {
    const members = await prisma.member.findMany({
      where: targetAudience === 'ACTIVE_MEMBERS' ? { status: 'ACTIVE' } : {},
      select: { userId: true },
    });
    userIds = members.map((m) => m.userId);
  } else if (targetAudience === 'INACTIVE_MEMBERS') {
    const members = await prisma.member.findMany({ where: { status: 'INACTIVE' }, select: { userId: true } });
    userIds = members.map((m) => m.userId);
  } else if (targetAudience === 'VOLUNTEERS_ONLY') {
    const members = await prisma.member.findMany({ where: { isVolunteer: true }, select: { userId: true } });
    userIds = members.map((m) => m.userId);
  } else if (targetAudience === 'TEMPLE_ADMINS') {
    const admins = await prisma.user.findMany({
      where: { primaryRoleKey: { in: ['TEMPLE_ADMIN', 'DHARAMSHALA_ADMIN', 'JAIN_CENTER_ADMIN'] } },
      select: { id: true },
    });
    userIds = admins.map((a) => a.id);
  }

  // Enqueue in batches of 50 to avoid overwhelming the queue
  const BATCH = 50;
  let queued = 0;
  for (let i = 0; i < userIds.length; i += BATCH) {
    const batch = userIds.slice(i, i + BATCH);
    await Promise.all(
      batch.map((userId) =>
        enqueueNotification({
          userId,
          templateKey: 'ADMIN_BROADCAST',
          category: 'SERVICE',
          to: { [channel]: userId } as any,
          body: message,
        }).catch(() => {}), // swallow individual failures so batch continues
      ),
    );
    queued += batch.length;
  }

  return ok(res, { queued, targetAudience, channel });
}));

