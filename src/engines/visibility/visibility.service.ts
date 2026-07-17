import { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { VisibilityConfig } from './visibility.types';

/**
 * Community & Location Visibility Engine (§4.2).
 *
 * Resolution priority:
 *  1. Followed entities (temples, monks, JCs, dharamshalas) — absolute highest priority.
 *  2. Community match: Community -> Sub-community -> Gaccha.
 *  3. Geographic expansion: Area -> 5/10/20km -> City -> District -> State -> Country -> Global.
 *  4. Global JiNANAM content as fallback.
 *
 * Note (DECISIONS.md D-002): geo distance uses the Haversine formula over plain
 * lat/lng columns (indexed) rather than PostGIS/earthdistance, so the schema
 * has no Postgres-extension dependency. Distances are computed in SQL to avoid
 * pulling full member tables into application memory.
 */

export async function getEligibleMemberIds(config: VisibilityConfig, requestingMemberId?: string): Promise<Set<string>> {
  // Non-Jain members see everything — no community or geo filters apply (§5.3 spec).
  if (requestingMemberId) {
    const m = await prisma.member.findFirst({ where: { id: requestingMemberId, deletedAt: null }, select: { category: true } });
    if (m?.category === 'NON_JAIN') {
      const all = await prisma.member.findMany({ where: { deletedAt: null }, select: { id: true } });
      return new Set(all.map((x) => x.id));
    }
  }

  if (config.isPublic) {
    const all = await prisma.member.findMany({ where: { deletedAt: null }, select: { id: true } });
    return new Set(all.map((m) => m.id));
  }


  const eligible = new Set<string>();

  // Priority 1: followers of linked organizations/monks
  if (config.followedEntityIds?.organizationIds?.length) {
    const follows = await prisma.organizationFollow.findMany({
      where: { organizationId: { in: config.followedEntityIds.organizationIds } },
      select: { memberId: true },
    });
    follows.forEach((f) => eligible.add(f.memberId));
  }
  if (config.followedEntityIds?.monkIds?.length) {
    const follows = await prisma.monkFollow.findMany({
      where: { monkId: { in: config.followedEntityIds.monkIds } },
      select: { memberId: true },
    });
    follows.forEach((f) => eligible.add(f.memberId));
  }

  // Explicit linked-member allow-list (e.g. tour participants, private groups)
  if (config.linkedMemberIds?.length) {
    config.linkedMemberIds.forEach((id) => eligible.add(id));
  }

  // Priority 2: community chain match
  if (config.community && (config.community.communityIds?.length || config.community.subCommunityIds?.length || config.community.gacchaIds?.length)) {
    const members = await prisma.member.findMany({
      where: {
        deletedAt: null,
        OR: [
          config.community.gacchaIds?.length ? { gacchaId: { in: config.community.gacchaIds } } : undefined,
          config.community.subCommunityIds?.length ? { subCommunityId: { in: config.community.subCommunityIds } } : undefined,
          config.community.communityIds?.length ? { communityId: { in: config.community.communityIds } } : undefined,
        ].filter(Boolean) as Prisma.MemberWhereInput[],
      },
      select: { id: true },
    });
    members.forEach((m) => eligible.add(m.id));
  }

  // Priority 3: geographic expansion
  if (config.geo) {
    if (config.geo.gpsRadiusKm && config.geo.centerLat !== undefined && config.geo.centerLng !== undefined) {
      const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT "id" FROM "members"
        WHERE "deletedAt" IS NULL AND "currentLat" IS NOT NULL AND "currentLng" IS NOT NULL
        AND (6371 * acos(
          cos(radians(${config.geo.centerLat})) * cos(radians("currentLat")) *
          cos(radians("currentLng") - radians(${config.geo.centerLng})) +
          sin(radians(${config.geo.centerLat})) * sin(radians("currentLat"))
        )) <= ${config.geo.gpsRadiusKm}
      `);
      rows.forEach((r) => eligible.add(r.id));
    }

    if (config.geo.city || config.geo.state || config.geo.country) {
      const members = await prisma.member.findMany({
        where: {
          deletedAt: null,
          OR: [
            config.geo.city ? { currentAddress: { path: ['city'], equals: config.geo.city } } : undefined,
            config.geo.state ? { currentAddress: { path: ['state'], equals: config.geo.state } } : undefined,
            config.geo.country ? { currentAddress: { path: ['country'], equals: config.geo.country } } : undefined,
          ].filter(Boolean) as Prisma.MemberWhereInput[],
        },
        select: { id: true },
      });
      members.forEach((m) => eligible.add(m.id));
    }
  }

  return eligible;
}

export async function isMemberEligible(memberId: string, config: VisibilityConfig): Promise<boolean> {
  if (config.isPublic) return true;
  const eligible = await getEligibleMemberIds(config);
  return eligible.has(memberId);
}

/** Ranking score for the priority-based smart feed (§5.13): lower = higher priority (shown first). */
export function computeFeedPriorityRank(input: {
  isFollowed: boolean;
  isCommunityMatch: boolean;
  geoRingIndex: number | null; // 0=area,1=5km,2=10km,3=20km,4=city,5=district,6=state,7=country,8=global
  isGlobalFallback: boolean;
}): number {
  if (input.isFollowed) return 0;
  if (input.isCommunityMatch) return 1000;
  if (input.geoRingIndex !== null) return 2000 + input.geoRingIndex;
  if (input.isGlobalFallback) return 9000;
  return 99999;
}
