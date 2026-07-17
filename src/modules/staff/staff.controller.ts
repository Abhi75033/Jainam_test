import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import * as staffService from './staff.service';
import { prisma } from '@/config/prisma';
import { recordAudit, auditContextFromRequest } from '@/engines/audit/audit.service';
import { encryptField } from '@/utils/encryption';

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

async function findStaffByIdOrPublicId(idOrPublicId: string) {
  const staff = await prisma.staff.findFirst({ where: { OR: [{ id: idOrPublicId }, { publicId: idOrPublicId }] } });
  if (!staff) throw ApiError.notFound('Staff not found');
  return staff;
}

export const listAttendance = asyncHandler(async (req: Request, res: Response) => {
  const staff = await findStaffByIdOrPublicId(req.params.staffId as string);
  const rows = await prisma.staffAttendance.findMany({
    where: { staffId: staff.id },
    orderBy: { checkInAt: 'desc' },
    take: 60,
  });
  return ok(res, rows);
});

export const adminCheckIn = asyncHandler(async (req: Request, res: Response) => {
  const staff = await findStaffByIdOrPublicId(req.params.staffId as string);
  const attendance = await staffService.checkIn(staff.id, 'MANUAL');
  return created(res, attendance);
});

export const adminCheckOut = asyncHandler(async (req: Request, res: Response) => {
  const staff = await findStaffByIdOrPublicId(req.params.staffId as string);
  const attendance = await staffService.checkOut(staff.id);
  return ok(res, attendance);
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
  const org = await prisma.organization.findUnique({
    where: { id: req.params.organizationId as string },
    select: { staffWorkingHoursStart: true, staffWorkingHoursEnd: true, staffLateArrivalAfter: true, staffEarlyExitBefore: true }
  });
  return ok(res, { stats, config: org });
});

/** Org staff register list (STAFF:VIEW, tenant-scoped). */
export const listOrgStaff = asyncHandler(async (req: Request, res: Response) => {
  const rows = await prisma.staff.findMany({
    where: { organizationId: req.params.organizationId as string, deletedAt: null },
    include: {
      member: { select: { fullName: true, mobile: true, photoUrl: true, publicId: true } },
      department: { select: { name: true } },
      designation: { select: { name: true } },
      documents: { where: { isCurrent: true } },
      leaves: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return ok(res, rows);
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

/** Update Organization Config Settings (Working Hours) */
export const updateOrgSettings = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const { start, end, late, early } = req.body;
  const org = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      staffWorkingHoursStart: start || null,
      staffWorkingHoursEnd: end || null,
      staffLateArrivalAfter: late || null,
      staffEarlyExitBefore: early || null
    }
  });
  return ok(res, org);
});

/** Manual Attendance Override */
export const addManualAttendance = asyncHandler(async (req: Request, res: Response) => {
  const { staffId } = req.params;
  const { date, status, workingHours } = req.body;
  const attendance = await staffService.saveManualAttendance(staffId, {
    date: new Date(date),
    status,
    workingHours
  });
  return created(res, attendance);
});

/** Document replacement with archiving old history logs */
export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  const { staffId } = req.params;
  const { docType, docNumber, imageUrl, expiryDate } = req.body;

  const oldDoc = await prisma.staffDocument.findFirst({
    where: { staffId, docType, isCurrent: true }
  });

  const newDoc = await prisma.staffDocument.create({
    data: {
      staffId,
      docType,
      docNumberEncrypted: encryptField(docNumber),
      imageUrl: imageUrl || null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      isCurrent: true,
      replacesDocumentId: oldDoc ? oldDoc.id : null
    }
  });

  if (oldDoc) {
    await prisma.staffDocument.update({
      where: { id: oldDoc.id },
      data: { isCurrent: false }
    });
  }

  return created(res, newDoc);
});

/** Export Reports Controller (XLSX, CSV) */
export const exportReports = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const { reportType, format } = req.query;

  let rows: any[] = [];
  let headers: any[] = [];
  let title = 'Staff Report';

  if (reportType === 'register') {
    title = 'Staff Register';
    const staffList = await prisma.staff.findMany({
      where: { organizationId, deletedAt: null },
      include: { member: { select: { fullName: true } } }
    });
    rows = staffList.map(s => ({
      staffId: s.publicId,
      name: s.member.fullName,
      category: s.category || '',
      joiningDate: s.joiningDate?.toISOString() || '',
      status: s.employmentStatus
    }));
    headers = [
      { key: 'staffId', header: 'Staff ID' },
      { key: 'name', header: 'Name' },
      { key: 'category', header: 'Category' },
      { key: 'joiningDate', header: 'Joining Date' },
      { key: 'status', header: 'Status' }
    ];
  } else if (reportType === 'attendance') {
    title = 'Attendance Report';
    const attendances = await prisma.staffAttendance.findMany({
      where: { staff: { organizationId } },
      include: { staff: { include: { member: { select: { fullName: true } } } } }
    });
    rows = attendances.map(a => ({
      staffId: a.staff.publicId,
      name: a.staff.member.fullName,
      date: a.checkInAt.toISOString().slice(0, 10),
      checkIn: a.checkInAt.toISOString(),
      checkOut: a.checkOutAt?.toISOString() || '',
      hours: a.workingHours || 0,
      status: a.status
    }));
    headers = [
      { key: 'staffId', header: 'Staff ID' },
      { key: 'name', header: 'Name' },
      { key: 'date', header: 'Date' },
      { key: 'checkIn', header: 'Check In' },
      { key: 'checkOut', header: 'Check Out' },
      { key: 'hours', header: 'Hours worked' },
      { key: 'status', header: 'Status' }
    ];
  } else {
    // Leaves report
    title = 'Leave Report';
    const leaves = await prisma.staffLeave.findMany({
      where: { staff: { organizationId } },
      include: { staff: { include: { member: { select: { fullName: true } } } } }
    });
    rows = leaves.map(l => ({
      staffId: l.staff.publicId,
      name: l.staff.member.fullName,
      type: l.type,
      start: l.startDate.toISOString().slice(0, 10),
      end: l.endDate.toISOString().slice(0, 10),
      status: l.status,
      reason: l.reason || ''
    }));
    headers = [
      { key: 'staffId', header: 'Staff ID' },
      { key: 'name', header: 'Name' },
      { key: 'type', header: 'Leave Type' },
      { key: 'start', header: 'Start Date' },
      { key: 'end', header: 'End Date' },
      { key: 'status', header: 'Status' },
      { key: 'reason', header: 'Reason' }
    ];
  }

  const { sendListExport, parseExportFormat } = await import('@/utils/listExport');
  return sendListExport(res, parseExportFormat(format), title, rows, headers);
});
