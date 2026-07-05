import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, requirePermission } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';
import * as newsService from './news.service';

const publishNewsSchema = z.object({
  body: z.object({
    organizationId: z.string().optional(),
    title: z.string().min(1),
    description: z.string().optional(),
    coverUrl: z.string().optional(),
    bottomImageUrl: z.string().optional(),
    links: z.array(z.string()).optional(),
    categoryId: z.string().optional(),
  }),
});

async function requireMember(userId: string) {
  const member = await prisma.member.findUnique({ where: { userId } });
  if (!member) throw ApiError.notFound('Member profile not found');
  return member;
}

export const newsRoutes = Router();

// Created by Super Admin + Temple/JC admins (§5.15)
newsRoutes.post('/', requireAuth, requirePermission('NEWS', 'CREATE'), validate(publishNewsSchema), asyncHandler(async (req: Request, res: Response) => {
  const news = await newsService.publishNews({ ...req.body, createdById: req.actor!.userId });
  return created(res, news);
}));

newsRoutes.get('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, pageSize = 20 } = req.query as any;
  const { total, rows } = await newsService.listActiveNews(Number(page), Number(pageSize));
  return ok(res, rows, { total });
}));

newsRoutes.patch('/:newsId', requireAuth, requirePermission('NEWS', 'EDIT'), asyncHandler(async (req: Request, res: Response) => {
  const news = await newsService.updateNews(req.params.newsId as string, req.body, { userId: req.actor!.userId, isSuperAdmin: req.actor!.isSuperAdmin });
  return ok(res, news);
}));

// Restore + permanent delete: Super Admin only (§5.15)
newsRoutes.post('/:newsId/restore', requireAuth, requireRole('SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const news = await newsService.restoreNews(req.params.newsId as string);
  return ok(res, news);
}));

newsRoutes.delete('/:newsId', requireAuth, requireRole('SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  await newsService.deleteNews(req.params.newsId as string, req.actor!.userId);
  return ok(res, { deleted: true });
}));

// Member actions: read, bookmark, share only — no comments, no likes (§5.15)
newsRoutes.post('/:newsId/bookmark', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const bookmark = await newsService.bookmarkNews(req.params.newsId as string, member.id);
  return created(res, bookmark);
}));

newsRoutes.post('/:newsId/unbookmark', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  await newsService.unbookmarkNews(req.params.newsId as string, member.id);
  return ok(res, { unbookmarked: true });
}));

newsRoutes.get('/bookmarks/my', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const bookmarks = await newsService.myBookmarks(member.id);
  return ok(res, bookmarks);
}));
