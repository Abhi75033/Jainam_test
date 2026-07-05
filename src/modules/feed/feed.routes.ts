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
    const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });
    if (!member) throw ApiError.notFound('Member profile not found');
    const { page, pageSize } = req.query as any;
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
