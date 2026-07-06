import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import * as staffService from './staff.service';
import { prisma } from '@/config/prisma';
import { recordAudit, auditContextFromRequest } from '@/engines/audit/audit.service';

export const createStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await staffService.createStaff({ ...req.body, createdById: req.actor!.userId });
  await recordAudit({ ...auditContextFromRequest(req), organizationId: req.body.organizationId, module: 'STAFF', action: 'CREATE', entityType: 'Staff', entityId: staff.id, after: staff });
  return created(res, staff);
});

export const updateModulePermissions = asyncHandler(async (req: Request, res: Response) => {
  const permissions = await staffService.updateStaffModulePermissions(req.params.staffId as string, req.body.permissions, req.actor!.userId);
  await recordAudit({ ...auditContextFromRequest(req), module: 'STAFF', action: 'PERMISSION_CHANGE', entityType: 'Staff', entityId: req.params.staffId as string, after: permissions, isCritical: true });
  return ok(res, permissions);
});

export const myModules = asyncHandler(async (req: Request, res: Response) => {
  const staff = await prisma.staff.findUnique({ where: { userId: req.actor!.userId } });
  if (!staff) throw ApiError.notFound('Staff profile not found');
  const modules = await staffService.getStaffModules(staff.id);
  return ok(res, { modules });
});

export const checkIn = asyncHandler(async (req: Request, res: Response) => {
  const staff = await prisma.staff.findUnique({ where: { userId: req.actor!.userId } });
  if (!staff) throw ApiError.notFound('Staff profile not found');
  const attendance = await staffService.checkIn(staff.id, req.body.method, req.body.location);
  return created(res, attendance);
});

export const checkOut = asyncHandler(async (req: Request, res: Response) => {
  const staff = await prisma.staff.findUnique({ where: { userId: req.actor!.userId } });
  if (!staff) throw ApiError.notFound('Staff profile not found');
  const attendance = await staffService.checkOut(staff.id);
  return ok(res, attendance);
});

export const applyLeave = asyncHandler(async (req: Request, res: Response) => {
  const staff = await prisma.staff.findUnique({ where: { userId: req.actor!.userId } });
  if (!staff) throw ApiError.notFound('Staff profile not found');
  const leave = await staffService.applyLeave(staff.id, req.body);
  return created(res, leave);
});

export const decideLeave = asyncHandler(async (req: Request, res: Response) => {
  const leave = await staffService.decideLeave(req.params.leaveId as string, req.body.status, req.actor!.userId);
  return ok(res, leave);
});

export const updateEmploymentStatus = asyncHandler(async (req: Request, res: Response) => {
  const staff = await staffService.updateEmploymentStatus(req.params.staffId as string, req.body.employmentStatus, req.actor!.userId);
  return ok(res, staff);
});

export const dashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await staffService.getStaffDashboardStats(req.params.organizationId as string);
  return ok(res, stats);
});

/** Staff QR identity — downloadable/printable (§5.12). */
export const myStaffQr = asyncHandler(async (req: Request, res: Response) => {
  const staff = await prisma.staff.findUnique({
    where: { userId: req.actor!.userId },
    include: { member: { select: { fullName: true } }, organization: { select: { name: true, publicId: true } } },
  });
  if (!staff || !staff.qrToken) throw ApiError.notFound('Staff profile not found');
  const { renderQrPngDataUrl } = await import('@/engines/qr/qr.service');
  const qrDataUrl = await renderQrPngDataUrl(staff.qrToken);
  return ok(res, {
    staffPublicId: staff.publicId,
    name: staff.member.fullName,
    organization: staff.organization,
    qrToken: staff.qrToken,
    qrDataUrl,
  });
});

/** Shift + overtime management (§5.12). */
export const createShift = asyncHandler(async (req: Request, res: Response) => {
  const shift = await prisma.staffShift.create({ data: { staffId: req.params.staffId as string, ...req.body } });
  return created(res, shift);
});

export const listShifts = asyncHandler(async (req: Request, res: Response) => {
  const shifts = await prisma.staffShift.findMany({
    where: { staffId: req.params.staffId as string },
    orderBy: { date: 'desc' },
    take: 100,
  });
  return ok(res, shifts);
});
