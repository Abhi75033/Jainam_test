import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';

/**
 * Master Data (§4.8): all lists Super Admin-CRUD only, viewable by all
 * authenticated users, never hardcoded. One generic router covers every
 * name-keyed master list; hierarchical lists (sub-communities, gacchas,
 * designations, counter sub-types) get their own create routes below.
 */

const SIMPLE_LISTS = {
  'communities': prisma.community,
  'tithi-calendar-types': prisma.tithiCalendarType,
  'bhagwans': prisma.bhagwanMaster,
  'booking-categories': prisma.bookingCategory,
  'event-categories': prisma.eventCategory,
  'feed-categories': prisma.feedCategory,
  'offer-categories': prisma.offerCategory,
  'news-categories': prisma.newsCategory,
  'community-page-categories': prisma.communityPageCategory,
  'sponsor-categories': prisma.sponsorCategory,
  'staff-departments': prisma.staffDepartment,
  'volunteer-areas': prisma.volunteerArea,
  'donation-categories': prisma.donationCategory,
  'relationship-types': prisma.relationshipType,
  'facilities': prisma.facilityMaster,
  'counter-types': prisma.counterType,
  'tour-categories': prisma.tourCategory,
} as const;

type ListKey = keyof typeof SIMPLE_LISTS;

const nameSchema = z.object({ body: z.object({ name: z.string().min(1) }) });

function getModel(listKey: string) {
  const model = SIMPLE_LISTS[listKey as ListKey];
  if (!model) throw ApiError.notFound(`Unknown master list: ${listKey}`);
  return model as any;
}

export const masterDataRoutes = Router();

// Custom Bhagwan Master routes with Category support
masterDataRoutes.get('/bhagwans', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { category } = req.query;
  const rows = await prisma.bhagwanMaster.findMany({
    where: {
      deletedAt: null,
      category: category ? (category as string) : undefined,
    },
    orderBy: [
      { category: 'asc' },
      { name: 'asc' }
    ]
  });
  return ok(res, rows);
}));

masterDataRoutes.post('/bhagwans', requireAuth, requireRole('SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { name, category, imageUrl } = req.body;
  if (!name) throw ApiError.validation({ name: ['Deity name is required.'] });
  const row = await prisma.bhagwanMaster.create({
    data: {
      name,
      category: category || 'Others',
      imageUrl,
    },
  });
  return created(res, row);
}));

masterDataRoutes.patch('/bhagwans/:id', requireAuth, requireRole('SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { name, category, imageUrl } = req.body;
  const row = await prisma.bhagwanMaster.update({
    where: { id: req.params.id },
    data: {
      name: name || undefined,
      category: category || undefined,
      imageUrl: imageUrl !== undefined ? imageUrl : undefined,
    },
  });
  return ok(res, row);
}));

// Hierarchical lists (registered before the generic /:listKey routes)
masterDataRoutes.get('/sub-communities', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const rows = await prisma.subCommunity.findMany({ where: { deletedAt: null, communityId: req.query.communityId as string | undefined }, include: { community: true } });
  return ok(res, rows);
}));

masterDataRoutes.post('/sub-communities', requireAuth, requireRole('SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const row = await prisma.subCommunity.create({ data: { communityId: req.body.communityId, name: req.body.name } });
  return created(res, row);
}));

masterDataRoutes.get('/gacchas', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const rows = await prisma.gaccha.findMany({ where: { deletedAt: null, subCommunityId: req.query.subCommunityId as string | undefined }, include: { subCommunity: true } });
  return ok(res, rows);
}));

masterDataRoutes.post('/gacchas', requireAuth, requireRole('SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const row = await prisma.gaccha.create({ data: { subCommunityId: req.body.subCommunityId, name: req.body.name } });
  return created(res, row);
}));

masterDataRoutes.get('/staff-designations', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const rows = await prisma.staffDesignation.findMany({ where: { deletedAt: null, departmentId: req.query.departmentId as string | undefined } });
  return ok(res, rows);
}));

masterDataRoutes.post('/staff-designations', requireAuth, requireRole('SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const row = await prisma.staffDesignation.create({ data: { departmentId: req.body.departmentId, name: req.body.name } });
  return created(res, row);
}));

masterDataRoutes.get('/counter-sub-types', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const rows = await prisma.counterSubType.findMany({ where: { deletedAt: null, counterTypeId: req.query.counterTypeId as string | undefined } });
  return ok(res, rows);
}));

masterDataRoutes.post('/counter-sub-types', requireAuth, requireRole('SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const row = await prisma.counterSubType.create({ data: { counterTypeId: req.body.counterTypeId, name: req.body.name } });
  return created(res, row);
}));

// Pathshala Centers directory (§5.5) — Super Admin CRUD, members view + call only
masterDataRoutes.get('/pathshala-centers', requireAuth, asyncHandler(async (_req: Request, res: Response) => {
  const rows = await prisma.pathshalaCenter.findMany({ where: { deletedAt: null }, include: { contactMember: { select: { fullName: true, mobile: true } } } });
  return ok(res, rows);
}));

masterDataRoutes.post('/pathshala-centers', requireAuth, requireRole('SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const row = await prisma.pathshalaCenter.create({ data: { ...req.body, createdById: req.actor!.userId } });
  return created(res, row);
}));

// Generic name-keyed lists
masterDataRoutes.get('/:listKey', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const model = getModel(req.params.listKey as string);
  const rows = await model.findMany({ where: { deletedAt: null } });
  return ok(res, rows);
}));

masterDataRoutes.post('/:listKey', requireAuth, requireRole('SUPER_ADMIN'), validate(nameSchema), asyncHandler(async (req: Request, res: Response) => {
  const model = getModel(req.params.listKey as string);
  const row = await model.create({ data: { name: req.body.name } });
  return created(res, row);
}));

masterDataRoutes.patch('/:listKey/:id', requireAuth, requireRole('SUPER_ADMIN'), validate(nameSchema), asyncHandler(async (req: Request, res: Response) => {
  const model = getModel(req.params.listKey as string);
  const row = await model.update({ where: { id: req.params.id as string }, data: { name: req.body.name } });
  return ok(res, row);
}));

// Soft delete — Super Admin only (per §3 delete rules; e.g. donation category delete)
masterDataRoutes.delete('/:listKey/:id', requireAuth, requireRole('SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const model = getModel(req.params.listKey as string);
  const row = await model.update({ where: { id: req.params.id as string }, data: { deletedAt: new Date() } });
  return ok(res, row);
}));
