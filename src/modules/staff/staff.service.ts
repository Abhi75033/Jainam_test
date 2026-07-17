import { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { nextPublicId } from '@/engines/idGenerator/id.service';
import { encryptField } from '@/utils/encryption';
import { createSignedToken } from '@/engines/qr/qr.service';
import { enqueueNotification } from '@/engines/notification/notification.service';

interface CreateStaffInput {
  organizationId: string;
  existingMemberPublicId?: string;
  newMember?: { name: string; mobile: string; category: 'JAIN' | 'NON_JAIN' };
  departmentId?: string;
  designationId?: string;
  joiningDate?: Date;
  aadhaar?: string;
  pan?: string;
  addresses?: Record<string, unknown>;
  emergencyMedicalInfo?: Record<string, unknown>;
  govtDocuments?: { docType: string; docNumber: string; imageUrl?: string; expiryDate?: Date }[];
  modulePermissions?: { module: string; actions: string[] }[];
  createdById: string;
  category?: string;
  categorySpecify?: string;
  reportingTo?: string;
  dob?: Date;
  gender?: string;
  permanentAddress?: Record<string, unknown>;
}

export async function createStaff(input: CreateStaffInput) {
  let memberId: string;
  let userId: string;
  let mobile: string;

  if (input.existingMemberPublicId) {
    const member = await prisma.member.findUnique({ where: { publicId: input.existingMemberPublicId } });
    if (!member) throw ApiError.notFound('Member not found for the given publicId');
    const existingStaff = await prisma.staff.findUnique({ where: { memberId: member.id } });
    if (existingStaff) throw ApiError.conflict('This member already has a staff profile');
    memberId = member.id;
    userId = member.userId;
    mobile = member.mobile;
  } else {
    const nm = input.newMember!;
    const existingUser = await prisma.user.findUnique({ where: { mobile: nm.mobile } });
    if (existingUser) throw ApiError.conflict('This mobile number is already registered');

    const prefix = nm.category === 'JAIN' ? 'JAIN_MEMBER' : 'NON_JAIN_MEMBER';
    const result = await prisma.$transaction(async (tx) => {
      const publicId = await nextPublicId(prefix, tx);
      const user = await tx.user.create({
        data: { mobile: nm.mobile, publicId, status: 'PENDING_OTP', primaryRoleKey: 'STAFF', createdByAdmin: true },
      });
      const member = await tx.member.create({
        data: {
          userId: user.id,
          publicId,
          category: nm.category,
          firstName: nm.name,
          fullName: nm.name,
          mobile: nm.mobile,
          status: 'INACTIVE',
          isAutoCreated: true,
        },
      });
      return { userId: user.id, memberId: member.id };
    });
    memberId = result.memberId;
    userId = result.userId;
    mobile = nm.mobile;
  }

  // Generate sequential unique Staff ID (JFST01, JFST02, etc.)
  const count = await prisma.staff.count();
  const staffPublicId = `JFST${String(count + 1).padStart(2, '0')}`;
  const qrToken = createSignedToken({ purpose: 'STAFF_IDENTITY', id: staffPublicId });

  const staff = await prisma.$transaction(async (tx) => {
    const created = await tx.staff.create({
      data: {
        publicId: staffPublicId,
        userId,
        memberId,
        organizationId: input.organizationId,
        departmentId: input.departmentId,
        designationId: input.designationId,
        joiningDate: input.joiningDate,
        category: input.category,
        categorySpecify: input.categorySpecify,
        reportingTo: input.reportingTo,
        dob: input.dob ? new Date(input.dob) : null,
        gender: input.gender,
        permanentAddress: input.permanentAddress as Prisma.InputJsonValue,
        aadhaarEncrypted: input.aadhaar ? encryptField(input.aadhaar) : null,
        panEncrypted: input.pan ? encryptField(input.pan) : null,
        addresses: input.addresses as Prisma.InputJsonValue,
        emergencyMedicalInfo: input.emergencyMedicalInfo as Prisma.InputJsonValue,
        qrToken,
        createdById: input.createdById,
      },
    });

    await tx.user.update({ where: { id: userId }, data: { primaryRoleKey: 'STAFF', publicId: staffPublicId } });
    await tx.userOrganization.upsert({
      where: { userId_organizationId: { userId, organizationId: input.organizationId } },
      update: { roleKey: 'STAFF' },
      create: { userId, organizationId: input.organizationId, roleKey: 'STAFF', assignedById: input.createdById },
    });

    if (input.govtDocuments?.length) {
      await tx.staffDocument.createMany({
        data: input.govtDocuments.map((d) => ({
          staffId: created.id,
          docType: d.docType,
          docNumberEncrypted: encryptField(d.docNumber),
          imageUrl: d.imageUrl,
          expiryDate: d.expiryDate,
        })),
      });
    }

    if (input.modulePermissions?.length) {
      await tx.staffModulePermission.createMany({
        data: input.modulePermissions.map((p) => ({ staffId: created.id, module: p.module, actions: p.actions as unknown as Prisma.InputJsonValue })),
      });
    }

    return created;
  });

  await enqueueNotification({
    userId,
    templateKey: 'STAFF_ACCOUNT_CREATED',
    category: 'SERVICE',
    to: { WHATSAPP: mobile, SMS: mobile },
    body: `Your JiNANAM staff account (${staffPublicId}) has been created. Open the app and request an OTP with mobile ${mobile} to activate.`,
  });

  return staff;
}

export async function updateStaffModulePermissions(staffId: string, permissions: { module: string; actions: string[] }[], _updatedById: string) {
  await prisma.staffModulePermission.deleteMany({ where: { staffId } });
  await prisma.staffModulePermission.createMany({
    data: permissions.map((p) => ({ staffId, module: p.module, actions: p.actions as unknown as Prisma.InputJsonValue })),
  });
  await prisma.staffActivityLog.create({ data: { staffId, module: 'STAFF', action: 'PERMISSION_CHANGE', device: 'admin-portal' } });

  // §4.3: notify the staff member their permissions changed
  const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { userId: true } });
  if (staff) {
    await enqueueNotification({
      userId: staff.userId,
      templateKey: 'PERMISSIONS_CHANGED',
      category: 'SERVICE',
      to: { PUSH: staff.userId, IN_APP: staff.userId },
      body: 'Your module permissions were updated by your administrator. Your app menu will refresh on next launch.',
    });
  }

  return prisma.staffModulePermission.findMany({ where: { staffId } });
}

