import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import * as membersService from './members.service';
import { serializeMemberFull, serializeMemberPublic } from './members.serializer';
import { recordAudit, auditContextFromRequest } from '@/engines/audit/audit.service';
import { prisma } from '@/config/prisma';
import { nextPublicId } from '@/engines/idGenerator/id.service';
import ExcelJS from 'exceljs';
import { encryptField, hashForLookup } from '@/utils/encryption';
import { Prisma } from '@prisma/client';

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
  const member = await membersService.getMemberByUserId(req.actor!.userId) as any;
  if (!member) throw ApiError.notFound('Member profile not found');
  return ok(res, serializeMemberFull(member, member.privacySetting));
});

export const updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const member = await membersService.getMemberByUserId(req.actor!.userId) as any;
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

  (updated as any)._resolvedSiblingNames = await membersService.resolveSiblingNames(updated.siblings);
  return ok(res, serializeMemberFull(updated));
});

export const getMemberByPublicId = asyncHandler(async (req: Request, res: Response) => {
  const member = await membersService.getMemberByPublicId(req.params.publicId as string) as any;
  if (!member) throw ApiError.notFound('Member not found');

  const isSelf = member.userId === req.actor!.userId;
  const isPrivileged = req.actor!.isSuperAdmin || (req.actor!.permissions.MEMBERS ?? []).length > 0;
  if (isSelf || isPrivileged) {
    member._resolvedSiblingNames = await membersService.resolveSiblingNames(member.siblings);
    return ok(res, serializeMemberFull(member, member.privacySetting));
  }
  return ok(res, serializeMemberPublic(member));
});

export const addFamilyMember = asyncHandler(async (req: Request, res: Response) => {
  let member = await membersService.getMemberByUserId(req.actor!.userId);

  // Super Admin may not have a Member profile (they're platform-level, not org-level).
  // Auto-create a stub so they can use member-facing features like Family.
  if (!member && req.actor!.isSuperAdmin) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.actor!.userId } });
    const publicId = await nextPublicId('JAIN_MEMBER');
    const firstName = user.firstName || 'Super';
    const surname = user.lastName || 'Admin';
    member = await prisma.member.create({
      data: {
        userId: user.id,
        publicId,
        category: 'NON_JAIN',
        firstName,
        surname,
        fullName: `${firstName} ${surname}`.trim(),
        mobile: user.mobile,
        mobileVerifiedAt: new Date(),
        status: 'ACTIVE',
      },
    }) as any;
  }

  if (!member) throw ApiError.notFound('Member profile not found');
  const link = await membersService.addFamilyMember(member.id, req.body);
  return created(res, link);
});

/** Admin/Super Admin links two already-existing members as family directly by public ID. */
export const linkFamilyMembers = asyncHandler(async (req: Request, res: Response) => {
  const link = await membersService.linkExistingFamilyMembers(req.body);
  await recordAudit({
    ...auditContextFromRequest(req),
    module: 'FAMILY',
    action: 'CREATE',
    entityType: 'FamilyMember',
    entityId: link.id,
    after: { primaryMemberPublicId: req.body.primaryMemberPublicId, relatedMemberPublicId: req.body.relatedMemberPublicId },
    isCritical: false,
  });
  return created(res, link);
});

