import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';
import * as pagesService from './communityPages.service';

const createPageSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    logoUrl: z.string().optional(),
    bannerUrl: z.string().optional(),
    about: z.string().optional(),
    categoryId: z.string().optional(),
    contacts: z.record(z.string(), z.unknown()).optional(),
    socialLinks: z.record(z.string(), z.unknown()).optional(),
    visibilityConfig: z.record(z.string(), z.unknown()).optional(),
    joinApprovalMode: z.enum(['AUTO', 'MANUAL']).default('MANUAL'),
    ownerUserIds: z.array(z.string()).min(1),
  }),
});

const membershipDecisionSchema = z.object({
  body: z.object({ memberId: z.string().min(1), decision: z.enum(['APPROVED', 'REJECTED']) }),
});

const subscriptionSchema = z.object({
  body: z.object({
    plan: z.string().optional(),
    expiresAt: z.coerce.date().optional(),
    status: z.enum(['ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'SUSPENDED']).optional(),
  }),
});

async function requireMember(userId: string) {
  const member = await prisma.member.findUnique({ where: { userId } });
  if (!member) throw ApiError.notFound('Member profile not found');
  return member;
}

export const communityPageRoutes = Router();

// List (any authenticated user; public pages directory)
communityPageRoutes.get('/', requireAuth, asyncHandler(async (_req: Request, res: Response) => {
  const rows = await prisma.communityPage.findMany({
    where: { deletedAt: null },
    include: {
      category: { select: { name: true } },
      _count: { select: { members: { where: { status: 'APPROVED' } }, posts: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return ok(res, rows);
}));

// Created by Super Admin only (§5.16)
communityPageRoutes.post('/', requireAuth, requireRole('SUPER_ADMIN'), validate(createPageSchema), asyncHandler(async (req: Request, res: Response) => {
  const page = await pagesService.createPage({ ...req.body, createdById: req.actor!.userId });
  return created(res, page);
}));

communityPageRoutes.get('/:pageId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const page = await pagesService.getPage(req.params.pageId as string);
  return ok(res, page);
}));

// Page owners manage only their page; blocked when subscription expired (§5.16)
communityPageRoutes.patch('/:pageId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const page = await pagesService.updatePage(req.params.pageId as string, req.body, { userId: req.actor!.userId, isSuperAdmin: req.actor!.isSuperAdmin });
  return ok(res, page);
}));

// Join Community flow
communityPageRoutes.post('/:pageId/join', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const membership = await pagesService.joinPage(req.params.pageId as string, member.id);
  return created(res, membership);
}));

communityPageRoutes.post('/:pageId/members/decision', requireAuth, validate(membershipDecisionSchema), asyncHandler(async (req: Request, res: Response) => {
  const row = await pagesService.decideMembership(req.params.pageId as string, req.body.memberId, req.body.decision, { userId: req.actor!.userId, isSuperAdmin: req.actor!.isSuperAdmin });
  return ok(res, row);
}));

communityPageRoutes.get('/:pageId/members', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const status = (req.query.status as 'PENDING' | 'APPROVED' | 'REJECTED') ?? 'APPROVED';
  const rows = await pagesService.listPageMembers(req.params.pageId as string, status, { userId: req.actor!.userId, isSuperAdmin: req.actor!.isSuperAdmin });
  return ok(res, rows);
}));

// Subscription — Super Admin only (§5.16)
communityPageRoutes.patch('/:pageId/subscription', requireAuth, requireRole('SUPER_ADMIN'), validate(subscriptionSchema), asyncHandler(async (req: Request, res: Response) => {
  const page = await pagesService.updateSubscription(req.params.pageId as string, req.body);
  return ok(res, page);
}));

communityPageRoutes.get('/:pageId/analytics', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const analytics = await pagesService.pageAnalytics(req.params.pageId as string, { userId: req.actor!.userId, isSuperAdmin: req.actor!.isSuperAdmin });
  return ok(res, analytics);
}));
