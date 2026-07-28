import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission, scopeToOrganization } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';

/** Chaturmas seasonal stay records per organization. */
export const chaturmasRoutes = Router();

const MAX_IMAGES = 20;
const MAX_LINKS = 5;

const createChaturmasSchema = z.object({
  body: z.object({
    organizationId: z.string().min(1),
    monkId: z.string().optional(),
    monkName: z.string().optional(),
    monkGroupId: z.string().optional(),
    locationName: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    contactPerson: z.string().optional(),
    contactMobile: z.string().optional(),
    status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
    notes: z.string().optional(),
    monkIds: z.array(z.string()).optional(),
    sponsorIds: z.array(z.string()).optional(),
    images: z.array(z.string()).max(MAX_IMAGES, `Maximum ${MAX_IMAGES} images allowed`).optional(),
    links: z.array(z.string()).max(MAX_LINKS, `Maximum ${MAX_LINKS} links allowed`).optional(),
    year: z.number().optional(),
  }),
});

const updateChaturmasSchema = z.object({
  body: z.object({
    monkName: z.string().optional(),
    monkGroupId: z.string().optional(),
    locationName: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    contactPerson: z.string().optional(),
    contactMobile: z.string().optional(),
    status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
    notes: z.string().optional(),
    monkIds: z.array(z.string()).optional(),
    sponsorIds: z.array(z.string()).optional(),
    images: z.array(z.string()).max(MAX_IMAGES, `Maximum ${MAX_IMAGES} images allowed`).optional(),
    links: z.array(z.string()).max(MAX_LINKS, `Maximum ${MAX_LINKS} links allowed`).optional(),
    year: z.number().optional(),
  }),
});

/** Prisma stores monkIds/sponsorIds as Json — narrow safely to a string[] regardless of what's actually stored. */
function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Chaturmas Status shown to members: derived from today vs start/end date, independent of the admin lifecycle `status` field. */
function computeDisplayStatus(startDate: Date, endDate: Date | null): 'UPCOMING' | 'ONGOING' | 'COMPLETED' {
  const now = new Date();
  if (now < startDate) return 'UPCOMING';
  if (endDate && now > endDate) return 'COMPLETED';
  return 'ONGOING';
}

/** If a Monk Group is linked, expand it to include every monk currently in that group. */
async function expandMonkGroup(monkIds: string[] | undefined, monkGroupId: string | undefined): Promise<string[] | undefined> {
  if (!monkGroupId) return monkIds;
  const groupMonks = await prisma.monkProfile.findMany({ where: { groupId: monkGroupId }, select: { id: true } });
  const groupMonkIds = groupMonks.map((m) => m.id);
  const merged = new Set([...(monkIds || []), ...groupMonkIds]);
  return Array.from(merged);
}

async function enrichPlans<T extends { monkIds: unknown; sponsorIds: unknown; startDate: Date; endDate: Date | null }>(rows: T[]) {
  const allMonkIds = new Set<string>();
  const allSponsorIds = new Set<string>();
  rows.forEach((r) => {
    asStringArray(r.monkIds).forEach((id) => allMonkIds.add(id));
    asStringArray(r.sponsorIds).forEach((id) => allSponsorIds.add(id));
  });

  const [dbMonks, dbSponsors] = await Promise.all([
    allMonkIds.size > 0
      ? prisma.monkProfile.findMany({
          where: { id: { in: Array.from(allMonkIds) } },
          select: { id: true, publicId: true, dikshaName: true, photoUrl: true },
        })
      : [],
    allSponsorIds.size > 0
      ? prisma.member.findMany({
          where: { id: { in: Array.from(allSponsorIds) } },
          select: { id: true, publicId: true, fullName: true, currentAddress: true },
        })
      : [],
  ]);

  const monkMap = new Map(dbMonks.map((m) => [m.id, m]));
  const sponsorMap = new Map(
    dbSponsors.map((s) => {
      const addr = (s.currentAddress as { city?: string; state?: string } | null) || {};
      // Sponsors: only name/city/state should ever be visible — mobile is intentionally never selected above.
      return [s.id, { id: s.id, publicId: s.publicId, fullName: s.fullName, city: addr.city, state: addr.state }];
    }),
  );

  return rows.map((r) => ({
    ...r,
    displayStatus: computeDisplayStatus(r.startDate, r.endDate),
    monks: asStringArray(r.monkIds)
      .map((id) => {
        const m = monkMap.get(id);
        if (!m) return null;
        return { id: m.id, name: m.dikshaName, fullName: m.dikshaName, monkId: m.publicId, photoUrl: m.photoUrl };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null),
    sponsors: asStringArray(r.sponsorIds)
      .map((id) => sponsorMap.get(id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined),
  }));
}

// List Chaturmas plans for an organization
chaturmasRoutes.get(
  '/org/:organizationId',
  requireAuth,
  scopeToOrganization,
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params;
    const rows = await prisma.chaturmasPlan.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { startDate: 'desc' },
    });
    const enrichedRows = await enrichPlans(rows);
    return ok(res, enrichedRows, { total: enrichedRows.length });
  }),
);

