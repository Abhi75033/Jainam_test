import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission, scopeToOrganization } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';

const createOpportunitySchema = z.object({
  body: z.object({
    organizationId: z.string().min(1),
    role: z.string().min(1),
    details: z.string().optional(),
    areaId: z.string().optional(),
  }),
});

const decisionSchema = z.object({ body: z.object({ status: z.enum(['APPROVED', 'REJECTED']) }) });

async function requireMember(userId: string) {
  const member = await prisma.member.findUnique({ where: { userId } });
  if (!member) throw ApiError.notFound('Member profile not found');
  return member;
}

/** Volunteers (§5.20): org admins define opportunities; members browse + apply; admins approve/reject. */
export const volunteerRoutes = Router();

volunteerRoutes.post('/opportunities', requireAuth, requirePermission('VOLUNTEERS', 'CREATE'), scopeToOrganization, validate(createOpportunitySchema), asyncHandler(async (req: Request, res: Response) => {
  const opportunity = await prisma.volunteerOpportunity.create({ data: { ...req.body, createdById: req.actor!.userId } });
  return created(res, opportunity);
}));

volunteerRoutes.get('/opportunities', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = req.query as { organizationId?: string };
  const opportunities = await prisma.volunteerOpportunity.findMany({
    where: { deletedAt: null, organizationId },
    include: { organization: { select: { name: true, publicId: true } }, area: true },
    orderBy: { createdAt: 'desc' },
  });
  return ok(res, opportunities);
}));

volunteerRoutes.post('/opportunities/:opportunityId/apply', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const application = await prisma.volunteerApplication.upsert({
    where: { opportunityId_memberId: { opportunityId: req.params.opportunityId as string, memberId: member.id } },
    update: {},
    create: { opportunityId: req.params.opportunityId as string, memberId: member.id },
  });
  return created(res, application);
}));

volunteerRoutes.patch('/applications/:applicationId', requireAuth, requirePermission('VOLUNTEERS', 'APPROVE'), validate(decisionSchema), asyncHandler(async (req: Request, res: Response) => {
  const application = await prisma.volunteerApplication.update({
    where: { id: req.params.applicationId as string },
    data: { status: req.body.status },
    include: { opportunity: true, member: true },
  });

  // Approved volunteers reflect on the org volunteer list + member profile (§5.20)
  if (req.body.status === 'APPROVED') {
    await prisma.organizationVolunteer.create({
      data: { organizationId: application.opportunity.organizationId, memberId: application.memberId, area: application.opportunity.role },
    });
    await prisma.member.update({ where: { id: application.memberId }, data: { isVolunteer: true } });
    await prisma.memberBadge.upsert({
      where: { memberId_badge: { memberId: application.memberId, badge: 'VOLUNTEER' } },
      update: {},
      create: { memberId: application.memberId, badge: 'VOLUNTEER' },
    });
  }

  return ok(res, application);
}));

volunteerRoutes.get('/applications/org/:organizationId', requireAuth, requirePermission('VOLUNTEERS', 'VIEW'), scopeToOrganization, asyncHandler(async (req: Request, res: Response) => {
  const applications = await prisma.volunteerApplication.findMany({
    where: { opportunity: { organizationId: req.params.organizationId as string } },
    include: { member: { select: { publicId: true, fullName: true } }, opportunity: { select: { role: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return ok(res, applications);
}));
