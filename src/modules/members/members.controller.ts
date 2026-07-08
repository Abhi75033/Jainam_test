import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import * as membersService from './members.service';
import { serializeMemberFull, serializeMemberPublic } from './members.serializer';
import { recordAudit, auditContextFromRequest } from '@/engines/audit/audit.service';
import { prisma } from '@/config/prisma';

export const registerJainMember = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.actor!.userId } });
  const member = await membersService.registerMember({ userId: req.actor!.userId, category: 'JAIN', mobile: user.mobile, ...req.body });
  return created(res, serializeMemberFull(member));
});

export const registerNonJainMember = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.actor!.userId } });
  const member = await membersService.registerMember({ userId: req.actor!.userId, category: 'NON_JAIN', mobile: user.mobile, ...req.body });
  return created(res, serializeMemberFull(member));
});

export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const member = await membersService.getMemberByUserId(req.actor!.userId);
  if (!member) throw ApiError.notFound('Member profile not found');
  return ok(res, serializeMemberFull(member, member.privacySetting));
});

export const updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const member = await membersService.getMemberByUserId(req.actor!.userId);
  if (!member) throw ApiError.notFound('Member profile not found');

  const before = { ...member };
  const updated = await membersService.updateMemberProfile(member.id, req.body);

  await recordAudit({
    ...auditContextFromRequest(req),
    module: 'MEMBERS',
    action: 'PROFILE_UPDATE',
    entityType: 'Member',
    entityId: member.id,
    before,
    after: updated,
    isCritical: true,
  });

  return ok(res, serializeMemberFull(updated));
});

export const getMemberByPublicId = asyncHandler(async (req: Request, res: Response) => {
  const member = await membersService.getMemberByPublicId(req.params.publicId as string);
  if (!member) throw ApiError.notFound('Member not found');

  const isSelf = member.userId === req.actor!.userId;
  const isPrivileged = req.actor!.isSuperAdmin || (req.actor!.permissions.MEMBERS ?? []).length > 0;
  return ok(res, isSelf || isPrivileged ? serializeMemberFull(member, member.privacySetting) : serializeMemberPublic(member));
});

export const addFamilyMember = asyncHandler(async (req: Request, res: Response) => {
  const member = await membersService.getMemberByUserId(req.actor!.userId);
  if (!member) throw ApiError.notFound('Member profile not found');
  const link = await membersService.addFamilyMember(member.id, req.body);
  return created(res, link);
});

export const bulkImportMembers = asyncHandler(async (req: Request, res: Response) => {
  const result = await membersService.bulkImportMembers(req.body.rows, req.actor!.userId);
  return created(res, result);
});

/**
 * Admin-created member (§5.2): creates a NEW user + member (Inactive until first
 * OTP login), returns the new public ID for the success screen, and sends the
 * app-download/credentials notification.
 */
export const adminCreateMember = asyncHandler(async (req: Request, res: Response) => {
  const { firstName, surname, mobile, email, gender, category = 'JAIN', communityId } = req.body as Record<string, string>;
  if (!firstName || !mobile) throw ApiError.validation({ firstName: firstName ? [] : ['Required'], mobile: mobile ? [] : ['Required'] });

  const existing = await prisma.user.findUnique({ where: { mobile } });
  if (existing) throw ApiError.conflict('This mobile number is already registered');

  const { nextPublicId } = await import('@/engines/idGenerator/id.service');
  const prefix = category === 'NON_JAIN' ? 'NON_JAIN_MEMBER' : 'JAIN_MEMBER';
  const fullName = [firstName, surname].filter(Boolean).join(' ');

  const member = await prisma.$transaction(async (tx) => {
    const publicId = await nextPublicId(prefix as 'JAIN_MEMBER' | 'NON_JAIN_MEMBER', tx);
    const user = await tx.user.create({
      data: { mobile, email: email || undefined, publicId, status: 'PENDING_OTP', primaryRoleKey: category === 'NON_JAIN' ? 'NON_JAIN_MEMBER' : 'MEMBER', createdByAdmin: true },
    });
    return tx.member.create({
      data: {
        userId: user.id,
        publicId,
        category: category === 'NON_JAIN' ? 'NON_JAIN' : 'JAIN',
        firstName,
        surname: surname || undefined,
        fullName,
        gender: gender || undefined,
        email: email || undefined,
        mobile,
        communityId: communityId || undefined,
        status: 'INACTIVE',
        isAutoCreated: true,
        createdById: req.actor!.userId,
      },
    });
  });

  const { enqueueNotification } = await import('@/engines/notification/notification.service');
  await enqueueNotification({
    userId: member.userId,
    templateKey: 'ADMIN_CREATED_MEMBER',
    category: 'SERVICE',
    to: { WHATSAPP: mobile, SMS: mobile },
    body: `Welcome to JiNANAM! Your member ID is ${member.publicId}. Download the app and log in with mobile ${mobile} to activate: https://jinanam.app/download`,
  });

  await recordAudit({ ...auditContextFromRequest(req), module: 'MEMBERS', action: 'CREATE', entityType: 'Member', entityId: member.id, after: { publicId: member.publicId } });

  return created(res, { publicId: member.publicId, fullName: member.fullName, memberId: member.id, status: member.status });
});

/** Admin member register list (MEMBERS:VIEW) — paginated, searchable by name/mobile/publicId. */
export const listMembers = asyncHandler(async (req: Request, res: Response) => {
  const { q, category, status, page = '1', pageSize = '20' } = req.query as Record<string, string>;
  const take = Math.min(parseInt(pageSize) || 20, 100);
  const skip = ((parseInt(page) || 1) - 1) * take;

  const where: any = { deletedAt: null };
  if (category && category !== 'ALL') where.category = category;
  if (status && status !== 'ALL') where.status = status;
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: 'insensitive' } },
      { mobile: { contains: q } },
      { publicId: { contains: q.toUpperCase() } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.member.count({ where }),
    prisma.member.findMany({
      where,
      select: {
        id: true, publicId: true, fullName: true, photoUrl: true, category: true,
        mobile: true, email: true, status: true, isVolunteer: true,
        profileCompletionPct: true, createdAt: true,
        community: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ]);

  return ok(res, rows, { total, page: parseInt(page) || 1, pageSize: take });
});
