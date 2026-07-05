import { OrganizationType, Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { nextPublicId } from '@/engines/idGenerator/id.service';
import { encryptField } from '@/utils/encryption';
import { MAX_TRUSTEES, MAX_DHAJA_YEARS, MAX_TEMPLE_GALLERY_IMAGES, MAX_DHARAMSHALA_GALLERY_IMAGES, ID_PREFIXES } from '@/config/constants';

const PREFIX_BY_TYPE: Record<OrganizationType, keyof typeof ID_PREFIXES> = {
  TEMPLE: 'TEMPLE',
  JAIN_CENTER: 'JAIN_CENTER',
  DHARAMSHALA: 'DHARAMSHALA',
  BHOJANSHALA: 'BHOJANSHALA',
  COMMUNITY_HALL: 'COMMUNITY_HALL',
  TRUST_OFFICE: 'TRUST_OFFICE',
};

/** Only Super Admin creates Temples/JCs/Dharamshalas (§5.5, §5.6) — enforced at the route layer via requireRole. */
export async function createOrganization(input: Record<string, unknown> & { type: OrganizationType; createdById: string }) {
  const { type, createdById, bankAccount, ...rest } = input as any;

  const publicId = await prisma.$transaction((tx) => nextPublicId(PREFIX_BY_TYPE[type as OrganizationType], tx));

  return prisma.organization.create({
    data: {
      publicId,
      type,
      ...rest,
      facilities: rest.facilities as Prisma.InputJsonValue,
      bankAccountEncrypted: bankAccount ? encryptField(bankAccount) : null,
      createdById,
      updatedById: createdById,
    },
  });
}

export async function updateOrganization(organizationId: string, input: Record<string, unknown>, updatedById: string) {
  const { bankAccount, ...rest } = input as any;
  return prisma.organization.update({
    where: { id: organizationId },
    data: {
      ...rest,
      facilities: rest.facilities as Prisma.InputJsonValue,
      ...(bankAccount ? { bankAccountEncrypted: encryptField(bankAccount) } : {}),
      updatedById,
      updatedAt: new Date(),
    },
  });
}

export async function getOrganization(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      gallery: { orderBy: { order: 'asc' } },
      trustees: { include: { member: true } },
      volunteers: { include: { member: true } },
      contacts: { include: { member: true } },
      historyEvents: true,
      dhajaRecords: { orderBy: { year: 'desc' } },
      notices: { where: { deletedAt: null }, orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' } ] },
      socialLinks: true,
    },
  });
  if (!org) throw ApiError.notFound('Organization not found');
  return org;
}

export async function listOrganizations(type: OrganizationType, filters: { city?: string; state?: string; hasBhojanshala?: boolean }) {
  return prisma.organization.findMany({
    where: {
      type,
      deletedAt: null,
      city: filters.city,
      state: filters.state,
      hasBhojanshala: filters.hasBhojanshala,
    },
    orderBy: { name: 'asc' },
  });
}

/** Bhojanalay directory — view-only listing of temples with bhojanshala = yes (§5.5). */
export async function listBhojanalayDirectory() {
  return prisma.organization.findMany({ where: { hasBhojanshala: true, deletedAt: null }, orderBy: { name: 'asc' } });
}

export async function addGalleryImage(organizationId: string, imageUrl: string, order: number, orgType: OrganizationType) {
  const count = await prisma.organizationGalleryImage.count({ where: { organizationId } });
  const max = orgType === 'DHARAMSHALA' ? MAX_DHARAMSHALA_GALLERY_IMAGES : MAX_TEMPLE_GALLERY_IMAGES;
  if (count >= max) throw ApiError.validation({ gallery: [`Maximum ${max} images allowed`] });
  return prisma.organizationGalleryImage.create({ data: { organizationId, imageUrl, order } });
}

export async function addTrustee(organizationId: string, memberId: string, designation: string) {
  const count = await prisma.organizationTrustee.count({ where: { organizationId } });
  if (count >= MAX_TRUSTEES) throw ApiError.validation({ trustees: [`Maximum ${MAX_TRUSTEES} trustees allowed`] });
  return prisma.organizationTrustee.create({ data: { organizationId, memberId, designation } });
}

export async function addVolunteer(organizationId: string, memberId: string, area?: string) {
  const volunteer = await prisma.organizationVolunteer.create({ data: { organizationId, memberId, area } });
  await prisma.member.update({ where: { id: memberId }, data: { isVolunteer: true } });
  return volunteer;
}

