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
  if (!member) throw ApiError.notFound('Member profile not found');
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