export async function getStaffModules(staffId: string): Promise<string[]> {
  const perms = await prisma.staffModulePermission.findMany({ where: { staffId } });
  return perms.filter((p) => (p.actions as string[]).length > 0).map((p) => p.module);
}

export async function checkIn(staffId: string, method: 'QR' | 'MANUAL', location?: Record<string, unknown>) {
  const openAttendance = await prisma.staffAttendance.findFirst({ where: { staffId, checkOutAt: null }, orderBy: { checkInAt: 'desc' } });
  if (openAttendance) throw ApiError.conflict('Already checked in — check out first');
  return prisma.staffAttendance.create({ data: { staffId, method, location: location as Prisma.InputJsonValue, status: 'PRESENT' } });
}

export async function checkOut(staffId: string) {
  const openAttendance = await prisma.staffAttendance.findFirst({ where: { staffId, checkOutAt: null }, orderBy: { checkInAt: 'desc' } });
  if (!openAttendance) throw ApiError.conflict('No active check-in found');
  const checkOutAt = new Date();
  const workingHours = Math.round(((checkOutAt.getTime() - openAttendance.checkInAt.getTime()) / 3600000) * 100) / 100;
  return prisma.staffAttendance.update({
    where: { id: openAttendance.id },
    data: { checkOutAt, workingHours, status: 'PRESENT' },
  });
}

export async function applyLeave(staffId: string, input: { type: string; startDate: Date; endDate: Date; reason?: string }) {
  return prisma.staffLeave.create({ data: { staffId, ...input, status: 'PENDING' } });
}

export async function decideLeave(leaveId: string, status: 'APPROVED' | 'REJECTED', approvedById: string) {
  return prisma.staffLeave.update({ where: { id: leaveId }, data: { status, approvedById } });
}

export async function updateEmploymentStatus(staffId: string, employmentStatus: string, actorId: string) {
  const staff = await prisma.staff.update({ where: { id: staffId }, data: { employmentStatus: employmentStatus as any, updatedById: actorId } });
  await prisma.staffActivityLog.create({ data: { staffId, module: 'STAFF', action: `EMPLOYMENT_STATUS_${employmentStatus}` } });
  return staff;
}

export async function saveManualAttendance(staffId: string, input: { date: Date; status: string; workingHours?: number }) {
  const startOfDay = new Date(input.date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(input.date);
  endOfDay.setHours(23, 59, 59, 999);

  const existing = await prisma.staffAttendance.findFirst({
    where: { staffId, checkInAt: { gte: startOfDay, lte: endOfDay } }
  });

  if (existing) {
    return prisma.staffAttendance.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        workingHours: input.workingHours ?? (input.status === 'FULL_DAY' || input.status === 'PRESENT' ? 8 : 4),
        method: 'MANUAL'
      }
    });
  } else {
    return prisma.staffAttendance.create({
      data: {
        staffId,
        checkInAt: startOfDay,
        checkOutAt: endOfDay,
        status: input.status,
        workingHours: input.workingHours ?? (input.status === 'FULL_DAY' || input.status === 'PRESENT' ? 8 : 4),
        method: 'MANUAL'
      }
    });
  }
}

export async function getStaffDashboardStats(organizationId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const expirySoonThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [total, active, inactive, onLeaveToday, newThisMonth, docsExpiring] = await Promise.all([
    prisma.staff.count({ where: { organizationId, deletedAt: null } }),
    prisma.staff.count({ where: { organizationId, deletedAt: null, employmentStatus: 'ACTIVE' } }),
    prisma.staff.count({ where: { organizationId, deletedAt: null, employmentStatus: { not: 'ACTIVE' } } }),
    prisma.staffLeave.count({ where: { staff: { organizationId }, status: 'APPROVED', startDate: { lte: now }, endDate: { gte: now } } }),
    prisma.staff.count({ where: { organizationId, deletedAt: null, createdAt: { gte: startOfMonth } } }),
    prisma.staffDocument.count({ where: { staff: { organizationId }, expiryDate: { lte: expirySoonThreshold, gte: now } } }),
  ]);

  const yetToCheckOut = await prisma.staffAttendance.count({
    where: { staff: { organizationId }, checkOutAt: null },
  });

  const presentToday = await prisma.staffAttendance.count({
    where: { staff: { organizationId }, checkInAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
  });

  return {
    total,
    active,
    inactive,
    present: presentToday,
    absent: Math.max(active - presentToday - onLeaveToday, 0),
    onLeave: onLeaveToday,
    yetToCheckOut,
    newThisMonth,
    docsExpiringSoon: docsExpiring,
  };
}