/** Admin-wide directory of every family link across all members, for the admin Family Management page. */
export const listAllFamilyGroups = asyncHandler(async (req: Request, res: Response) => {
  const { q, page = '1', pageSize = '50' } = req.query as Record<string, string>;
  const links = await membersService.listAllFamilyLinks({ q, page: Number(page), pageSize: Number(pageSize) });
  return ok(res, links);
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
  const {
    firstName, middleName, surname, mobile, email, gender, category = 'JAIN',
    dob, nationality, maritalStatus,
    preferredLanguage, motherTongue, communityId, subCommunityId, gacchaId, tithiCalendarTypeId,
    whatsapp, alternateContact, currentAddress, permanentAddress, sameAsPermanent, nativeVillage,
    bloodGroup, disability, medicalNotes, emergencyContact, profession, isVolunteer,
    volunteerAreas, volunteerAvailability, siblings
  } = req.body;

  // Normalize before validating length/format (§Rule: Aadhaar 12 digits, PAN 10 chars) —
  // this route has no Zod schema (unlike /register/jain), so the same checks
  // members.dto.ts applies to registration must be duplicated here by hand.
  const aadhaar = req.body.aadhaar ? String(req.body.aadhaar).replace(/\D/g, '') : req.body.aadhaar;
  const pan = req.body.pan ? String(req.body.pan).trim().toUpperCase() : req.body.pan;

  const errors: Record<string, string[]> = {};
  if (!firstName) errors.firstName = ['Required'];
  if (!middleName) errors.middleName = ['Required'];
  if (!surname) errors.surname = ['Required'];
  if (!mobile) errors.mobile = ['Required'];
  if (!gender) errors.gender = ['Required'];
  if (!dob) errors.dob = ['Required'];
  if (!nationality) errors.nationality = ['Required'];
  if (!pan) errors.pan = ['Required'];
  else if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) errors.pan = ['Enter a valid 10-character PAN (e.g. ABCDE1234F)'];
  if (!aadhaar) errors.aadhaar = ['Required'];
  else if (!/^\d{12}$/.test(aadhaar)) errors.aadhaar = ['Aadhaar number must be exactly 12 digits'];
  if (!maritalStatus) errors.maritalStatus = ['Required'];

  if (!currentAddress) {
    errors.currentAddress = ['Required'];
  } else {
    const addr = currentAddress as any;
    if (!addr.line1 && !addr.address) errors['currentAddress.address'] = ['Required'];
    if (!addr.country) errors['currentAddress.country'] = ['Required'];
    if (!addr.pincode) errors['currentAddress.pincode'] = ['Required'];
    if (!addr.area) errors['currentAddress.area'] = ['Required'];
    if (!addr.city) errors['currentAddress.city'] = ['Required'];
    if (!addr.district) errors['currentAddress.district'] = ['Required'];
    if (!addr.state) errors['currentAddress.state'] = ['Required'];
  }

  if (!permanentAddress) {
    errors.permanentAddress = ['Required'];
  } else {
    const addr = permanentAddress as any;
    if (!addr.line1 && !addr.address) errors['permanentAddress.address'] = ['Required'];
    if (!addr.country) errors['permanentAddress.country'] = ['Required'];
    if (!addr.pincode) errors['permanentAddress.pincode'] = ['Required'];
    if (!addr.area) errors['permanentAddress.area'] = ['Required'];
    if (!addr.city) errors['permanentAddress.city'] = ['Required'];
    if (!addr.district) errors['permanentAddress.district'] = ['Required'];
    if (!addr.state) errors['permanentAddress.state'] = ['Required'];
  }

  if (category === 'JAIN') {
    if (!motherTongue) errors.motherTongue = ['Required'];
    if (!communityId) errors.communityId = ['Required'];
    if (!subCommunityId) errors.subCommunityId = ['Required'];
    if (!tithiCalendarTypeId) errors.tithiCalendarTypeId = ['Required'];
  }

  if (Object.keys(errors).length > 0) {
    throw ApiError.validation(errors);
  }

  // Gaccha only exists under some Sub-Communities (e.g. Murtipujak) — require
  // it whenever the chosen Sub-Community actually has Gacchas to pick from.
  if (category === 'JAIN' && subCommunityId && !gacchaId) {
    const gacchaCount = await prisma.gaccha.count({ where: { subCommunityId, deletedAt: null } });
    if (gacchaCount > 0) {
      throw ApiError.validation({ gacchaId: ['Gaccha is required for this sub-community'] });
    }
  }

  const existing = await prisma.user.findUnique({ where: { mobile } });
  if (existing) throw ApiError.conflict('This mobile number is already registered');

  if (email) {
    const emailExists = await prisma.user.findUnique({ where: { email } });
    if (emailExists) throw ApiError.conflict('This email address is already associated with another account. Please use a different email or leave it blank.');
  }

  const aadhaarHash = hashForLookup(aadhaar);
  const dupAadhaar = await prisma.member.findUnique({ where: { aadhaarHash } });
  if (dupAadhaar) throw ApiError.conflict('A member with this Aadhaar number already exists');

  const { nextPublicId } = await import('@/engines/idGenerator/id.service');
  const prefix = category === 'NON_JAIN' ? 'NON_JAIN_MEMBER' : 'JAIN_MEMBER';
  const fullName = [firstName, middleName, surname].filter(Boolean).join(' ');

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
        middleName: middleName || undefined,
        surname: surname || undefined,
        fullName,
        gender: gender || undefined,
        email: email || undefined,
        mobile,
        dob: dob ? new Date(dob) : undefined,
        nationality,
        panEncrypted: pan ? encryptField(pan) : undefined,
        aadhaarEncrypted: aadhaar ? encryptField(aadhaar) : undefined,
        aadhaarHash,
        maritalStatus,
        preferredLanguage: preferredLanguage || undefined,
        motherTongue: motherTongue || undefined,
        communityId: communityId || undefined,
        subCommunityId: subCommunityId || undefined,
        gacchaId: gacchaId || undefined,
        tithiCalendarTypeId: tithiCalendarTypeId || undefined,
        whatsapp: whatsapp || undefined,
        alternateContact: alternateContact || undefined,
        currentAddress: currentAddress ? (currentAddress as Prisma.InputJsonValue) : undefined,
        permanentAddress: permanentAddress ? (permanentAddress as Prisma.InputJsonValue) : undefined,
        sameAsPermanent: !!sameAsPermanent,
        nativeVillage: nativeVillage || undefined,
        bloodGroup: bloodGroup || undefined,
        disability: disability || undefined,
        medicalNotes: medicalNotes || undefined,
        emergencyContact: emergencyContact ? (emergencyContact as Prisma.InputJsonValue) : undefined,
        profession: profession || undefined,
        isVolunteer: !!isVolunteer,
        volunteerAreas: volunteerAreas ? (volunteerAreas as Prisma.InputJsonValue) : undefined,
        siblings: Array.isArray(siblings) && siblings.length > 0 ? (siblings as Prisma.InputJsonValue) : undefined,
        volunteerAvailability: volunteerAvailability || undefined,
        status: 'INACTIVE',
        isAutoCreated: true,
        createdById: req.actor!.userId,
      },
    });
  });

  const { familyMembers } = req.body;
  if (familyMembers && Array.isArray(familyMembers)) {
    await membersService.syncFamilyMembers(member.id, familyMembers);
  }

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
  const {
    q, category, status, excludeStaff,
    page = '1', pageSize = '20',
  } = req.query as Record<string, string>;
  const take = Math.min(parseInt(pageSize) || 20, 100);
  const skip = ((parseInt(page) || 1) - 1) * take;

  const where: any = { deletedAt: null };

  // Category filter
  if (category && category !== 'ALL') {
    // Support comma-separated category list (e.g. "JAIN,NON_JAIN")
    const cats = category.split(',').map((c) => c.trim()).filter(Boolean);
    where.category = cats.length === 1 ? cats[0] : { in: cats };
  }

  // B7 Fix: excludeStaff=true removes STAFF records from member-link dropdowns
  if (excludeStaff === 'true') {
    where.isStaff = false; // staff members have isStaff=true
    // Also filter by category to be safe: only JAIN and NON_JAIN
    if (!where.category) {
      where.category = { in: ['JAIN', 'NON_JAIN'] };
    }
  }

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
        id: true, userId: true, publicId: true, fullName: true, photoUrl: true, category: true,
        mobile: true, email: true, status: true, isVolunteer: true, isAutoCreated: true,
        profileCompletionPct: true, createdAt: true, dob: true,
        currentAddress: true,
        community: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ]);

  return ok(res, rows, { total, page: parseInt(page) || 1, pageSize: take });
});

