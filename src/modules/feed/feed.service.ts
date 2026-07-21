import { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { isMemberEligible, computeFeedPriorityRank } from '@/engines/visibility/visibility.service';
import { GEO_EXPANSION_RINGS_KM } from '@/engines/visibility/visibility.types';

/**
 * Community Feed Engine (§5.13) — priority-based smart feed, NOT chronological:
 *  P1 followed entities -> P2 community chain -> P3 geographic expansion
 *  (Area→5→10→20km→City→District→State→Country→Global as user paginates) ->
 *  P4 global JiNANAM content.
 */

// -----------------------------------------------------------------------------
// Feed card creation
// -----------------------------------------------------------------------------

/** Manual posts by org admins — restricted to own organization (route-guarded). */
export async function createManualPost(input: Record<string, unknown> & { authorUserId: string }) {
  const { images, visibilityConfig, ...rest } = input as any;
  return prisma.feedPost.create({
    data: {
      ...rest,
      type: 'MANUAL',
      images: images as Prisma.InputJsonValue,
      visibilityConfig: visibilityConfig as Prisma.InputJsonValue,
      isActive: !rest.startAt || new Date(rest.startAt) <= new Date(),
    },
  });
}

/**
 * Automatic feed-card generation hook (§5.13) — called by events/tours/offers/
 * notices/gallery/announcement services when admins create or update content.
 */
export async function createAutoFeedCard(input: {
  sourceModule: string;
  sourceId: string;
  organizationId?: string;
  title: string;
  description?: string;
  coverUrl?: string;
  visibilityConfig?: Record<string, unknown>;
  categoryId?: string;
}) {
  return prisma.feedPost.create({
    data: {
      type: 'AUTO',
      sourceModule: input.sourceModule,
      sourceId: input.sourceId,
      organizationId: input.organizationId,
      title: input.title,
      description: input.description,
      coverUrl: input.coverUrl,
      visibilityConfig: input.visibilityConfig as Prisma.InputJsonValue,
      categoryId: input.categoryId,
    },
  });
}

/** Scheduled job hook: auto activate/deactivate by start/end dates (§5.13). */
export async function refreshPostActivations() {
  const now = new Date();
  await prisma.feedPost.updateMany({ where: { startAt: { lte: now }, isActive: false, deletedAt: null, OR: [{ endAt: null }, { endAt: { gte: now } }] }, data: { isActive: true } });
  await prisma.feedPost.updateMany({ where: { endAt: { lt: now }, isActive: true }, data: { isActive: false } });
}

// -----------------------------------------------------------------------------
// The smart feed
// -----------------------------------------------------------------------------

interface FeedContext {
  memberId: string;
  followedOrgIds: Set<string>;
  followedMonkIds: Set<string>;
  communityId?: string | null;
  subCommunityId?: string | null;
  gacchaId?: string | null;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

async function buildFeedContext(memberId: string): Promise<FeedContext> {
  const member = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    include: { organizationFollows: true, monkFollows: true },
  });
  const address = member.currentAddress as { city?: string; state?: string; country?: string } | null;
  return {
    memberId,
    followedOrgIds: new Set(member.organizationFollows.map((f) => f.organizationId)),
    followedMonkIds: new Set(member.monkFollows.map((f) => f.monkId)),
    communityId: member.communityId,
    subCommunityId: member.subCommunityId,
    gacchaId: member.gacchaId,
    lat: member.currentLat,
    lng: member.currentLng,
    city: address?.city,
    state: address?.state,
    country: address?.country,
  };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function rankPost(post: any, ctx: FeedContext): number {
  const cfg = (post.visibilityConfig ?? {}) as any;

  // Pinned posts (global or local) get highest priority
  if (post.isPinned) {
    return -1000;
  }

  // P1: followed entities
  if (post.organizationId && ctx.followedOrgIds.has(post.organizationId)) {
    return computeFeedPriorityRank({ isFollowed: true, isCommunityMatch: false, geoRingIndex: null, isGlobalFallback: false });
  }
  const cfgMonks: string[] = cfg.followedEntityIds?.monkIds ?? [];
  if (cfgMonks.some((id) => ctx.followedMonkIds.has(id))) {
    return computeFeedPriorityRank({ isFollowed: true, isCommunityMatch: false, geoRingIndex: null, isGlobalFallback: false });
  }

  // P2: community chain match
  const communityMatch =
    (cfg.community?.gacchaIds?.includes(ctx.gacchaId) && ctx.gacchaId) ||
    (cfg.community?.subCommunityIds?.includes(ctx.subCommunityId) && ctx.subCommunityId) ||
    (cfg.community?.communityIds?.includes(ctx.communityId) && ctx.communityId);
  if (communityMatch) {
    return computeFeedPriorityRank({ isFollowed: false, isCommunityMatch: true, geoRingIndex: null, isGlobalFallback: false });
  }

  // P3: geographic rings
  if (cfg.geo?.centerLat !== undefined && cfg.geo?.centerLng !== undefined && ctx.lat != null && ctx.lng != null) {
    const distance = haversineKm(ctx.lat, ctx.lng, cfg.geo.centerLat, cfg.geo.centerLng);
    for (let ring = 0; ring < GEO_EXPANSION_RINGS_KM.length; ring += 1) {
      if (distance <= GEO_EXPANSION_RINGS_KM[ring]!) {
        return computeFeedPriorityRank({ isFollowed: false, isCommunityMatch: false, geoRingIndex: ring + 1, isGlobalFallback: false });
      }
    }
  }
  if (cfg.geo?.city && cfg.geo.city === ctx.city) return computeFeedPriorityRank({ isFollowed: false, isCommunityMatch: false, geoRingIndex: 4, isGlobalFallback: false });
  if (cfg.geo?.state && cfg.geo.state === ctx.state) return computeFeedPriorityRank({ isFollowed: false, isCommunityMatch: false, geoRingIndex: 6, isGlobalFallback: false });
  if (cfg.geo?.country && cfg.geo.country === ctx.country) return computeFeedPriorityRank({ isFollowed: false, isCommunityMatch: false, geoRingIndex: 7, isGlobalFallback: false });

  // P4: global fallback
  if (cfg.isPublic || !post.organizationId) {
    return computeFeedPriorityRank({ isFollowed: false, isCommunityMatch: false, geoRingIndex: null, isGlobalFallback: true });
  }

  return 99999; // not eligible — filtered out below
}

export async function getSmartFeed(
  memberId: string,
  page: number,
  pageSize: number,
  filters: { q?: string; categoryId?: string; filterKeys?: string[]; savedOnly?: boolean } = {}
) {
  const ctx = await buildFeedContext(memberId);

  // Candidate pool: active, non-deleted posts, newest first within rank
  let candidates: any[];
  if (filters.savedOnly) {
    const saves = await prisma.feedPostSave.findMany({
      where: { memberId },
      include: {
        feedPost: {
          include: {
            organization: { select: { id: true, name: true, publicId: true, logoUrl: true, type: true } },
            category: true,
            poll: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    candidates = saves.map((s) => s.feedPost).filter(Boolean);
  } else {
    candidates = await prisma.feedPost.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        organization: { select: { id: true, name: true, publicId: true, logoUrl: true, type: true } },
        category: true,
        poll: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500, // rank window; older content falls off the smart feed
    });
  }

  // Apply search query 'q'
  if (filters.q) {
    const searchVal = filters.q.toLowerCase();
    candidates = candidates.filter(
      (post) =>
        post.title?.toLowerCase().includes(searchVal) ||
        post.description?.toLowerCase().includes(searchVal) ||
        post.organization?.name?.toLowerCase().includes(searchVal)
    );
  }

  // Apply category filtering
  if (filters.categoryId) {
    candidates = candidates.filter((post) => post.categoryId === filters.categoryId);
  }

  // Apply community & following key filters
  if (filters.filterKeys && filters.filterKeys.length > 0) {
    candidates = candidates.filter((post) => {
      return filters.filterKeys!.some((key) => {
        if (key === 'myTemples') {
          return (
            post.organization?.type === 'TEMPLE' &&
            post.organizationId &&
            ctx.followedOrgIds.has(post.organizationId)
          );
        }
        if (key === 'myJainCentres') {
          return (
            post.organization?.type === 'JAIN_CENTER' &&
            post.organizationId &&
            ctx.followedOrgIds.has(post.organizationId)
          );
        }
        if (key === 'myMonks') {
          const cfg = (post.visibilityConfig ?? {}) as any;
          const cfgMonks: string[] = cfg.followedEntityIds?.monkIds ?? [];
          return cfgMonks.some((id) => ctx.followedMonkIds.has(id));
        }
        if (key === 'nearby') {
          const cfg = (post.visibilityConfig ?? {}) as any;
          if (cfg.geo?.centerLat !== undefined && cfg.geo?.centerLng !== undefined && ctx.lat != null && ctx.lng != null) {
            const distance = haversineKm(ctx.lat, ctx.lng, cfg.geo.centerLat, cfg.geo.centerLng);
            return distance <= 20; // 20KM radius
          }
          return false;
        }
        if (key === 'myCommunity') {
          const cfg = (post.visibilityConfig ?? {}) as any;
          const communityMatch =
            (cfg.community?.gacchaIds?.includes(ctx.gacchaId) && ctx.gacchaId) ||
            (cfg.community?.subCommunityIds?.includes(ctx.subCommunityId) && ctx.subCommunityId) ||
            (cfg.community?.communityIds?.includes(ctx.communityId) && ctx.communityId);
          return !!communityMatch;
        }
        if (key === 'events') return post.category?.name === 'Events';
        if (key === 'tours') return post.category?.name === 'Tours';
        if (key === 'notices') return post.category?.name === 'Notices';
        if (key === 'offers') return post.category?.name === 'Offers & Benefits';
        if (key === 'temple-updates') return post.category?.name === 'Temple Updates';
        if (key === 'videos') return post.category?.name === 'Videos';
        if (key === 'photos') return post.category?.name === 'Photos';
        return false;
      });
    });
  }

  const ranked = candidates
    .map((post) => ({ post, rank: rankPost(post, ctx) }))
    .filter((r) => r.rank < 99999)
    .sort((a, b) => a.rank - b.rank || b.post.createdAt.getTime() - a.post.createdAt.getTime());

  const start = (page - 1) * pageSize;
  const pageRows = ranked.slice(start, start + pageSize).map((r) => r.post);

  // Auto track analytics: increment view counts for these posts asynchronously
  if (pageRows.length > 0) {
    prisma.feedPost
      .updateMany({
        where: { id: { in: pageRows.map((r) => r.id) } },
        data: { viewCount: { increment: 1 } },
      })
      .catch((err) => console.error('Failed to update feed post view counts:', err));
  }

  // Ads in feed (§5.13): top banner + in-feed after every 7 posts
  const ads = await getActiveAdsForMember(ctx);
  const topBanner = ads.find((a) => a.slot === 'TOP_BANNER') ?? null;
  const inFeedAds = ads.filter((a) => a.slot === 'IN_FEED');

  const items: any[] = [];
  let adIndex = 0;
  pageRows.forEach((post, i) => {
    items.push({ kind: 'POST', post });
    if ((i + 1) % 7 === 0 && inFeedAds.length > 0) {
      items.push({ kind: 'AD', ad: inFeedAds[adIndex % inFeedAds.length] });
      adIndex += 1;
    }
  });

  return { topBanner, items, total: ranked.length, page, pageSize };
}

async function getActiveAdsForMember(ctx: FeedContext) {
  const now = new Date();
  const ads = await prisma.ad.findMany({ where: { isActive: true, startAt: { lte: now }, endAt: { gte: now } } });
  return ads.filter((ad) => {
    const targeting = (ad.targeting ?? { all: true }) as any;
    if (targeting.all) return true;
    return (
      (targeting.cities ?? []).includes(ctx.city) ||
      (targeting.states ?? []).includes(ctx.state) ||
      (targeting.countries ?? []).includes(ctx.country)
    );
  });
}

export async function getPost(postId: string, memberId: string) {
  const post = await prisma.feedPost.findUnique({
    where: { id: postId },
    include: { organization: { select: { name: true, publicId: true } }, category: true, poll: { include: { votes: true } } },
  });
  if (!post || post.deletedAt) throw ApiError.notFound('Post not found');
  const cfg = (post.visibilityConfig ?? { isPublic: true }) as any;
  const eligible = await isMemberEligible(memberId, cfg);
  if (!eligible && !cfg.isPublic) throw ApiError.notFound('Post not found');
  return post;
}
