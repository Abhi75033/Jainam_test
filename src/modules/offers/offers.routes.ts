import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';
import * as offersService from './offers.service';

const createOfferSchema = z.object({
  body: z.object({
    companyName: z.string().min(1),
    companyLogoUrl: z.string().optional(),
    bannerUrl: z.string().optional(),
    title: z.string().min(1),
    description: z.string().optional(),
    categoryId: z.string().optional(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    contact: z.record(z.string(), z.unknown()).optional(),
    links: z.object({ whatsapp: z.string().optional(), website: z.string().optional(), maps: z.string().optional() }).optional(),
    visibilityConfig: z.record(z.string(), z.unknown()).optional(),
  }),
});

const browseQuerySchema = z.object({
  query: z.object({
    section: z.enum(['near-you', 'home-city', 'recent', 'expiring-soon', 'saved']).default('recent'),
    categoryIds: z.string().optional(), // comma-separated
    search: z.string().optional(),
  }),
});

async function requireMember(userId: string) {
  const member = await prisma.member.findUnique({ where: { userId } });
  if (!member) throw ApiError.notFound('Member profile not found');
  return member;
}

export const offerRoutes = Router();

// Root list: Super Admin sees all (incl. expired via ?includeExpired=true); members see active offers
offerRoutes.get('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const now = new Date();
  const includeExpired = req.actor!.isSuperAdmin && req.query.includeExpired === 'true';
  const offers = await prisma.offer.findMany({
    where: { deletedAt: null, ...(includeExpired ? {} : { endAt: { gte: now } }) },
    include: { category: { select: { name: true } }, _count: { select: { saves: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return ok(res, offers);
}));

// Super Admin CRUD (§5.14)
offerRoutes.post('/', requireAuth, requireRole('SUPER_ADMIN'), validate(createOfferSchema), asyncHandler(async (req: Request, res: Response) => {
  const offer = await offersService.createOffer({ ...req.body, createdById: req.actor!.userId });
  return created(res, offer);
}));

offerRoutes.patch('/:offerId', requireAuth, requireRole('SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const offer = await offersService.updateOffer(req.params.offerId as string, req.body);
  return ok(res, offer);
}));

// Member browse (§5.14) — members cannot edit/report offers
offerRoutes.get('/browse', requireAuth, validate(browseQuerySchema), asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const { section, categoryIds, search } = req.query as any;
  const offers = await offersService.browseOffers(member.id, section, {
    categoryIds: categoryIds ? String(categoryIds).split(',') : undefined,
    search,
  });
  return ok(res, offers);
}));

offerRoutes.post('/:offerId/save', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const save = await offersService.saveOffer(req.params.offerId as string, member.id);
  return created(res, save);
}));

offerRoutes.post('/:offerId/unsave', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  await offersService.unsaveOffer(req.params.offerId as string, member.id);
  return ok(res, { unsaved: true });
}));

offerRoutes.post('/:offerId/track/:kind', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const kind = req.params.kind as 'view' | 'click' | 'share';
  if (!['view', 'click', 'share'].includes(kind)) throw ApiError.validation({ kind: ['Must be view, click, or share'] });
  await offersService.trackOfferEvent(req.params.offerId as string, kind);
  return ok(res, { tracked: true });
}));

// Analytics — Super Admin only (§5.14)
offerRoutes.get('/:offerId/analytics', requireAuth, requireRole('SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const analytics = await offersService.offerAnalytics(req.params.offerId as string);
  return ok(res, analytics);
}));