/**
 * Admin update any member profile by publicId (MEMBERS:UPDATE).
 * Accepts same shape as updateMemberProfileSchema (firstName, surname, mobile, email,
 * dob, gender, bloodGroup, profession, currentAddress, etc.)
 */
export const adminUpdateMember = asyncHandler(async (req: Request, res: Response) => {
  const member = await membersService.getMemberByPublicId(req.params.publicId as string);
  if (!member) throw ApiError.notFound('Member not found');

  const updated = await membersService.updateMemberProfile(member.id, req.body);

  await recordAudit({
    ...auditContextFromRequest(req),
    module: 'MEMBERS',
    action: 'PROFILE_UPDATE',
    entityType: 'Member',
    entityId: member.id,
    before: {},
    after: req.body,
    isCritical: false,
  });

  (updated as any)._resolvedSiblingNames = await membersService.resolveSiblingNames(updated.siblings);
  return ok(res, serializeMemberFull(updated));
});

/**
 * Toggle member status (ACTIVE | INACTIVE | SUSPENDED).
 * PATCH /members/:publicId/status  body: { status: "ACTIVE" | "INACTIVE" | "SUSPENDED" }
 */
export const adminUpdateMemberStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as { status: string };
  if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
    throw ApiError.validation({ status: ['Must be ACTIVE, INACTIVE, or SUSPENDED'] });
  }
  const member = await membersService.getMemberByPublicId(req.params.publicId as string);
  if (!member) throw ApiError.notFound('Member not found');

  const updated = await prisma.member.update({
    where: { id: member.id },
    data: { status: status as any, ...(status === 'ACTIVE' ? { activatedAt: new Date() } : {}) },
  });

  await recordAudit({
    ...auditContextFromRequest(req),
    module: 'MEMBERS',
    action: 'STATUS_CHANGE',
    entityType: 'Member',
    entityId: member.id,
    before: { status: member.status },
    after: { status },
    isCritical: true,
  });

  return ok(res, { publicId: updated.publicId, status: updated.status });
});

