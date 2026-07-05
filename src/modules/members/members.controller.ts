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
