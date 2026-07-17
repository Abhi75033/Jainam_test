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
  const { ownerUserIds, createdById, contacts, socialLinks, visibilityConfig, ...rest } = input as any;

  const page = await prisma.$transaction(async (tx) => {
    const publicId = await nextPublicId('COMMUNITY_PAGE', tx);
    const created = await tx.communityPage.create({
      data: {
        publicId,
        ...rest,
        contacts: contacts as Prisma.InputJsonValue,
        socialLinks: socialLinks as Prisma.InputJsonValue,
        visibilityConfig: visibilityConfig as Prisma.InputJsonValue,
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
  const { contacts, socialLinks, visibilityConfig, ...rest } = input as any;
  return prisma.communityPage.update({
    where: { id: pageId },
    data: {
      ...rest,
      contacts: contacts as Prisma.InputJsonValue,
      socialLinks: socialLinks as Prisma.InputJsonValue,
      visibilityConfig: visibilityConfig as Prisma.InputJsonValue,
    },
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

// -----------------------------------------------------------------------------
// Join Community flow (§5.16): configurable auto/manual approval
// -----------------------------------------------------------------------------

export async function joinPage(pageId: string, memberId: string) {
  const page = await prisma.communityPage.findUnique({ where: { id: pageId } });
  if (!page || page.deletedAt) throw ApiError.notFound('Community page not found');

  const status = page.joinApprovalMode === 'AUTO' ? 'APPROVED' : 'PENDING';
  return prisma.communityPageMember.upsert({
    where: { pageId_memberId: { pageId, memberId } },
    update: { status },
    create: { pageId, memberId, status },
  });
}

export async function decideMembership(pageId: string, memberId: string, decision: 'APPROVED' | 'REJECTED', actor: { userId: string; isSuperAdmin: boolean }) {
  await assertOwnerCanManage(pageId, actor.userId, actor.isSuperAdmin);
  const row = await prisma.communityPageMember.update({
    where: { pageId_memberId: { pageId, memberId } },
    data: { status: decision },
    include: { member: { select: { userId: true } }, page: { select: { name: true } } },
  });

  await enqueueNotification({
    userId: row.member.userId,
    templateKey: 'PAGE_MEMBERSHIP_DECIDED',
    category: 'SERVICE',
    to: { PUSH: row.member.userId, IN_APP: row.member.userId },
    body: decision === 'APPROVED' ? `Your request to join ${row.page.name} was approved.` : `Your request to join ${row.page.name} was declined.`,
  });

  return row;
}

export async function listPageMembers(pageId: string, status: 'PENDING' | 'APPROVED' | 'REJECTED', actor: { userId: string; isSuperAdmin: boolean }) {
  await assertOwnerCanManage(pageId, actor.userId, actor.isSuperAdmin);
  return prisma.communityPageMember.findMany({
    where: { pageId, status },
    include: { member: { select: { publicId: true, fullName: true, photoUrl: true } } },
  });
}

// -----------------------------------------------------------------------------
// Subscription (§5.16) — Super Admin-managed
// -----------------------------------------------------------------------------

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

/** Daily job: recompute Active -> Expiring Soon (<=14 days) -> Expired. */
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
}

/** Owner analytics (§5.16). */
export async function pageAnalytics(pageId: string, actor: { userId: string; isSuperAdmin: boolean }) {
  await assertOwnerCanManage(pageId, actor.userId, actor.isSuperAdmin).catch((err) => {
    // Expired pages: owners may still VIEW analytics? Spec locks management; analytics counts as management -> rethrow
    throw err;
  });
  const [followers, posts, monthAgoFollowers] = await Promise.all([
    prisma.communityPageMember.count({ where: { pageId, status: 'APPROVED' } }),
    prisma.feedPost.count({ where: { communityPageId: pageId, deletedAt: null } }),
    prisma.communityPageMember.count({ where: { pageId, status: 'APPROVED', createdAt: { lt: new Date(Date.now() - 30 * 24 * 3600_000) } } }),
  ]);
  return {
    followers,
    posts,
    growthLast30Days: followers - monthAgoFollowers,
  };
}