/**
 * Upload member photo (multipart/form-data field: "photo").
 * Stores in /static/photos/<publicId>.<ext> and updates member.photoUrl.
 */
export const uploadMemberPhoto = asyncHandler(async (req: Request, res: Response) => {
  const member = await membersService.getMemberByPublicId(req.params.publicId as string);
  if (!member) throw ApiError.notFound('Member not found');
  if (!req.file) throw ApiError.validation({ photo: ['No file provided'] });

  const ext = req.file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const filename = `${member.publicId}-${Date.now()}.${ext}`;

  // Persist to /static/photos (relative to project root)
  const fs = await import('fs/promises');
  const path = await import('path');
  const dir = path.resolve(process.cwd(), 'static', 'photos');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), req.file.buffer);

  const photoUrl = `/static/photos/${filename}`;
  await prisma.member.update({ where: { id: member.id }, data: { photoUrl } });

  return ok(res, { photoUrl });
});

/* ─────────────────────────────────────────────────────────────────────────────
 * Export all members as Excel (GET /members/export)
 * Returns a .xlsx file with one row per member, all key columns included.
 * ───────────────────────────────────────────────────────────────────────── */
export const exportMembersExcel = asyncHandler(async (req: Request, res: Response) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'JiNANAM Platform';
  wb.created = new Date();

  const ws = wb.addWorksheet('Members', { views: [{ state: 'frozen', ySplit: 1 }] });

  // Column definitions
  ws.columns = [
    { header: 'Public ID',   key: 'publicId',   width: 14 },
    { header: 'Full Name',   key: 'fullName',    width: 22 },
    { header: 'Mobile',      key: 'mobile',      width: 16 },
    { header: 'Email',       key: 'email',       width: 26 },
    { header: 'Category',    key: 'category',    width: 12 },
    { header: 'Community',   key: 'community',   width: 16 },
    { header: 'City',        key: 'city',        width: 16 },
    { header: 'State',       key: 'state',       width: 16 },
    { header: 'Status',      key: 'status',      width: 12 },
    { header: 'DOB',         key: 'dob',         width: 14 },
    { header: 'Gender',      key: 'gender',      width: 10 },
    { header: 'Blood Group', key: 'bloodGroup',  width: 12 },
    { header: 'Profession',  key: 'profession',  width: 20 },
    { header: 'Is Volunteer',key: 'isVolunteer', width: 13 },
    { header: 'Joined On',   key: 'createdAt',   width: 18 },
  ];

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE64E0A' } };
    cell.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FFB03A00' } },
    };
  });
  headerRow.height = 22;

  // Fetch all members (no pagination — export is complete)
  const members = await prisma.member.findMany({
    where: { deletedAt: null },
    select: {
      publicId: true, fullName: true, mobile: true, email: true,
      category: true, status: true, dob: true, gender: true,
      bloodGroup: true, profession: true, isVolunteer: true, createdAt: true,
      currentAddress: true,
      community: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });

  for (const m of members) {
    const addr = m.currentAddress as Record<string, string> | null;
    ws.addRow({
      publicId:   m.publicId,
      fullName:   m.fullName,
      mobile:     m.mobile,
      email:      m.email || '',
      category:   m.category,
      community:  m.community?.name || '',
      city:       addr?.city || '',
      state:      addr?.state || '',
      status:     m.status,
      dob:        m.dob ? new Date(m.dob).toLocaleDateString('en-IN') : '',
      gender:     m.gender || '',
      bloodGroup: m.bloodGroup || '',
      profession: m.profession || '',
      isVolunteer:m.isVolunteer ? 'Yes' : 'No',
      createdAt:  new Date(m.createdAt).toLocaleDateString('en-IN'),
    });
  }

  // Alternate row shading
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const fill = rowNumber % 2 === 0
      ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFF8F0' } }
      : { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFFFF' } };
    row.eachCell((cell) => { cell.fill = fill; });
  });

  const filename = `jinanam-members-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
});

/* ─────────────────────────────────────────────────────────────────────────────
 * Download blank import template (GET /members/import-template)
 * Returns a .xlsx with the required headers + one sample row.
 * ───────────────────────────────────────────────────────────────────────── */
export const downloadImportTemplate = asyncHandler(async (req: Request, res: Response) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'JiNANAM Platform';

  const ws = wb.addWorksheet('Members Import');

  ws.columns = [
    { header: 'name',      key: 'name',      width: 24 },
    { header: 'mobile',    key: 'mobile',    width: 18 },
    { header: 'email',     key: 'email',     width: 28 },
    { header: 'community', key: 'community', width: 16 },
    { header: 'city',      key: 'city',      width: 16 },
    { header: 'state',     key: 'state',     width: 16 },
    { header: 'dob',       key: 'dob',       width: 14 },
    { header: 'gender',    key: 'gender',    width: 10 },
    { header: 'bloodGroup',key: 'bloodGroup',width: 13 },
    { header: 'address',   key: 'address',   width: 30 },
  ];

  // Orange header
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE64E0A' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center' };
  });
  headerRow.height = 20;

  // Sample row
  ws.addRow({
    name: 'Ramesh Shah',
    mobile: '+919876543210',
    email: 'ramesh@example.com',
    community: 'Digambar',
    city: 'Mumbai',
    state: 'Maharashtra',
    dob: '15/08/1985',
    gender: 'Male',
    bloodGroup: 'B+',
    address: '123 MG Road, Andheri',
  });
  ws.getRow(2).font = { italic: true, color: { argb: 'FF888888' } };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="jinanam-import-template.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

/**
 * Hard delete a member profile — SUPER ADMIN ONLY (§5.2 Rule 2).
 * Soft-deletes (sets deletedAt) to preserve donation/booking/event history.
 */
export const hardDeleteMember = asyncHandler(async (req: Request, res: Response) => {
  if (!req.actor!.isSuperAdmin) throw ApiError.forbidden('Only Super Admin can permanently delete member profiles.');

  const { publicId } = req.params;
  const member = await prisma.member.findFirst({ where: { publicId, deletedAt: null } });
  if (!member) throw ApiError.notFound('Member not found');

  await recordAudit({
    ...auditContextFromRequest(req),
    module: 'MEMBERS',
    action: 'DELETE',
    entityType: 'Member',
    entityId: member.id,
    isCritical: true,
    before: { publicId: member.publicId, fullName: member.fullName },
  });

  await prisma.member.update({
    where: { id: member.id },
    data: { deletedAt: new Date(), deletedById: req.actor!.userId },
  });

  return ok(res, { deleted: true, publicId: member.publicId });
});

/**
 * Community switch (§5.13) — Jain member changes their active community context.
 * Does NOT replace the original registration community — only adjusts feed priority context.
 */
export const switchActiveCommunity = asyncHandler(async (req: Request, res: Response) => {
  const member = await membersService.getMemberByUserId(req.actor!.userId);
  if (!member) throw ApiError.notFound('Member profile not found');

  const { communityId, subCommunityId, gacchaId } = req.body as Record<string, string | undefined>;

  const updated = await prisma.member.update({
    where: { id: member.id },
    data: {
      communityId: communityId ?? member.communityId ?? undefined,
      subCommunityId: subCommunityId ?? member.subCommunityId ?? undefined,
      gacchaId: gacchaId ?? member.gacchaId ?? undefined,
    },
  });

  await recordAudit({
    ...auditContextFromRequest(req),
    module: 'MEMBERS',
    action: 'COMMUNITY_SWITCH',
    entityType: 'Member',
    entityId: member.id,
    before: { communityId: member.communityId, subCommunityId: member.subCommunityId, gacchaId: member.gacchaId },
    after: { communityId: updated.communityId, subCommunityId: updated.subCommunityId, gacchaId: updated.gacchaId },
  });

  return ok(res, { communityId: updated.communityId, subCommunityId: updated.subCommunityId, gacchaId: updated.gacchaId });
});



