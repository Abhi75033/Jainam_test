import { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { nextPublicId } from '@/engines/idGenerator/id.service';
import { getQueue, QUEUE_NAMES } from '@/jobs/queues';
import { enqueueNotification } from '@/engines/notification/notification.service';
import { getEligibleMemberIds } from '@/engines/visibility/visibility.service';

/**
 * Offers & Benefits (§5.14) — Super Admin CRUD; automatic notification schedule:
 * Day 1 live, Day 15 mid-month, 24h before expiry — repeated monthly for
 * multi-month offers (9 sends for 3-month, 36 for yearly).
 */

const DAY_MS = 24 * 3600_000;

export async function createOffer(input: Record<string, unknown> & { createdById: string }) {
  const { createdById, contact, links, visibilityConfig, ...rest } = input as any;

  const offer = await prisma.$transaction(async (tx) => {
    const publicId = await nextPublicId('OFFER', tx);
    return tx.offer.create({
      data: {
        publicId,
        ...rest,
        contact: contact as Prisma.InputJsonValue,
        links: links as Prisma.InputJsonValue,
        visibilityConfig: visibilityConfig as Prisma.InputJsonValue,
        createdById,
      },
    });
  });

  await scheduleOfferNotifications(offer.id, offer.startAt, offer.endAt);

  // Auto feed-card (§5.13)
  const { createAutoFeedCard } = await import('@/modules/feed/feed.service');
  await createAutoFeedCard({
    sourceModule: 'OFFERS',
    sourceId: offer.id,
    title: `${offer.title} — ${offer.companyName}`,
    description: offer.description ?? undefined,
    coverUrl: offer.bannerUrl ?? undefined,
    visibilityConfig: (offer.visibilityConfig as Record<string, unknown>) ?? undefined,
  });

  return offer;
}

async function scheduleOfferNotifications(offerId: string, startAt: Date, endAt: Date) {
  const queue = getQueue(QUEUE_NAMES.OFFER_SCHEDULE);
  const now = Date.now();

  const schedulePoints: { key: string; at: number }[] = [];

  // Monthly cycles between start and end: Day 1 + Day 15 of each cycle
  let cycleStart = startAt.getTime();
  let cycle = 1;
  while (cycleStart < endAt.getTime()) {
    schedulePoints.push({ key: `DAY1_M${cycle}`, at: cycleStart });
    const day15 = cycleStart + 14 * DAY_MS;
    if (day15 < endAt.getTime()) schedulePoints.push({ key: `DAY15_M${cycle}`, at: day15 });
    cycleStart += 30 * DAY_MS;
    cycle += 1;
  }
  // 24h before expiry
  schedulePoints.push({ key: 'EXPIRY_24H', at: endAt.getTime() - DAY_MS });

  for (const p of schedulePoints) {
    if (p.at > now) {
      await queue.add('offer-notify', { offerId, reminderKey: p.key }, { delay: p.at - now, jobId: `offer-${offerId}-${p.key}` });
    }
  }
}

/** Dispatcher used by the offer-schedule queue processor. */
export async function sendOfferScheduledNotification(offerId: string, reminderKey: string) {
  const offer = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!offer || offer.deletedAt) return;
  if (offer.endAt < new Date()) return; // expired — stop notifying

  const eligible = await getEligibleMemberIds((offer.visibilityConfig ?? { isPublic: true }) as any);
  const members = await prisma.member.findMany({ where: { id: { in: Array.from(eligible) } }, select: { userId: true } });

  const body = reminderKey === 'EXPIRY_24H'
    ? `Last chance! "${offer.title}" from ${offer.companyName} expires in 24 hours.`
    : `Offer for you: "${offer.title}" from ${offer.companyName}. Tap to view.`;

  await Promise.all(
    members.map((m) =>
      enqueueNotification({
        userId: m.userId,
        templateKey: `OFFER_${reminderKey}`,
        category: 'MARKETING',
        to: { PUSH: m.userId, IN_APP: m.userId },
        body,
        data: { offerId: offer.id, offerPublicId: offer.publicId },
      }),
    ),
  );
}

