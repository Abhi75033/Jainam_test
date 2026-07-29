import { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { nextPublicId } from '@/engines/idGenerator/id.service';
import { enqueueNotification } from '@/engines/notification/notification.service';

/**
 * Community Pages (§5.16, LinkedIn-style). Created by Super Admin only; page
 * owners manage only their page. Subscription expiry locks owner management
 * access while the page + content stay publicly visible.
 */

export async function createPage(input: Record<string, unknown> & { ownerUserIds: string[]; createdById: string }) {
  const { ownerUserIds, createdById, contacts, socialLinks, visibilityConfig, gallery, ...rest } = input as any;

  const page = await prisma.$transaction(async (tx) => {
    const publicId = await nextPublicId('COMMUNITY_PAGE', tx);
    const created = await tx.communityPage.create({
      data: {
        publicId,
        ...rest,
        subscriptionStartDate: rest.subscriptionStartDate ? new Date(rest.subscriptionStartDate) : new Date(),
        contacts: contacts as Prisma.InputJsonValue,
        socialLinks: socialLinks as Prisma.InputJsonValue,
        visibilityConfig: visibilityConfig as Prisma.InputJsonValue,
        gallery: gallery as Prisma.InputJsonValue,
        createdById,
      },
    });
    for (const userId of ownerUserIds as string[]) {
      await tx.communityPageOwner.create({ data: { pageId: created.id, userId } });
      // Elevate plain members to PAGE_OWNER; never downgrade admin/staff roles
      await tx.user.updateMany({
        where: { id: userId, primaryRoleKey: { in: ['MEMBER', 'NON_JAIN_MEMBER'] } },
        data: { primaryRoleKey: 'PAGE_OWNER' },
      });
    }
    return created;
  });

  return page;
}

/** Guard used by owner-management routes: subscription must be active (§5.16). */
export async function assertOwnerCanManage(pageId: string, userId: string, isSuperAdmin: boolean) {
  const page = await prisma.communityPage.findUnique({ where: { id: pageId }, include: { owners: true } });
  if (!page || page.deletedAt) throw ApiError.notFound('Community page not found');
  if (isSuperAdmin) return page;

  const isOwner = page.owners.some((o) => o.userId === userId);
  if (!isOwner) throw ApiError.forbidden('You are not an owner of this page');

  if (page.subscriptionStatus === 'EXPIRED' || page.subscriptionStatus === 'SUSPENDED') {
    throw ApiError.forbidden('Page subscription has expired — management access is locked. The page remains publicly visible. Contact JiNANAM to renew.');
  }
  return page;
}

export async function updatePage(pageId: string, input: Record<string, unknown>, actor: { userId: string; isSuperAdmin: boolean }) {
  await assertOwnerCanManage(pageId, actor.userId, actor.isSuperAdmin);
  const { contacts, socialLinks, visibilityConfig, gallery, ...rest } = input as any;
  return prisma.communityPage.update({
    where: { id: pageId },
    data: {
      ...rest,
      contacts: contacts as Prisma.InputJsonValue,
      socialLinks: socialLinks as Prisma.InputJsonValue,
      visibilityConfig: visibilityConfig as Prisma.InputJsonValue,
      gallery: gallery as Prisma.InputJsonValue,
    },
  });
}

/** Super Admin full update — subscription, visibility, owner reassignment. */
export async function superAdminUpdatePage(pageId: string, input: Record<string, unknown>) {
  const { ownerUserIds, subscriptionStatus, subscriptionStartDate, subscriptionExpiresAt, subscriptionPlan, ...rest } = input as any;

  return prisma.$transaction(async (tx) => {
    const page = await tx.communityPage.update({
      where: { id: pageId },
      data: {
        ...rest,
        ...(subscriptionStatus && { subscriptionStatus }),
        ...(subscriptionStartDate && { subscriptionStartDate: new Date(subscriptionStartDate) }),
        ...(subscriptionExpiresAt && { subscriptionExpiresAt: new Date(subscriptionExpiresAt) }),
        ...(subscriptionPlan && { subscriptionPlan }),
      },
    });

    if (ownerUserIds && Array.isArray(ownerUserIds)) {
      await tx.communityPageOwner.deleteMany({ where: { pageId } });
      for (const userId of ownerUserIds) {
        await tx.communityPageOwner.create({ data: { pageId, userId } });
        await tx.user.updateMany({
          where: { id: userId, primaryRoleKey: { in: ['MEMBER', 'NON_JAIN_MEMBER'] } },
          data: { primaryRoleKey: 'PAGE_OWNER' },
        });
      }
    }
    return page;
  });
}

export async function getPage(pageIdOrPublicId: string) {
  const page = await prisma.communityPage.findFirst({
    where: { OR: [{ id: pageIdOrPublicId }, { publicId: pageIdOrPublicId }], deletedAt: null },
    include: {
      category: true,
      owners: true,
      _count: { select: { members: { where: { status: 'APPROVED' } }, posts: true } },
    },
  });
  if (!page) throw ApiError.notFound('Community page not found');
  return page;
}

// ─── Join Community flow ──────────────────────────────────────────────────────

export async function joinPage(pageId: string, memberId: string) {
  const page = await prisma.communityPage.findUnique({
    where: { id: pageId },
    include: { owners: true },
  });
  if (!page || page.deletedAt) throw ApiError.notFound('Community page not found');

  const status = page.joinApprovalMode === 'AUTO' ? 'APPROVED' : 'PENDING';
  const membership = await prisma.communityPageMember.upsert({
    where: { pageId_memberId: { pageId, memberId } },
    update: { status },
    create: { pageId, memberId, status },
    include: { member: { select: { fullName: true } } },
  });

  // Notify all page owners about the new join request / auto-approved member
  if (status === 'PENDING') {
    for (const owner of page.owners) {
      await enqueueNotification({
        userId: owner.userId,
        templateKey: 'PAGE_JOIN_REQUEST',
        category: 'SERVICE',
        to: { PUSH: owner.userId, IN_APP: owner.userId },
        body: `New join request for ${page.name} from ${(membership as any).member?.fullName || 'a member'}.`,
      });
    }
  }

  return membership;
}

/** Member leaves the community page. */
export async function leavePage(pageId: string, memberId: string) {
  const page = await prisma.communityPage.findUnique({ where: { id: pageId } });
  if (!page || page.deletedAt) throw ApiError.notFound('Community page not found');

  await prisma.communityPageMember.deleteMany({ where: { pageId, memberId } });
  return { left: true };
}

export async function decideMembership(pageId: string, memberId: string, decision: 'APPROVED' | 'REJECTED', actor: { userId: string; isSuperAdmin: boolean }) {
  await assertOwnerCanManage(pageId, actor.userId, actor.isSuperAdmin);
  const row = await prisma.communityPageMember.update({
    where: { pageId_memberId: { pageId, memberId } },
    data: { status: decision },
    include: { member: { select: { userId: true, fullName: true } }, page: { select: { name: true } } },
  });

  await enqueueNotification({
    userId: row.member.userId,
    templateKey: 'PAGE_MEMBERSHIP_DECIDED',
    category: 'SERVICE',
    to: { PUSH: row.member.userId, IN_APP: row.member.userId },
    body: decision === 'APPROVED'
      ? `Your request to join ${row.page.name} was approved. Welcome!`
      : `Your request to join ${row.page.name} was declined.`,
  });

  return row;
}

/** Owner removes an approved/pending member. */
export async function removeMember(pageId: string, memberId: string, actor: { userId: string; isSuperAdmin: boolean }) {
  await assertOwnerCanManage(pageId, actor.userId, actor.isSuperAdmin);
  await prisma.communityPageMember.deleteMany({ where: { pageId, memberId } });
  return { removed: true };
}

export async function listPageMembers(pageId: string, status: 'PENDING' | 'APPROVED' | 'REJECTED', actor: { userId: string; isSuperAdmin: boolean }) {
  await assertOwnerCanManage(pageId, actor.userId, actor.isSuperAdmin);
  return prisma.communityPageMember.findMany({
    where: { pageId, status },
    include: {
      member: {
        select: {
          id: true,
          publicId: true,
          fullName: true,
          photoUrl: true,
          city: true,
          state: true,
          sect: true,
          subSect: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Community Page Feed ──────────────────────────────────────────────────────

export async function getPageFeed(pageId: string) {
  return prisma.feedPost.findMany({
    where: { communityPageId: pageId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      category: { select: { name: true } },
      poll: true,
    },
  });
}

/** Owner creates a feed post on behalf of the community page. */
export async function createPagePost(pageId: string, input: Record<string, unknown>, actor: { userId: string; isSuperAdmin: boolean }) {
  const page = await assertOwnerCanManage(pageId, actor.userId, actor.isSuperAdmin);

  const { images, ...rest } = input as any;
  const post = await prisma.feedPost.create({
    data: {
      communityPageId: pageId,
      authorUserId: actor.userId,
      type: 'MANUAL',
      ...rest,
      images: images as Prisma.InputJsonValue,
    },
  });

  // Notify all APPROVED members about the new post (batched)
  const members = await prisma.communityPageMember.findMany({
    where: { pageId, status: 'APPROVED' },
    include: { member: { select: { userId: true } } },
    take: 500,
  });

  for (const m of members) {
    await enqueueNotification({
      userId: m.member.userId,
      templateKey: 'PAGE_NEW_POST',
      category: 'COMMUNITY',
      to: { IN_APP: m.member.userId },
      body: `${page.name} published a new update.`,
    });
  }

  return post;
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export async function updateSubscription(pageId: string, input: { plan?: string; expiresAt?: Date; status?: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'SUSPENDED' }) {
  return prisma.communityPage.update({
    where: { id: pageId },
    data: {
      subscriptionPlan: input.plan,
      subscriptionExpiresAt: input.expiresAt,
      subscriptionStatus: input.status,
    },
  });
}

/** Daily job: recompute Active → Expiring Soon (<=14 days) → Expired. */
export async function recomputeSubscriptionStatuses() {
  const now = new Date();
  const soon = new Date(now.getTime() + 14 * 24 * 3600_000);

  await prisma.communityPage.updateMany({
    where: { subscriptionExpiresAt: { lt: now }, subscriptionStatus: { in: ['ACTIVE', 'EXPIRING_SOON'] } },
    data: { subscriptionStatus: 'EXPIRED' },
  });
  await prisma.communityPage.updateMany({
    where: { subscriptionExpiresAt: { gte: now, lte: soon }, subscriptionStatus: 'ACTIVE' },
    data: { subscriptionStatus: 'EXPIRING_SOON' },
  });

  // Send expiry reminder notifications to owners of EXPIRING_SOON pages
  const expiringPages = await prisma.communityPage.findMany({
    where: { subscriptionStatus: 'EXPIRING_SOON', deletedAt: null },
    include: { owners: true },
  });
  for (const page of expiringPages) {
    for (const owner of page.owners) {
      await enqueueNotification({
        userId: owner.userId,
        templateKey: 'SUBSCRIPTION_EXPIRY_REMINDER',
        category: 'SERVICE',
        to: { PUSH: owner.userId, IN_APP: owner.userId },
        body: `Your community page "${page.name}" subscription is expiring soon. Please renew to avoid service interruption.`,
      });
    }
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function pageAnalytics(pageId: string, actor: { userId: string; isSuperAdmin: boolean }) {
  await assertOwnerCanManage(pageId, actor.userId, actor.isSuperAdmin);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600_000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600_000);

  const [
    totalMembers,
    newMembersThisMonth,
    newMembersThisWeek,
    pendingRequests,
    totalPosts,
    recentPosts,
    monthAgoMembers,
  ] = await Promise.all([
    prisma.communityPageMember.count({ where: { pageId, status: 'APPROVED' } }),
    prisma.communityPageMember.count({ where: { pageId, status: 'APPROVED', createdAt: { gte: thirtyDaysAgo } } }),
    prisma.communityPageMember.count({ where: { pageId, status: 'APPROVED', createdAt: { gte: sevenDaysAgo } } }),
    prisma.communityPageMember.count({ where: { pageId, status: 'PENDING' } }),
    prisma.feedPost.count({ where: { communityPageId: pageId, deletedAt: null } }),
    prisma.feedPost.count({ where: { communityPageId: pageId, deletedAt: null, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.communityPageMember.count({ where: { pageId, status: 'APPROVED', createdAt: { lt: thirtyDaysAgo } } }),
  ]);

  return {
    totalMembers,
    newMembersThisMonth,
    newMembersThisWeek,
    pendingRequests,
    totalPosts,
    recentPosts,
    memberGrowthLast30Days: totalMembers - monthAgoMembers,
  };
}
