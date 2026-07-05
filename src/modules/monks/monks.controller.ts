import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import * as monksService from './monks.service';
import { recordAudit, auditContextFromRequest } from '@/engines/audit/audit.service';
import { prisma } from '@/config/prisma';

export const createMonk = asyncHandler(async (req: Request, res: Response) => {
  const monk = await monksService.createMonk({ ...req.body, createdById: req.actor!.userId });
  await recordAudit({ ...auditContextFromRequest(req), module: 'MONKS', action: 'CREATE', entityType: 'MonkProfile', entityId: monk.id, after: monk });
  return created(res, monk);
});

export const updateMonk = asyncHandler(async (req: Request, res: Response) => {
  const before = await monksService.getMonk(req.params.monkId as string);
  const monk = await monksService.updateMonk(before.id, req.body, req.actor!.userId);
  // §5.4: every edit to a shared monk profile is audit-logged (who/what/when)
  await recordAudit({ ...auditContextFromRequest(req), module: 'MONKS', action: 'EDIT', entityType: 'MonkProfile', entityId: monk.id, before, after: monk, isCritical: true });
  return ok(res, monk);
});

export const getMonk = asyncHandler(async (req: Request, res: Response) => {
  const monk = await monksService.getMonk(req.params.monkId as string);
  return ok(res, monk);
});

export const listMonks = asyncHandler(async (req: Request, res: Response) => {
  const { templeId, groupId, gender, search } = req.query as Record<string, string | undefined>;
  const monks = await monksService.listMonks({ templeId, groupId, gender: gender as any, search });
  return ok(res, monks);
});

export const deleteMonk = asyncHandler(async (req: Request, res: Response) => {
  const before = await monksService.getMonk(req.params.monkId as string);
  const monk = await monksService.softDeleteMonk(before.id, req.actor!.userId);
  await recordAudit({ ...auditContextFromRequest(req), module: 'MONKS', action: 'DELETE', entityType: 'MonkProfile', entityId: monk.id, before, isCritical: true });
  return ok(res, { deleted: true });
});

export const createMonkGroup = asyncHandler(async (req: Request, res: Response) => {
  const group = await monksService.createMonkGroup(req.body);
  return created(res, group);
});

export const followMonk = asyncHandler(async (req: Request, res: Response) => {
  const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });
  if (!member) throw ApiError.notFound('Member profile not found');
  const monk = await monksService.getMonk(req.params.monkId as string);
  const follow = await monksService.followMonk(monk.id, member.id);
  return created(res, follow);
});

export const unfollowMonk = asyncHandler(async (req: Request, res: Response) => {
  const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });
  if (!member) throw ApiError.notFound('Member profile not found');
  const monk = await monksService.getMonk(req.params.monkId as string);
  await monksService.unfollowMonk(monk.id, member.id);
  return ok(res, { unfollowed: true });
});
