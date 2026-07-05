import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission, scopeToOrganization } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { prisma } from '@/config/prisma';
import { Prisma } from '@prisma/client';
import { getEligibleMemberIds } from '@/engines/visibility/visibility.service';
import { enqueueNotification } from '@/engines/notification/notification.service';
import { createAutoFeedCard } from '@/modules/feed/feed.service';

const createAnnouncementSchema = z.object({
  body: z.object({
    organizationId: z.string().optional(),
    title: z.string().min(1),
    body: z.string().min(1),
    visibilityConfig: z.record(z.string(), z.unknown()).optional(),
  }),
});

/** Announcements (§5.21): org admins + Super Admin post; visibility targeting; push + feed integration. */
export const announcementRoutes = Router();

announcementRoutes.post(
  '/',
  requireAuth,
  requirePermission('ANNOUNCEMENTS', 'CREATE'),
  scopeToOrganization,
  validate(createAnnouncementSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const announcement = await prisma.announcement.create({
      data: {
        organizationId: req.body.organizationId,
        title: req.body.title,
        body: req.body.body,
        visibilityConfig: req.body.visibilityConfig as Prisma.InputJsonValue,
        createdById: req.actor!.userId,
      },
    });

    // Feed integration (§5.13 auto feed-card)
    await createAutoFeedCard({
      sourceModule: 'ANNOUNCEMENTS',
      sourceId: announcement.id,
      organizationId: announcement.organizationId ?? undefined,
      title: announcement.title,
      description: announcement.body,
      visibilityConfig: (announcement.visibilityConfig as Record<string, unknown>) ?? undefined,
    });

    // Push fan-out via visibility engine
    const eligible = await getEligibleMemberIds((announcement.visibilityConfig ?? { isPublic: true }) as any);
    const members = await prisma.member.findMany({ where: { id: { in: Array.from(eligible) } }, select: { userId: true } });
    await Promise.all(
      members.map((m) =>
        enqueueNotification({
          userId: m.userId,
          templateKey: 'ANNOUNCEMENT_PUBLISHED',
          category: 'SERVICE',
          to: { PUSH: m.userId, IN_APP: m.userId },
          body: `${announcement.title}: ${announcement.body.slice(0, 120)}`,
        }),
      ),
    );

    return created(res, announcement);
  }),
);

announcementRoutes.get(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.query as { organizationId?: string };
    const announcements = await prisma.announcement.findMany({
      where: { deletedAt: null, organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return ok(res, announcements);
  }),
);
