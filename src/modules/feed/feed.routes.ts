import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission, scopeToOrganization } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';
import * as feedService from './feed.service';

const createPostSchema = z.object({
  body: z.object({
    organizationId: z.string().optional(),
    communityPageId: z.string().optional(),
    title: z.string().min(1),
    description: z.string().optional(),
    coverUrl: z.string().optional(),
    images: z.array(z.string()).optional(),
    videoUrl: z.string().optional(),
    pdfUrl: z.string().optional(),
    externalLink: z.string().optional(),
    categoryId: z.string().optional(),
    visibilityConfig: z.record(z.string(), z.unknown()).optional(),
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().optional(),
  }),
});

const feedQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(15),
    q: z.string().optional(),
    categoryId: z.string().optional(),
    filterKeys: z.union([z.string(), z.array(z.string())]).optional(),
    savedOnly: z.preprocess((val) => val === 'true', z.boolean()).optional(),
  }),
});

export const feedRoutes = Router();

feedRoutes.get(
  '/',
  requireAuth,
  validate(feedQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, pageSize, q, categoryId, filterKeys, savedOnly } = req.query as any;
    const resolvedFilterKeys = typeof filterKeys === 'string' ? [filterKeys] : filterKeys;
    
    const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });

    // Accounts without a member profile (Super Admin, staff-only) get the
    // global chronological view instead of the personalized smart feed.
    if (!member) {
      const posts = await prisma.feedPost.findMany({
        where: { isActive: true, deletedAt: null },
        include: { organization: { select: { name: true, publicId: true, logoUrl: true } }, category: true, poll: true },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
      });
      return ok(res, {
        topBanner: null,
        items: posts.map((post) => ({ kind: 'POST', post })),
        total: posts.length,
        page: Number(page),
        pageSize: Number(pageSize),
      });
    }

    const feed = await feedService.getSmartFeed(member.id, Number(page), Number(pageSize), {
      q,
      categoryId,
      filterKeys: resolvedFilterKeys,
      savedOnly,
    });
    return ok(res, feed);
  }),
);

feedRoutes.post(
  '/posts',
  requireAuth,
  requirePermission('FEED', 'CREATE'),
  scopeToOrganization,
  validate(createPostSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const post = await feedService.createManualPost({ ...req.body, authorUserId: req.actor!.userId });
    return created(res, post);
  }),
);

feedRoutes.get(
  '/posts/:postId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });
    if (!member) throw ApiError.notFound('Member profile not found');
    const post = await feedService.getPost(req.params.postId as string, member.id);
    return ok(res, post);
  }),
);

// Bookmark Feed Posts
feedRoutes.post(
  '/posts/:postId/bookmark',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });
    if (!member) throw ApiError.notFound('Member profile not found');
    const postId = req.params.postId as string;
    
    const bookmark = await prisma.feedPostSave.upsert({
      where: { feedPostId_memberId: { feedPostId: postId, memberId: member.id } },
      update: {},
      create: { feedPostId: postId, memberId: member.id }
    });

    await prisma.feedPost.update({
      where: { id: postId },
      data: { bookmarkCount: { increment: 1 } }
    }).catch(() => {});

    return ok(res, bookmark);
  })
);

feedRoutes.delete(
  '/posts/:postId/bookmark',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });
    if (!member) throw ApiError.notFound('Member profile not found');
    const postId = req.params.postId as string;

    await prisma.feedPostSave.delete({
      where: { feedPostId_memberId: { feedPostId: postId, memberId: member.id } }
    }).catch(() => {});

    await prisma.feedPost.update({
      where: { id: postId },
      data: { bookmarkCount: { decrement: 1 } }
    }).catch(() => {});

    return ok(res, { success: true });
  })
);

// Incremental Analytics Tracking
feedRoutes.post(
  '/posts/:postId/share',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.feedPost.update({
      where: { id: req.params.postId },
      data: { shareCount: { increment: 1 } }
    });
    return ok(res, { success: true });
  })
);

feedRoutes.post(
  '/posts/:postId/click',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.feedPost.update({
      where: { id: req.params.postId },
      data: { clickCount: { increment: 1 } }
    });
    return ok(res, { success: true });
  })
);

// Analytics Metrics
feedRoutes.get(
  '/posts/:postId/analytics',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const post = await prisma.feedPost.findUnique({ where: { id: req.params.postId } });
    if (!post) throw ApiError.notFound('Post not found');
    return ok(res, {
      viewCount: post.viewCount,
      shareCount: post.shareCount,
      bookmarkCount: post.bookmarkCount,
      clickCount: post.clickCount,
      reach: Math.round(post.viewCount * 1.25)
    });
  })
);

// Performance Export Reports
feedRoutes.get(
  '/analytics/report',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, format } = req.query;
    const whereClause: any = { deletedAt: null };
    if (organizationId) {
      whereClause.organizationId = organizationId as string;
    }
    const posts = await prisma.feedPost.findMany({
      where: whereClause,
      include: { category: true, organization: true }
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=feed_report.csv');
      let csv = 'Title,Category,Views,Shares,Bookmarks,Clicks\n';
      for (const p of posts) {
        csv += `"${p.title || ''}","${p.category?.name || 'Uncategorized'}",${p.viewCount},${p.shareCount},${p.bookmarkCount},${p.clickCount}\n`;
      }
      return res.send(csv);
    }
    
    return ok(res, posts.map(p => ({
      id: p.id,
      title: p.title,
      category: p.category?.name || 'Uncategorized',
      views: p.viewCount,
      shares: p.shareCount,
      bookmarks: p.bookmarkCount,
      clicks: p.clickCount
    })));
  })
);
