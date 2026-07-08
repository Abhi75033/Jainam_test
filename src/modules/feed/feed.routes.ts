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
  }),
});

export const feedRoutes = Router();

feedRoutes.get(
  '/',
  requireAuth,
  validate(feedQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, pageSize } = req.query as any;
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

    const feed = await feedService.getSmartFeed(member.id, Number(page), Number(pageSize));
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
