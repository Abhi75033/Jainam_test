import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { prisma } from '@/config/prisma';
import { serializeMemberPublic } from '@/modules/members/members.serializer';

const searchQuerySchema = z.object({
  query: z.object({
    q: z.string().min(2),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

/**
 * Global search (§5.23): by public IDs (JFJT108 etc.), names, cities.
 * Typing an exact public ID resolves straight to that entity's profile.
 */
export const searchRoutes = Router();

searchRoutes.get(
  '/',
  requireAuth,
  validate(searchQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { q } = req.query as unknown as { q: string };
    const query = q.trim();

    // Exact public-ID match: route to the owning entity directly
    const idMatch = query.toUpperCase().match(/^JF[A-Z]{1,4}\d+$/);
    if (idMatch) {
      const publicId = query.toUpperCase();
      const [org, member, monk, event, tour, communityPage] = await Promise.all([
        prisma.organization.findUnique({ where: { publicId }, select: { id: true, publicId: true, name: true, type: true, city: true } }),
        prisma.member.findUnique({ where: { publicId } }),
        prisma.monkProfile.findUnique({ where: { publicId }, select: { id: true, publicId: true, dikshaName: true, photoUrl: true } }),
        prisma.event.findUnique({ where: { publicId }, select: { id: true, publicId: true, title: true, startAt: true } }),
        prisma.tour.findUnique({ where: { publicId }, select: { id: true, publicId: true, name: true } }),
        prisma.communityPage.findUnique({ where: { publicId }, select: { id: true, publicId: true, name: true } }),
      ]);

      const exact =
        (org && { type: 'ORGANIZATION' as const, entity: org }) ||
        (member && { type: 'MEMBER' as const, entity: serializeMemberPublic(member) }) ||
        (monk && { type: 'MONK' as const, entity: monk }) ||
        (event && { type: 'EVENT' as const, entity: event }) ||
        (tour && { type: 'TOUR' as const, entity: tour }) ||
        (communityPage && { type: 'COMMUNITY_PAGE' as const, entity: communityPage }) ||
        null;

      return ok(res, { exactMatch: exact, results: exact ? [exact] : [] });
    }

    // Fuzzy search across names + cities
    const [orgs, monks, events, pages] = await Promise.all([
      prisma.organization.findMany({
        where: { deletedAt: null, OR: [{ name: { contains: query, mode: 'insensitive' } }, { city: { contains: query, mode: 'insensitive' } }] },
        select: { id: true, publicId: true, name: true, type: true, city: true, logoUrl: true },
        take: 10,
      }),
      prisma.monkProfile.findMany({
        where: { deletedAt: null, dikshaName: { contains: query, mode: 'insensitive' } },
        select: { id: true, publicId: true, dikshaName: true, photoUrl: true },
        take: 10,
      }),
      prisma.event.findMany({
        where: { deletedAt: null, status: { in: ['PUBLISHED', 'RSVP_SALES_OPEN', 'LIVE'] }, title: { contains: query, mode: 'insensitive' } },
        select: { id: true, publicId: true, title: true, startAt: true, venue: true },
        take: 10,
      }),
      prisma.communityPage.findMany({
        where: { deletedAt: null, name: { contains: query, mode: 'insensitive' } },
        select: { id: true, publicId: true, name: true, logoUrl: true },
        take: 10,
      }),
    ]);

    return ok(res, {
      exactMatch: null,
      results: [
        ...orgs.map((entity) => ({ type: 'ORGANIZATION' as const, entity })),
        ...monks.map((entity) => ({ type: 'MONK' as const, entity })),
        ...events.map((entity) => ({ type: 'EVENT' as const, entity })),
        ...pages.map((entity) => ({ type: 'COMMUNITY_PAGE' as const, entity })),
      ],
    });
  }),
);
