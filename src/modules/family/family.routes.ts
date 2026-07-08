import { Router, Request, Response } from 'express';
import { requireAuth } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { prisma } from '@/config/prisma';
import { addFamilyMemberSchema } from '@/modules/members/members.dto';
import { addFamilyMember } from '@/modules/members/members.controller';

/**
 * Family Members Management (§5.2). Kept as its own routed module per the
 * spec's module list, but implemented on top of members.service.ts since a
 * family member IS a Member record (auto-linked or auto-created).
 */
export const familyRoutes = Router();

familyRoutes.post('/', requireAuth, validate(addFamilyMemberSchema), addFamilyMember);

/** My family links (both directions). Members without a profile (e.g. Super Admin) get an empty list. */
familyRoutes.get(
  '/my',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });
    if (!member) return ok(res, []);

    const [asPrimary, asRelated] = await Promise.all([
      prisma.familyMember.findMany({
        where: { primaryMemberId: member.id },
        include: {
          relatedMember: { select: { publicId: true, fullName: true, mobile: true, photoUrl: true, status: true } },
          relationshipType: { select: { name: true } },
        },
      }),
      prisma.familyMember.findMany({
        where: { relatedMemberId: member.id },
        include: {
          primaryMember: { select: { publicId: true, fullName: true, mobile: true, photoUrl: true, status: true } },
          relationshipType: { select: { name: true } },
        },
      }),
    ]);

    const rows = [
      ...asPrimary.map((l) => ({ id: l.id, relation: l.relationshipType.name, direction: 'ADDED_BY_ME' as const, member: l.relatedMember, createdAt: l.createdAt })),
      ...asRelated.map((l) => ({ id: l.id, relation: l.relationshipType.name, direction: 'ADDED_ME' as const, member: l.primaryMember, createdAt: l.createdAt })),
    ];
    return ok(res, rows);
  }),
);
