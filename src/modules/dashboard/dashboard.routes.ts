import { Router, Request, Response } from 'express';
import { requireAuth, requireRole, requirePermission, scopeToOrganization } from '@/middlewares/auth';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';
import { todaysTithi } from '@/modules/calendar/calendar.service';
import { getSmartFeed } from '@/modules/feed/feed.service';
import { listAlerts } from '@/modules/alerts/alerts.service';

export const dashboardRoutes = Router();

// ---------------------------------------------------------------------------
// Misc platform services (§5.23): weekly rating popup, help content, deep links
// ---------------------------------------------------------------------------

/** Weekly app-rating popup support: client prompts weekly until rated. */
dashboardRoutes.get('/rating-prompt', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const prompt = await prisma.appRatingPrompt.findUnique({ where: { userId: req.actor!.userId } });
  const weekMs = 7 * 24 * 3600_000;
  const shouldPrompt = !prompt?.hasRated && (!prompt?.lastPromptAt || Date.now() - prompt.lastPromptAt.getTime() > weekMs);
  return ok(res, { hasRated: prompt?.hasRated ?? false, lastPromptAt: prompt?.lastPromptAt ?? null, shouldPrompt });
}));

dashboardRoutes.post('/rating-prompt', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { hasRated } = req.body as { hasRated?: boolean };
  const prompt = await prisma.appRatingPrompt.upsert({
    where: { userId: req.actor!.userId },
    update: { hasRated: hasRated ?? undefined, lastPromptAt: new Date() },
    create: { userId: req.actor!.userId, hasRated: hasRated ?? false, lastPromptAt: new Date() },
  });
  return ok(res, prompt);
}));

/** Help section content ("how to use the app"). */
dashboardRoutes.get('/help', requireAuth, asyncHandler(async (_req: Request, res: Response) => {
  const sections = await prisma.helpContent.findMany();
  return ok(res, sections);
}));

dashboardRoutes.put('/help/:section', requireAuth, requireRole('SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const row = await prisma.helpContent.upsert({
    where: { section: req.params.section as string },
    update: { title: req.body.title, bodyHtml: req.body.bodyHtml },
    create: { section: req.params.section as string, title: req.body.title, bodyHtml: req.body.bodyHtml },
  });
  return ok(res, row);
}));

/** Deep link resolution (§5.23): resolves a public ID into the entity + client route. */
dashboardRoutes.get('/deep-link/:publicId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const publicId = (req.params.publicId as string).toUpperCase();
  const [offer, event, page, org] = await Promise.all([
    prisma.offer.findUnique({ where: { publicId }, select: { id: true, publicId: true, title: true } }),
    prisma.event.findUnique({ where: { publicId }, select: { id: true, publicId: true, title: true } }),
    prisma.communityPage.findUnique({ where: { publicId }, select: { id: true, publicId: true, name: true } }),
    prisma.organization.findUnique({ where: { publicId }, select: { id: true, publicId: true, name: true, type: true } }),
  ]);

  if (offer) return ok(res, { target: 'OFFER', route: `/offers/${offer.id}`, entity: offer });
  if (event) return ok(res, { target: 'EVENT', route: `/events/${event.id}`, entity: event });
  if (page) return ok(res, { target: 'COMMUNITY_PAGE', route: `/community-pages/${page.id}`, entity: page });
  if (org) return ok(res, { target: 'ORGANIZATION', route: `/organizations/${org.id}`, entity: org });
  throw ApiError.notFound('No entity found for this link');
}));

/**
 * Member dashboard (§5.23): priority order Alerts -> (monk tracking) ->
 * Events -> Announcements -> Feed preview; personalized via visibility engine.
 */
dashboardRoutes.get(
  '/member',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const member = await prisma.member.findUnique({
      where: { userId: req.actor!.userId },
      include: { monkFollows: { include: { monk: { select: { publicId: true, dikshaName: true, photoUrl: true } } } } },
    });
    if (!member) throw ApiError.notFound('Member profile not found');

    const now = new Date();
    const [tithi, upcomingEvents, announcements, feedPreview] = await Promise.all([
      member.tithiCalendarTypeId ? todaysTithi(member.tithiCalendarTypeId) : Promise.resolve(null),
      prisma.event.findMany({
        where: { deletedAt: null, status: { in: ['PUBLISHED', 'RSVP_SALES_OPEN'] }, startAt: { gte: now } },
        select: { publicId: true, title: true, startAt: true, venue: true, bannerUrl: true },
        orderBy: { startAt: 'asc' },
        take: 5,
      }),
      prisma.announcement.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 5 }),
      getSmartFeed(member.id, 1, 5),
    ]);

    return ok(res, {
      trackedMonks: member.monkFollows.map((f) => f.monk),
      todaysTithi: tithi ?? { message: 'No tithi available' },
      upcomingEvents,
      announcements,
      feedPreview: feedPreview.items,
    });
  }),
);

/**
 * Admin dashboard (§5.23): live stat cards (total monks, active journeys,
 * today's arrivals, total donations), alerts panel, incoming monks.
 */
dashboardRoutes.get(
  '/admin/:organizationId',
  requireAuth,
  requirePermission('DASHBOARD', 'VIEW'),
  scopeToOrganization,
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.params.organizationId as string;
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const [totalMonks, activeJourneys, todaysArrivals, donationAgg, alerts, incomingRoutes] = await Promise.all([
      prisma.monkProfile.count({ where: { currentTempleId: organizationId, deletedAt: null } }),
      prisma.journey.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.journeyEvent.count({ where: { type: 'ARRIVAL', templeId: organizationId, timestamp: { gte: dayStart } } }),
      prisma.donation.aggregate({ where: { organizationId, status: 'VERIFIED' }, _sum: { totalAmount: true }, _count: true }),
      listAlerts({ isResolved: false }),
      prisma.route.findMany({
        where: { deletedAt: null, journeys: { some: { status: 'IN_PROGRESS' } } },
        include: { monk: { select: { publicId: true, dikshaName: true } }, journeys: { where: { status: 'IN_PROGRESS' }, take: 1 } },
        take: 20,
      }),
    ]);

    const incomingMonks = incomingRoutes
      .map((route) => {
        const stops = (route.stops as any[]) ?? [];
        const journey = route.journeys[0];
        if (!journey) return null;
        const currentStop = stops[journey.currentStopIndex];
        if (!currentStop || (currentStop.templeId && currentStop.templeId !== organizationId)) return null;
        return {
          monk: route.monk,
          from: stops[Math.max(journey.currentStopIndex - 1, 0)]?.templeName ?? 'Origin',
          to: currentStop.templeName,
          eta: currentStop.expectedArrival ?? null,
          status: currentStop.status === 'DELAYED' ? 'DELAYED' : 'ON_TIME',
        };
      })
      .filter(Boolean);

    return ok(res, {
      statCards: {
        totalMonks,
        activeJourneys,
        todaysArrivals,
        totalDonations: donationAgg._sum.totalAmount ?? 0,
        donationCount: donationAgg._count,
      },
      alerts: alerts.slice(0, 20),
      incomingMonks,
    });
  }),
);
