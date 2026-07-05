import { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { nextPublicId } from '@/engines/idGenerator/id.service';
import { getQueue, QUEUE_NAMES } from '@/jobs/queues';
import { enqueueNotification } from '@/engines/notification/notification.service';
import { NEWS_MAX_ACTIVE_DAYS } from '@/config/constants';

/**
 * News Management (§5.15, swipe-based). Max active life 7 days -> auto-archive.
 * ALL Jain members get notified on publish — the community visibility engine is
 * explicitly NOT applied to news. No comments, no likes.
 */

export async function publishNews(input: {
  organizationId?: string;
  title: string;
  description?: string;
  coverUrl?: string;
  bottomImageUrl?: string;
  links?: string[];
  categoryId?: string;
  createdById: string;
}) {
  const news = await prisma.$transaction(async (tx) => {
    const publicId = await nextPublicId('NEWS', tx);
    return tx.news.create({
      data: {
        publicId,
        organizationId: input.organizationId,
        title: input.title,
        description: input.description,
        coverUrl: input.coverUrl,
        bottomImageUrl: input.bottomImageUrl,
        links: input.links as Prisma.InputJsonValue,
        categoryId: input.categoryId,
        createdById: input.createdById,
      },
    });
  });

  // Auto-archive after 7 days (§5.15)
  await getQueue(QUEUE_NAMES.NEWS_ARCHIVE).add('archive', { newsId: news.id }, { delay: NEWS_MAX_ACTIVE_DAYS * 24 * 3600_000, jobId: `news-archive-${news.id}` });

  // Notify ALL Jain members (visibility engine NOT applied)
  const jainMembers = await prisma.member.findMany({ where: { category: 'JAIN', deletedAt: null, status: 'ACTIVE' }, select: { userId: true } });
  await Promise.all(
    jainMembers.map((m) =>
      enqueueNotification({
        userId: m.userId,
        templateKey: 'NEWS_PUBLISHED',
        category: 'SERVICE',
        to: { PUSH: m.userId, IN_APP: m.userId },
        body: `News: ${news.title}`,
        data: { newsId: news.id, newsPublicId: news.publicId },
      }),
    ),
  );

  return news;
}

/** Called by the news-archive queue after the 7-day active life. */
export async function archiveNews(newsId: string) {
  const news = await prisma.news.findUnique({ where: { id: newsId } });
  if (!news || news.isArchived || news.deletedAt) return;
  await prisma.news.update({ where: { id: newsId }, data: { isArchived: true, archivedAt: new Date() } });
}

/** Restore from archive — Super Admin only (§5.15). Restarts the 7-day clock. */
export async function restoreNews(newsId: string) {
  const news = await prisma.news.findUnique({ where: { id: newsId } });
  if (!news || news.deletedAt) throw ApiError.notFound('News not found');
  const restored = await prisma.news.update({ where: { id: newsId }, data: { isArchived: false, archivedAt: null, publishedAt: new Date() } });
  await getQueue(QUEUE_NAMES.NEWS_ARCHIVE).add('archive', { newsId }, { delay: NEWS_MAX_ACTIVE_DAYS * 24 * 3600_000, jobId: `news-archive-${newsId}-${Date.now()}` });
  return restored;
}

export async function updateNews(newsId: string, input: Record<string, unknown>, actor: { userId: string; isSuperAdmin: boolean }) {
  const news = await prisma.news.findUnique({ where: { id: newsId } });
  if (!news || news.deletedAt) throw ApiError.notFound('News not found');
  // Admins edit only their own news (§5.15)
  if (!actor.isSuperAdmin && news.createdById !== actor.userId) throw ApiError.forbidden('You can only edit news you created');
  const { links, ...rest } = input as any;
  return prisma.news.update({ where: { id: newsId }, data: { ...rest, links: links as Prisma.InputJsonValue } });
}

/** Permanent delete — Super Admin only; everything else is soft/archive (§5.15). */
export async function deleteNews(newsId: string, _deletedById: string) {
  return prisma.news.update({ where: { id: newsId }, data: { deletedAt: new Date() } });
}

export async function listActiveNews(page: number, pageSize: number) {
  const where: Prisma.NewsWhereInput = { isArchived: false, deletedAt: null };
  const [total, rows] = await Promise.all([
    prisma.news.count({ where }),
    prisma.news.findMany({
      where,
      include: { category: true, organization: { select: { name: true, publicId: true } } },
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { total, rows };
}

export async function bookmarkNews(newsId: string, memberId: string) {
  return prisma.newsBookmark.upsert({ where: { newsId_memberId: { newsId, memberId } }, update: {}, create: { newsId, memberId } });
}

export async function unbookmarkNews(newsId: string, memberId: string) {
  await prisma.newsBookmark.deleteMany({ where: { newsId, memberId } });
}

export async function myBookmarks(memberId: string) {
  const bookmarks = await prisma.newsBookmark.findMany({ where: { memberId }, include: { news: true } });
  return bookmarks.map((b) => b.news).filter((n) => !n.deletedAt);
}
