import { Member, MemberCategory, Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { nextPublicId } from '@/engines/idGenerator/id.service';
import { encryptField, hashForLookup } from '@/utils/encryption';
import { calculateAge, isSeniorCitizen } from '@/utils/dateUtils';
import { currencyForCountry } from '@/engines/currency/currency.service';
import { enqueueNotification } from '@/engines/notification/notification.service';

const NOTIFICATION_CHANNELS = ['PUSH', 'WHATSAPP', 'SMS', 'EMAIL', 'IN_APP'] as const;

async function seedDefaultPreferences(memberId: string) {
  await prisma.memberPrivacySetting.create({ data: { memberId } });
  const rows: Prisma.MemberNotificationPreferenceCreateManyInput[] = [];
  for (const channel of NOTIFICATION_CHANNELS) {
    rows.push({ memberId, channel, category: 'SERVICE', enabled: true });
    rows.push({ memberId, channel, category: 'MARKETING', enabled: false });
  }
  await prisma.memberNotificationPreference.createMany({ data: rows });
  await prisma.memberActivityAggregate.create({ data: { memberId } });
}

/** Simple weighted completion score over the fields the registration form exposes (§5.2). */
export function computeProfileCompletionPct(member: Partial<Member>): number {
  const trackedFields: (keyof Member)[] = [
    'photoUrl', 'gender', 'dob', 'nationality', 'maritalStatus', 'motherTongue', 'communityId',
    'whatsapp', 'email', 'currentAddress', 'permanentAddress', 'nativeVillage', 'bloodGroup',
    'emergencyContact', 'profession',
  ];
  const filled = trackedFields.filter((f) => member[f] !== null && member[f] !== undefined).length;
  return Math.round((filled / trackedFields.length) * 100);
}

async function applyBadgesAndCurrency(memberId: string, dob: Date | null | undefined, country: string | null | undefined) {
  if (dob && isSeniorCitizen(dob)) {
    await prisma.memberBadge.upsert({
      where: { memberId_badge: { memberId, badge: 'SENIOR_CITIZEN' } },
      update: {},
      create: { memberId, badge: 'SENIOR_CITIZEN' },
    });
  }
  return currencyForCountry(country);
}

interface RegisterMemberInput {
  userId: string;
  category: MemberCategory;
  firstName: string;
  middleName?: string;
  surname?: string;
  gender?: string;
  dob?: Date;
  nationality?: string;
  preferredLanguage?: string;
  pan?: string;
  aadhaar?: string;
  maritalStatus?: string;
  motherTongue?: string;
  communityId?: string;
  subCommunityId?: string;
  gacchaId?: string;
  tithiCalendarTypeId?: string;
  mobile: string;
  whatsapp?: string;
  email?: string;
  preferredCommunicationMethod?: string;
  alternateContact?: string;
  currentAddress?: Record<string, unknown>;
  permanentAddress?: Record<string, unknown>;
  sameAsPermanent?: boolean;
  nativeVillage?: string;
  currentLat?: number;
  currentLng?: number;
  bloodGroup?: string;
  disability?: string;
  medicalNotes?: string;
  emergencyContact?: Record<string, unknown>;
  profession?: string;
  isVolunteer?: boolean;
  volunteerAreas?: string[];
  volunteerAvailability?: string;
  preferredTempleIds?: string[];
  additionalLinks?: { targetType: 'TEMPLE' | 'MONK'; targetId: string }[];
  consents?: { consentType: string; guardianName?: string }[];
  govtDocuments?: { docType: string; docNumber: string; imageUrl?: string }[];
  interests?: string[];
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'TEMPLE_ADMIN', 'DHARAMSHALA_ADMIN', 'JAIN_CENTER_ADMIN', 'MONK_ADMIN'];

export async function registerMember(input: RegisterMemberInput) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });
  if (user.publicId) throw ApiError.conflict('Profile already exists for this account');
  // Self-registration must never overwrite an admin account's role (admins
  // registering members must use POST /members/admin-create instead)
  if (ADMIN_ROLES.includes(user.primaryRoleKey)) {
    throw ApiError.conflict('Admin accounts cannot self-register as members — use the admin member-creation flow');
  }

  if (input.category === 'JAIN' && !input.communityId) {
    throw ApiError.validation({ communityId: ['Community is required for Jain members'] });
  }

  let aadhaarHash: string | null = null;
  if (input.aadhaar) {
    aadhaarHash = hashForLookup(input.aadhaar);
    const dup = await prisma.member.findUnique({ where: { aadhaarHash } });
    if (dup) throw ApiError.conflict('A member with this Aadhaar number already exists');
  }

  const prefix = input.category === 'JAIN' ? 'JAIN_MEMBER' : 'NON_JAIN_MEMBER';
  const fullName = [input.firstName, input.middleName, input.surname].filter(Boolean).join(' ');
  const country = (input.currentAddress?.country as string | undefined) ?? input.nationality;

  const member = await prisma.$transaction(async (tx) => {
    const publicId = await nextPublicId(prefix, tx);

    const created = await tx.member.create({
      data: {
        userId: input.userId,
        publicId,
        category: input.category,
        firstName: input.firstName,
        middleName: input.middleName,
        surname: input.surname,
        fullName,
        gender: input.gender,
        dob: input.dob,
        nationality: input.nationality,
        preferredLanguage: input.preferredLanguage ?? 'English',
        panEncrypted: input.pan ? encryptField(input.pan) : null,
        aadhaarEncrypted: input.aadhaar ? encryptField(input.aadhaar) : null,
        aadhaarHash,
        maritalStatus: input.maritalStatus,
        motherTongue: input.motherTongue,
        communityId: input.communityId,
        subCommunityId: input.subCommunityId,
        gacchaId: input.gacchaId,
        tithiCalendarTypeId: input.tithiCalendarTypeId,
        mobile: input.mobile,
        mobileVerifiedAt: new Date(),
        whatsapp: input.whatsapp,
        email: input.email,
        preferredCommunicationMethod: input.preferredCommunicationMethod,
        alternateContact: input.alternateContact,
        currentAddress: (input.currentAddress ?? undefined) as Prisma.InputJsonValue,
        permanentAddress: (input.permanentAddress ?? undefined) as Prisma.InputJsonValue,
        sameAsPermanent: input.sameAsPermanent ?? false,
        nativeVillage: input.nativeVillage,
        currentLat: input.currentLat,
        currentLng: input.currentLng,
        bloodGroup: input.bloodGroup,
        disability: input.disability,
        medicalNotes: input.medicalNotes,
        emergencyContact: (input.emergencyContact ?? undefined) as Prisma.InputJsonValue,
        profession: input.profession,
        isVolunteer: input.isVolunteer ?? false,
        volunteerAreas: (input.volunteerAreas ?? undefined) as Prisma.InputJsonValue,
        volunteerAvailability: input.volunteerAvailability,
        currencyCode: currencyForCountry(country),
        status: 'ACTIVE',
        activatedAt: new Date(),
      },
    });

    await tx.user.update({
      where: { id: input.userId },
      data: { publicId, status: 'ACTIVE', primaryRoleKey: input.category === 'JAIN' ? 'MEMBER' : 'NON_JAIN_MEMBER' },
    });

    if (input.preferredTempleIds?.length) {
      await tx.memberPreferredTemple.createMany({
        data: input.preferredTempleIds.slice(0, 5).map((organizationId, idx) => ({
          memberId: created.id,
          organizationId,
          isFavourite: idx === 0,
        })),
      });
    }

    if (input.additionalLinks?.length) {
      await tx.memberAdditionalLink.createMany({
        data: input.additionalLinks.slice(0, 10).map((l) => ({ memberId: created.id, targetType: l.targetType, targetId: l.targetId })),
      });
    }

    if (input.consents?.length) {
      await tx.memberConsent.createMany({
        data: input.consents.map((c) => ({ memberId: created.id, consentType: c.consentType, guardianName: c.guardianName })),
      });
    }

    if (input.govtDocuments?.length) {
      await tx.memberGovtDocument.createMany({
        data: input.govtDocuments.slice(0, 2).map((d) => ({
          memberId: created.id,
          docType: d.docType,
          docNumberEncrypted: encryptField(d.docNumber),
          imageUrl: d.imageUrl,
        })),
      });
    }

    if (input.interests?.length) {
      await tx.memberInterest.createMany({
        data: input.interests.map((interest) => ({ memberId: created.id, interest })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  await seedDefaultPreferences(member.id);
  await applyBadgesAndCurrency(member.id, input.dob, country);

  const completion = computeProfileCompletionPct(member);
  await prisma.member.update({ where: { id: member.id }, data: { profileCompletionPct: completion } });

  return { ...member, profileCompletionPct: completion };
}

export async function getMemberByUserId(userId: string) {
  return prisma.member.findUnique({ where: { userId }, include: { privacySetting: true } });
}

export async function getMemberByPublicId(publicId: string) {
  return prisma.member.findUnique({ where: { publicId }, include: { privacySetting: true } });
}

export async function updateMemberProfile(memberId: string, input: Partial<RegisterMemberInput>) {
  const existing = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });

  const fullName = input.firstName || input.middleName || input.surname
    ? [input.firstName ?? existing.firstName, input.middleName ?? existing.middleName, input.surname ?? existing.surname].filter(Boolean).join(' ')
    : existing.fullName;

  const updated = await prisma.member.update({
    where: { id: memberId },
    data: {
      firstName: input.firstName,
      middleName: input.middleName,
      surname: input.surname,
      fullName,
      gender: input.gender,
      dob: input.dob,
      nationality: input.nationality,
      preferredLanguage: input.preferredLanguage,
      maritalStatus: input.maritalStatus,
      motherTongue: input.motherTongue,
      subCommunityId: input.subCommunityId,
      gacchaId: input.gacchaId,
      tithiCalendarTypeId: input.tithiCalendarTypeId,
      whatsapp: input.whatsapp,
      email: input.email,
      preferredCommunicationMethod: input.preferredCommunicationMethod,
      alternateContact: input.alternateContact,
      currentAddress: input.currentAddress as Prisma.InputJsonValue,
      permanentAddress: input.permanentAddress as Prisma.InputJsonValue,
      sameAsPermanent: input.sameAsPermanent,
      nativeVillage: input.nativeVillage,
      currentLat: input.currentLat,
      currentLng: input.currentLng,
      bloodGroup: input.bloodGroup,
      disability: input.disability,
      medicalNotes: input.medicalNotes,
      emergencyContact: input.emergencyContact as Prisma.InputJsonValue,
      profession: input.profession,
      isVolunteer: input.isVolunteer,
      volunteerAreas: input.volunteerAreas as Prisma.InputJsonValue,
      volunteerAvailability: input.volunteerAvailability,
      updatedById: memberId,
    },
  });

  const completion = computeProfileCompletionPct(updated);
  return prisma.member.update({ where: { id: memberId }, data: { profileCompletionPct: completion } });
}

// -----------------------------------------------------------------------------
// Family members (§5.2)
// -----------------------------------------------------------------------------

export async function addFamilyMember(primaryMemberId: string, input: { name: string; relationshipTypeId: string; mobile: string; category: MemberCategory }) {
  const primary = await prisma.member.findUniqueOrThrow({ where: { id: primaryMemberId } });

  const existingUser = await prisma.user.findUnique({ where: { mobile: input.mobile }, include: { member: true } });

  let relatedMemberId: string;
  let relatedUserId: string;
  let isNewAccount = false;

  if (existingUser?.member) {
    relatedMemberId = existingUser.member.id;
    relatedUserId = existingUser.id;
  } else if (existingUser && !existingUser.member) {
    throw ApiError.conflict('This mobile number is already registered to a non-member account');
  } else {
    const prefix = input.category === 'JAIN' ? 'JAIN_MEMBER' : 'NON_JAIN_MEMBER';
    const created = await prisma.$transaction(async (tx) => {
      const publicId = await nextPublicId(prefix, tx);
      const user = await tx.user.create({
        data: { mobile: input.mobile, publicId, status: 'PENDING_OTP', primaryRoleKey: input.category === 'JAIN' ? 'MEMBER' : 'NON_JAIN_MEMBER', createdByAdmin: false },
      });
      const member = await tx.member.create({
        data: {
          userId: user.id,
          publicId,
          category: input.category,
          firstName: input.name,
          fullName: input.name,
          mobile: input.mobile,
          communityId: input.category === 'JAIN' ? primary.communityId : null,
          status: 'INACTIVE',
          isAutoCreated: true,
        },
      });
      return { member, userId: user.id };
    });
    await seedDefaultPreferences(created.member.id);
    relatedMemberId = created.member.id;
    relatedUserId = created.userId;
    isNewAccount = true;
  }

  const existingLink = await prisma.familyMember.findUnique({
    where: { primaryMemberId_relatedMemberId: { primaryMemberId, relatedMemberId } },
  });
  if (existingLink) throw ApiError.conflict('This family member is already linked');

  const link = await prisma.familyMember.create({
    data: { primaryMemberId, relatedMemberId, relationshipTypeId: input.relationshipTypeId },
  });

  if (isNewAccount) {
    await enqueueNotification({
      userId: relatedUserId,
      templateKey: 'FAMILY_MEMBER_ADDED',
      category: 'SERVICE',
      to: { WHATSAPP: input.mobile, SMS: input.mobile },
      body: `${primary.fullName} added you as a family member on JiNANAM. Download the app to activate your account: https://jinanam.app/download`,
    });
  }

  return link;
}

/** Called on a family member's first successful OTP login to complete activation (§5.2). */
export async function activateAutoCreatedMemberIfNeeded(memberId: string) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (member && member.isAutoCreated && member.status === 'INACTIVE') {
    await prisma.member.update({ where: { id: memberId }, data: { status: 'ACTIVE', activatedAt: new Date() } });
  }
}

// -----------------------------------------------------------------------------
// Bulk import (§5.2)
// -----------------------------------------------------------------------------

export async function bulkImportMembers(rows: { name: string; mobile: string; city?: string; state?: string; community?: string; address?: string }[], uploadedById: string) {
  const batch = await prisma.bulkImportBatch.create({
    data: { uploadedById, fileUrl: 'inline-upload', totalRows: rows.length, status: 'PROCESSING' },
  });

  const results: { row: number; success: boolean; publicId?: string; error?: string }[] = [];
  let successCount = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    try {
      const existingMobile = await prisma.user.findUnique({ where: { mobile: row.mobile } });
      if (existingMobile) throw new Error('Mobile number already registered');

      let communityId: string | undefined;
      if (row.community) {
        const community = await prisma.community.findUnique({ where: { name: row.community } });
        communityId = community?.id;
      }

      const member = await prisma.$transaction(async (tx) => {
        const publicId = await nextPublicId('JAIN_MEMBER', tx);
        const user = await tx.user.create({
          data: { mobile: row.mobile, publicId, status: 'PENDING_OTP', primaryRoleKey: 'MEMBER', createdByAdmin: true },
        });
        return tx.member.create({
          data: {
            userId: user.id,
            publicId,
            category: 'JAIN',
            firstName: row.name,
            fullName: row.name,
            mobile: row.mobile,
            communityId,
            currentAddress: row.city || row.state || row.address ? ({ city: row.city, state: row.state, line1: row.address } as Prisma.InputJsonValue) : undefined,
            status: 'INACTIVE',
            isAutoCreated: true,
          },
        });
      });
      await seedDefaultPreferences(member.id);

      results.push({ row: i + 1, success: true, publicId: member.publicId });
      successCount += 1;
    } catch (err) {
      results.push({ row: i + 1, success: false, error: (err as Error).message });
    }
  }

  await prisma.bulkImportBatch.update({
    where: { id: batch.id },
    data: {
      status: 'COMPLETED',
      successCount,
      failureCount: rows.length - successCount,
      resultJson: results as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });

  return { batchId: batch.id, successCount, failureCount: rows.length - successCount, results };
}

export { calculateAge };
