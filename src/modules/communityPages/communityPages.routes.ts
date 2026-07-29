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
    shortName: z.string().optional(),
    logoUrl: z.string().optional(),
    bannerUrl: z.string().optional(),
    about: z.string().optional(),
    categoryId: z.string().optional(),
    contacts: z.record(z.string(), z.unknown()).optional(),
    socialLinks: z.record(z.string(), z.unknown()).optional(),
    visibilityConfig: z.record(z.string(), z.unknown()).optional(),
    joinApprovalMode: z.enum(['AUTO', 'MANUAL']).default('MANUAL'),
    ownerUserIds: z.array(z.string()).min(1),
    // Extended profile fields
    orgType: z.string().optional(),
    establishedYear: z.coerce.number().int().min(1800).max(2100).optional(),
    operatesFrom: z.enum(['Online', 'Office', 'Temple', 'Community']).optional(),
    officeAddress: z.string().optional(),
    googleMapsUrl: z.string().optional(),
    googleFormName: z.string().optional(),
    googleFormLink: z.string().optional(),
    gallery: z.array(z.string()).max(10).optional(),
    // Visibility
    communityVisibility: z.enum(['PUBLIC', 'MEMBERS_ONLY']).default('PUBLIC'),
    geoVisibility: z.enum(['Global', 'Country', 'State', 'District', 'City', 'Area']).default('Global'),
    geoCountry: z.string().optional(),
    geoState: z.string().optional(),
    geoCity: z.string().optional(),
    // Subscription
    subscriptionStartDate: z.coerce.date().optional(),
    subscriptionExpiresAt: z.coerce.date().optional(),
  }),
});

// Owner-editable subset — excludes ownerUserIds, subscription*, geoVisibility
const updatePageSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    shortName: z.string().optional(),
    logoUrl: z.string().optional(),
    bannerUrl: z.string().optional(),
    about: z.string().optional(),
    categoryId: z.string().optional(),
    contacts: z.record(z.string(), z.unknown()).optional(),
    socialLinks: z.record(z.string(), z.unknown()).optional(),
    visibilityConfig: z.record(z.string(), z.unknown()).optional(),
    joinApprovalMode: z.enum(['AUTO', 'MANUAL']).optional(),
    orgType: z.string().optional(),
    establishedYear: z.coerce.number().int().min(1800).max(2100).optional(),
    operatesFrom: z.enum(['Online', 'Office', 'Temple', 'Community']).optional(),
    officeAddress: z.string().optional(),
    googleMapsUrl: z.string().optional(),
    googleFormName: z.string().optional(),
    googleFormLink: z.string().optional(),
    gallery: z.array(z.string()).max(10).optional(),
  }),
});