export async function updateOffer(offerId: string, input: Record<string, unknown>) {
  const { contact, links, visibilityConfig, ...rest } = input as any;
  return prisma.offer.update({
    where: { id: offerId },
    data: {
      ...rest,
      contact: contact as Prisma.InputJsonValue,
      links: links as Prisma.InputJsonValue,
      visibilityConfig: visibilityConfig as Prisma.InputJsonValue,
    },
  });
}

// -----------------------------------------------------------------------------
// Member browse sections (§5.14)
// -----------------------------------------------------------------------------

export async function browseOffers(memberId: string, section: 'near-you' | 'home-city' | 'recent' | 'expiring-soon' | 'saved', filters: { categoryIds?: string[]; search?: string }) {
  const now = new Date();
  const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });
  const address = member.currentAddress as { city?: string } | null;

  const activeWhere: Prisma.OfferWhereInput = {
    deletedAt: null,
    startAt: { lte: now },
    endAt: { gte: now }, // expired offers hidden from members (§5.14)
    categoryId: filters.categoryIds?.length ? { in: filters.categoryIds } : undefined,
    OR: filters.search
      ? [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { companyName: { contains: filters.search, mode: 'insensitive' } },
        ]
      : undefined,
  };

  switch (section) {
    case 'saved': {
      const saves = await prisma.offerSave.findMany({ where: { memberId }, include: { offer: true } });
      return saves.map((s) => s.offer).filter((o) => !o.deletedAt && o.endAt >= now);
    }
    case 'expiring-soon':
      return prisma.offer.findMany({ where: { ...activeWhere, endAt: { gte: now, lte: new Date(now.getTime() + 7 * DAY_MS) } }, orderBy: { endAt: 'asc' }, take: 50 });
    case 'recent':
      return prisma.offer.findMany({ where: activeWhere, orderBy: { createdAt: 'desc' }, take: 50 });
    case 'home-city': {
      // City targeting stored inside visibilityConfig.geo.city
      const offers = await prisma.offer.findMany({ where: activeWhere, orderBy: { createdAt: 'desc' }, take: 200 });
      return offers.filter((o) => {
        const cfg = (o.visibilityConfig ?? {}) as any;
        return !cfg.geo?.city || cfg.geo.city === address?.city;
      });
    }
    case 'near-you':
    default: {
      if (member.currentLat == null || member.currentLng == null) return [];
      const offers = await prisma.offer.findMany({ where: activeWhere, take: 200 });
      return offers.filter((o) => {
        const cfg = (o.visibilityConfig ?? {}) as any;
        if (cfg.geo?.centerLat === undefined) return false;
        const dLat = ((cfg.geo.centerLat - member.currentLat!) * Math.PI) / 180;
        const dLng = ((cfg.geo.centerLng - member.currentLng!) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((member.currentLat! * Math.PI) / 180) * Math.cos((cfg.geo.centerLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return km <= (cfg.geo.gpsRadiusKm ?? 20);
      });
    }
  }
}

export async function saveOffer(offerId: string, memberId: string) {
  return prisma.offerSave.upsert({ where: { offerId_memberId: { offerId, memberId } }, update: {}, create: { offerId, memberId } });
}

export async function unsaveOffer(offerId: string, memberId: string) {
  await prisma.offerSave.deleteMany({ where: { offerId, memberId } });
}

export async function trackOfferEvent(offerId: string, kind: 'view' | 'click' | 'share') {
  const data = kind === 'view' ? { viewCount: { increment: 1 } } : kind === 'click' ? { clickCount: { increment: 1 } } : { shareCount: { increment: 1 } };
  await prisma.offer.update({ where: { id: offerId }, data });
}

/** Analytics — Super Admin only (§5.14). */
export async function offerAnalytics(offerId: string) {
  const offer = await prisma.offer.findUnique({ where: { id: offerId }, include: { _count: { select: { saves: true } } } });
  if (!offer) throw ApiError.notFound('Offer not found');
  const ctr = offer.viewCount > 0 ? Number(((offer.clickCount / offer.viewCount) * 100).toFixed(2)) : 0;
  return { views: offer.viewCount, clicks: offer.clickCount, shares: offer.shareCount, saves: offer._count.saves, ctr };
}