export async function addContact(organizationId: string, memberId: string, role?: string) {
  return prisma.organizationContact.create({ data: { organizationId, memberId, role } });
}

export async function verifyContact(contactId: string) {
  return prisma.organizationContact.update({ where: { id: contactId }, data: { otpVerifiedAt: new Date() } });
}

/** Dhaja Management — per-year records up to 25 years (§5.5). */
export async function upsertDhajaRecord(organizationId: string, input: { year: number; dhajaDate?: Date; descriptionEn?: string; descriptionHi?: string; linkedMemberIds?: string[]; status?: any }) {
  const distinctYears = await prisma.dhajaRecord.count({ where: { organizationId } });
  const existing = await prisma.dhajaRecord.findUnique({ where: { organizationId_year: { organizationId, year: input.year } } });
  if (!existing && distinctYears >= MAX_DHAJA_YEARS) {
    throw ApiError.validation({ year: [`Maximum ${MAX_DHAJA_YEARS} years of Dhaja records allowed`] });
  }
  return prisma.dhajaRecord.upsert({
    where: { organizationId_year: { organizationId, year: input.year } },
    update: {
      dhajaDate: input.dhajaDate,
      descriptionEn: input.descriptionEn,
      descriptionHi: input.descriptionHi,
      linkedMemberIds: input.linkedMemberIds as Prisma.InputJsonValue,
      status: input.status,
    },
    create: {
      organizationId,
      year: input.year,
      dhajaDate: input.dhajaDate,
      descriptionEn: input.descriptionEn,
      descriptionHi: input.descriptionHi,
      linkedMemberIds: input.linkedMemberIds as Prisma.InputJsonValue,
      status: input.status ?? 'NOT_YET_FINALIZED',
    },
  });
}

/** Reviews: members rate 1-5 + comment; admin can reply but NOT delete; only Super Admin edits/hides/deletes (§5.5). */
export async function addReview(organizationId: string, memberId: string, rating: number, comment?: string) {
  const review = await prisma.organizationReview.upsert({
    where: { organizationId_memberId: { organizationId, memberId } },
    update: { rating, comment },
    create: { organizationId, memberId, rating, comment },
  });
  await recomputeAvgRating(organizationId);
  return review;
}

export async function replyToReview(reviewId: string, adminReply: string) {
  return prisma.organizationReview.update({ where: { id: reviewId }, data: { adminReply } });
}

export async function hideReview(reviewId: string, hiddenById: string) {
  const review = await prisma.organizationReview.update({ where: { id: reviewId }, data: { isHidden: true, deletedById: hiddenById } });
  await recomputeAvgRating(review.organizationId);
  return review;
}

async function recomputeAvgRating(organizationId: string) {
  const agg = await prisma.organizationReview.aggregate({
    where: { organizationId, isHidden: false, deletedAt: null },
    _avg: { rating: true },
  });
  await prisma.organization.update({ where: { id: organizationId }, data: { avgRating: agg._avg.rating ?? 0 } });
}

export async function addNotice(organizationId: string, input: { title: string; body: string; isPinned?: boolean; startDate?: Date; endDate?: Date }, createdById: string) {
  return prisma.organizationNotice.create({ data: { organizationId, ...input, createdById } });
}

export async function followOrganization(organizationId: string, memberId: string) {
  const follow = await prisma.organizationFollow.create({ data: { organizationId, memberId } });
  await prisma.organization.update({ where: { id: organizationId }, data: { followersCount: { increment: 1 } } });
  return follow;
}

export async function unfollowOrganization(organizationId: string, memberId: string) {
  await prisma.organizationFollow.delete({ where: { organizationId_memberId: { organizationId, memberId } } });
  await prisma.organization.update({ where: { id: organizationId }, data: { followersCount: { decrement: 1 } } });
}

/** "Report Incorrect Information" auto-creates a support ticket (§5.5). */
export async function reportIncorrectInfo(organizationId: string, description: string, raisedByUserId: string) {
  const publicId = await prisma.$transaction((tx) => nextPublicId('SUPPORT_TICKET', tx));
  return prisma.supportTicket.create({
    data: {
      publicId,
      type: 'INCORRECT_INFO',
      raisedByUserId,
      organizationId,
      subject: 'Incorrect information reported',
      description,
      relatedEntityType: 'Organization',
      relatedEntityId: organizationId,
    },
  });
}