// Super-Admin only — subscription + visibility + owner management
const superAdminUpdateSchema = z.object({
  body: z.object({
    subscriptionPlan: z.string().optional(),
    subscriptionStartDate: z.coerce.date().optional(),
    subscriptionExpiresAt: z.coerce.date().optional(),
    subscriptionStatus: z.enum(['ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'SUSPENDED']).optional(),
    ownerUserIds: z.array(z.string()).optional(),
    communityVisibility: z.enum(['PUBLIC', 'MEMBERS_ONLY']).optional(),
    geoVisibility: z.enum(['Global', 'Country', 'State', 'District', 'City', 'Area']).optional(),
    geoCountry: z.string().optional(),
    geoState: z.string().optional(),
    geoCity: z.string().optional(),
  }),
});

const membershipDecisionSchema = z.object({
  body: z.object({ memberId: z.string().min(1), decision: z.enum(['APPROVED', 'REJECTED']) }),
});

async function requireMember(userId: string) {
  const member = await prisma.member.findUnique({ where: { userId } });
  if (!member) throw ApiError.notFound('Member profile not found');
  return member;
}

export const communityPageRoutes = Router();

// ─── List (with optional search/filter) ─────────────────────────────────────
communityPageRoutes.get('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { search, categoryId, geoState, geoCity, status } = req.query as Record<string, string>;

  const rows = await prisma.communityPage.findMany({
    where: {
      deletedAt: null,
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
      ...(categoryId && { categoryId }),
      ...(geoState && { geoState: { contains: geoState, mode: 'insensitive' } }),
      ...(geoCity && { geoCity: { contains: geoCity, mode: 'insensitive' } }),
      ...(status && { subscriptionStatus: status as any }),
    },
    include: {
      category: { select: { name: true } },
      _count: { select: { members: { where: { status: 'APPROVED' } }, posts: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return ok(res, rows);
}));

// ─── Create (Super Admin only) ────────────────────────────────────────────────
communityPageRoutes.post('/', requireAuth, requireRole('SUPER_ADMIN'), validate(createPageSchema), asyncHandler(async (req: Request, res: Response) => {
  const page = await pagesService.createPage({ ...req.body, createdById: req.actor!.userId });
  return created(res, page);
}));

// ─── Get single page ──────────────────────────────────────────────────────────
communityPageRoutes.get('/:pageId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const page = await pagesService.getPage(req.params.pageId as string);
  return ok(res, page);
}));

// ─── Owner edit (restricted fields only) ─────────────────────────────────────
communityPageRoutes.patch('/:pageId', requireAuth, validate(updatePageSchema), asyncHandler(async (req: Request, res: Response) => {
  const page = await pagesService.updatePage(req.params.pageId as string, req.body, { userId: req.actor!.userId, isSuperAdmin: req.actor!.isSuperAdmin });
  return ok(res, page);
}));

// ─── Super Admin full update (subscription + visibility + owners) ─────────────
communityPageRoutes.patch('/:pageId/admin', requireAuth, requireRole('SUPER_ADMIN'), validate(superAdminUpdateSchema), asyncHandler(async (req: Request, res: Response) => {
  const page = await pagesService.superAdminUpdatePage(req.params.pageId as string, req.body);
  return ok(res, page);
}));

// ─── Delete (Super Admin only) ────────────────────────────────────────────────
communityPageRoutes.delete('/:pageId', requireAuth, requireRole('SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  await prisma.communityPage.update({ where: { id: req.params.pageId as string }, data: { deletedAt: new Date() } });
  return ok(res, { deleted: true });
}));

// ─── Join Community ───────────────────────────────────────────────────────────
communityPageRoutes.post('/:pageId/join', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const membership = await pagesService.joinPage(req.params.pageId as string, member.id);
  return created(res, membership);
}));

// ─── Leave Community ──────────────────────────────────────────────────────────
communityPageRoutes.post('/:pageId/leave', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  await pagesService.leavePage(req.params.pageId as string, member.id);
  return ok(res, { left: true });
}));

// ─── Member decision (Approve / Reject) ──────────────────────────────────────
communityPageRoutes.post('/:pageId/members/decision', requireAuth, validate(membershipDecisionSchema), asyncHandler(async (req: Request, res: Response) => {
  const row = await pagesService.decideMembership(req.params.pageId as string, req.body.memberId, req.body.decision, { userId: req.actor!.userId, isSuperAdmin: req.actor!.isSuperAdmin });
  return ok(res, row);
}));

// ─── Remove member (owner action) ────────────────────────────────────────────
communityPageRoutes.delete('/:pageId/members/:memberId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  await pagesService.removeMember(req.params.pageId as string, req.params.memberId as string, { userId: req.actor!.userId, isSuperAdmin: req.actor!.isSuperAdmin });
  return ok(res, { removed: true });
}));

// ─── List members (with status filter) ───────────────────────────────────────
communityPageRoutes.get('/:pageId/members', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const status = (req.query.status as 'PENDING' | 'APPROVED' | 'REJECTED') ?? 'APPROVED';
  const rows = await pagesService.listPageMembers(req.params.pageId as string, status, { userId: req.actor!.userId, isSuperAdmin: req.actor!.isSuperAdmin });
  return ok(res, rows);
}));

// ─── Page feed ────────────────────────────────────────────────────────────────
communityPageRoutes.get('/:pageId/feed', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const posts = await pagesService.getPageFeed(req.params.pageId as string);
  return ok(res, posts);
}));

// ─── Create post on page ──────────────────────────────────────────────────────
communityPageRoutes.post('/:pageId/posts', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const post = await pagesService.createPagePost(req.params.pageId as string, req.body, { userId: req.actor!.userId, isSuperAdmin: req.actor!.isSuperAdmin });
  return created(res, post);
}));

// ─── Subscription (Super Admin only) ─────────────────────────────────────────
communityPageRoutes.patch('/:pageId/subscription', requireAuth, requireRole('SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const page = await pagesService.updateSubscription(req.params.pageId as string, req.body);
  return ok(res, page);
}));

// ─── Analytics ────────────────────────────────────────────────────────────────
communityPageRoutes.get('/:pageId/analytics', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const analytics = await pagesService.pageAnalytics(req.params.pageId as string, { userId: req.actor!.userId, isSuperAdmin: req.actor!.isSuperAdmin });
  return ok(res, analytics);
}));
