import { Request, Response } from 'express';
import { OrganizationType } from '@prisma/client';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import * as orgService from './organizations.service';
import { recordAudit, auditContextFromRequest } from '@/engines/audit/audit.service';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';

export const makeOrganizationController = (type: OrganizationType) => ({
  create: asyncHandler(async (req: Request, res: Response) => {
    const org = await orgService.createOrganization({ ...req.body, type, createdById: req.actor!.userId });
    await recordAudit({ ...auditContextFromRequest(req), organizationId: org.id, module: type, action: 'CREATE', entityType: 'Organization', entityId: org.id, after: org });
    return created(res, org);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const before = await orgService.getOrganization(req.params.organizationId as string);
    const org = await orgService.updateOrganization(req.params.organizationId as string, req.body, req.actor!.userId);
    await recordAudit({ ...auditContextFromRequest(req), organizationId: org.id, module: type, action: 'EDIT', entityType: 'Organization', entityId: org.id, before, after: org });
    return ok(res, org);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const org = await orgService.getOrganization(req.params.organizationId as string);
    return ok(res, org);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const { city, state } = req.query as { city?: string; state?: string };
    const orgs = await orgService.listOrganizations(type, { city, state });
    return ok(res, orgs);
  }),

  addGalleryImage: asyncHandler(async (req: Request, res: Response) => {
    const img = await orgService.addGalleryImage(req.params.organizationId as string, req.body.imageUrl, req.body.order ?? 0, type);
    return created(res, img);
  }),

  addTrustee: asyncHandler(async (req: Request, res: Response) => {
    const row = await orgService.addTrustee(req.params.organizationId as string, req.body.memberId, req.body.designation);
    return created(res, row);
  }),

  addVolunteer: asyncHandler(async (req: Request, res: Response) => {
    const row = await orgService.addVolunteer(req.params.organizationId as string, req.body.memberId, req.body.area);
    return created(res, row);
  }),

  addContact: asyncHandler(async (req: Request, res: Response) => {
    const row = await orgService.addContact(req.params.organizationId as string, req.body.memberId, req.body.role);
    return created(res, row);
  }),

  upsertDhajaRecord: asyncHandler(async (req: Request, res: Response) => {
    const row = await orgService.upsertDhajaRecord(req.params.organizationId as string, req.body);
    return ok(res, row);
  }),

  addReview: asyncHandler(async (req: Request, res: Response) => {
    const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });
    if (!member) throw ApiError.notFound('Member profile not found');
    const row = await orgService.addReview(req.params.organizationId as string, member.id, req.body.rating, req.body.comment);
    return created(res, row);
  }),

  replyReview: asyncHandler(async (req: Request, res: Response) => {
    const row = await orgService.replyToReview(req.params.reviewId as string, req.body.adminReply);
    return ok(res, row);
  }),

  hideReview: asyncHandler(async (req: Request, res: Response) => {
    const row = await orgService.hideReview(req.params.reviewId as string, req.actor!.userId);
    await recordAudit({ ...auditContextFromRequest(req), module: type, action: 'DELETE', entityType: 'OrganizationReview', entityId: req.params.reviewId as string, isCritical: true });
    return ok(res, row);
  }),

  addNotice: asyncHandler(async (req: Request, res: Response) => {
    const row = await orgService.addNotice(req.params.organizationId as string, req.body, req.actor!.userId);
    return created(res, row);
  }),

  follow: asyncHandler(async (req: Request, res: Response) => {
    const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });
    if (!member) throw ApiError.notFound('Member profile not found');
    const row = await orgService.followOrganization(req.params.organizationId as string, member.id);
    return created(res, row);
  }),

  unfollow: asyncHandler(async (req: Request, res: Response) => {
    const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });
    if (!member) throw ApiError.notFound('Member profile not found');
    await orgService.unfollowOrganization(req.params.organizationId as string, member.id);
    return ok(res, { unfollowed: true });
  }),

  reportIncorrectInfo: asyncHandler(async (req: Request, res: Response) => {
    const ticket = await orgService.reportIncorrectInfo(req.params.organizationId as string, req.body.description, req.actor!.userId);
    return created(res, ticket);
  }),
});

export const bhojanalayDirectory = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await orgService.listBhojanalayDirectory();
  return ok(res, rows);
});