// §C4: MS profile "Chaturmas History" — genuinely auto-populated by querying
// every Chaturmas plan this monk is actually linked to (via monkId or the
// monkIds group array), instead of a static Json blob nothing ever writes to.
chaturmasRoutes.get(
  '/monk/:monkId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { monkId } = req.params;
    const rows = await prisma.chaturmasPlan.findMany({
      where: {
        deletedAt: null,
        OR: [{ monkId }, { monkIds: { array_contains: monkId } }],
      },
      orderBy: { startDate: 'desc' },
      include: { organization: { select: { id: true, name: true, city: true, state: true } } },
    });
    const result = rows.map((r) => ({
      id: r.id,
      year: r.year,
      startDate: r.startDate,
      endDate: r.endDate,
      status: computeDisplayStatus(r.startDate, r.endDate),
      orgId: r.organizationId,
      orgName: r.organization?.name ?? null,
      city: r.organization?.city ?? null,
      state: r.organization?.state ?? null,
    }));
    return ok(res, result, { total: result.length });
  }),
);

// Get single Chaturmas plan
chaturmasRoutes.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const row = await prisma.chaturmasPlan.findUnique({ where: { id: req.params.id } });
    if (!row || row.deletedAt) throw ApiError.notFound('Chaturmas plan not found.');
    const [enriched] = await enrichPlans([row]);
    return ok(res, enriched);
  }),
);

// Create Chaturmas plan
chaturmasRoutes.post(
  '/',
  requireAuth,
  requirePermission('EVENTS', 'CREATE'),
  validate(createChaturmasSchema),
  asyncHandler(async (req: Request, res: Response) => {
    let { monkName, monkIds, monkGroupId, ...rest } = req.body;
    monkIds = await expandMonkGroup(monkIds, monkGroupId);
    if (!monkName && monkIds && monkIds.length > 0) {
      const monks = await prisma.monkProfile.findMany({
        where: { id: { in: monkIds } },
        select: { dikshaName: true },
      });
      monkName = monks.map((m) => m.dikshaName).join(', ');
    }
    if (!monkName) monkName = 'Custom MS Record';

    const plan = await prisma.chaturmasPlan.create({
      data: {
        ...rest,
        monkIds: monkIds || undefined,
        monkName,
        createdById: req.actor!.userId,
      },
    });
    return created(res, plan);
  }),
);

// Update Chaturmas plan
chaturmasRoutes.patch(
  '/:id',
  requireAuth,
  requirePermission('EVENTS', 'EDIT'),
  validate(updateChaturmasSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const existing = await prisma.chaturmasPlan.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) throw ApiError.notFound('Chaturmas plan not found.');

    let { monkName, monkIds, monkGroupId, ...rest } = req.body;
    monkIds = await expandMonkGroup(monkIds, monkGroupId);
    if (monkIds && !monkName) {
      const monks = await prisma.monkProfile.findMany({
        where: { id: { in: monkIds } },
        select: { dikshaName: true },
      });
      monkName = monks.map((m) => m.dikshaName).join(', ');
    }

    const updated = await prisma.chaturmasPlan.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        monkIds: monkIds !== undefined ? monkIds : undefined,
        ...(monkName ? { monkName } : {}),
      },
    });
    return ok(res, updated);
  }),
);

// Soft delete
chaturmasRoutes.delete(
  '/:id',
  requireAuth,
  requirePermission('EVENTS', 'DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const existing = await prisma.chaturmasPlan.findUnique({ where: { id: req.params.id } });
    if (!existing) throw ApiError.notFound('Chaturmas plan not found.');
    const deleted = await prisma.chaturmasPlan.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    return ok(res, deleted);
  }),
);
