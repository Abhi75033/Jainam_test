
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

/* ─── Extra handlers (delete, bulk upload) ─────────────────────────────────── */
export const orgExtras = (_type: OrganizationType) => ({

  /* Logo upload */
  uploadLogo: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw ApiError.validation({ logo: ['No file provided'] });
    const ext = req.file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    const filename = `org-logo-${req.params.organizationId}-${Date.now()}.${ext}`;
    const fs = await import('fs/promises');
    const path = await import('path');
    const dir = path.resolve(process.cwd(), 'static', 'photos');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), req.file.buffer);
    const logoUrl = `/static/photos/${filename}`;
    await prisma.organization.update({ where: { id: req.params.organizationId }, data: { logoUrl } });
    return ok(res, { logoUrl });
  }),

  /* Bulk gallery upload (multipart images[]) */
  bulkUploadGallery: asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files?.length) throw ApiError.validation({ images: ['No images provided'] });
    const fs = await import('fs/promises');
    const path = await import('path');
    const dir = path.resolve(process.cwd(), 'static', 'photos');
    await fs.mkdir(dir, { recursive: true });
    const results = [];
    for (const [i, file] of files.entries()) {
      const ext = file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
      const filename = `gallery-${req.params.organizationId}-${Date.now()}-${i}.${ext}`;
      await fs.writeFile(path.join(dir, filename), file.buffer);
      const img = await prisma.organizationGalleryImage.create({
        data: { organizationId: req.params.organizationId as string, imageUrl: `/static/photos/${filename}`, order: i },
      });
      results.push(img);
    }
    return created(res, { count: results.length, images: results });
  }),

  /* Delete gallery image */
  deleteGalleryImage: asyncHandler(async (req: Request, res: Response) => {
    await prisma.organizationGalleryImage.delete({ where: { id: req.params.imageId } });
    return ok(res, { deleted: true });
  }),

  /* Delete trustee */
  deleteTrustee: asyncHandler(async (req: Request, res: Response) => {
    await prisma.organizationTrustee.delete({ where: { id: req.params.trusteeId } });
    return ok(res, { deleted: true });
  }),

  /* Delete contact */
  deleteContact: asyncHandler(async (req: Request, res: Response) => {
    await prisma.organizationContact.delete({ where: { id: req.params.contactId } });
    return ok(res, { deleted: true });
  }),

  /* Delete notice */
  deleteNotice: asyncHandler(async (req: Request, res: Response) => {
    await prisma.organizationNotice.delete({ where: { id: req.params.noticeId } });
    return ok(res, { deleted: true });
  }),

  /* Delete dhaja record */
  deleteDhaja: asyncHandler(async (req: Request, res: Response) => {
    await prisma.dhajaRecord.delete({ where: { id: req.params.dhajaId } });
    return ok(res, { deleted: true });
  }),
});

