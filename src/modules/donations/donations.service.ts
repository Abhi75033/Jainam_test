import { DonationFlowType, Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ApiError } from '@/utils/ApiError';
import { nextPublicId } from '@/engines/idGenerator/id.service';
import { enqueueNotification } from '@/engines/notification/notification.service';
import { generateReceiptPdf } from '@/engines/export/receipt.service';
import { storage } from '@/utils/storage';
import { broadcastDashboardUpdate } from '@/modules/dashboard/dashboard.service';

/**
 * Donations (§5.8), three flows:
 *  1. ORG_MANUAL      — offline payment + proof upload + admin verification
 *  2. PLATFORM_ONLINE — gateway payment, auto-confirm, instant receipt
 *  3. MUSIC_FESTIVAL  — same as 2 with its own Super Admin-managed config
 */

/** Per-category amounts MUST sum to the entered total (§5.8, validated to the paisa). */
export function assertSplitsMatchTotal(totalAmount: number, splits: { amount: number }[]) {
  const sum = splits.reduce((acc, s) => acc + s.amount, 0);
  if (Math.round(sum * 100) !== Math.round(totalAmount * 100)) {
    throw ApiError.validation({
      categorySplits: [`Category amounts (${sum.toFixed(2)}) must sum exactly to the total (${totalAmount.toFixed(2)})`],
    });
  }
}

export async function submitManualDonation(input: {
  organizationId: string;
  memberId: string; // donor (self, or resolved from donorMemberPublicId by admin)
  totalAmount: number;
  currency: string;
  transactionReference: string;
  proofUrl: string;
  categorySplits: { donationCategoryId: string; amount: number }[];
  createdById: string;
}) {
  assertSplitsMatchTotal(input.totalAmount, input.categorySplits);

  const org = await prisma.organization.findUnique({ where: { id: input.organizationId } });
  if (!org || org.deletedAt) throw ApiError.notFound('Organization not found');

  const donation = await prisma.$transaction(async (tx) => {
    const publicId = await nextPublicId('DONATION', tx);
    const created = await tx.donation.create({
      data: {
        publicId,
        flowType: 'ORG_MANUAL',
        organizationId: input.organizationId,
        memberId: input.memberId,
        totalAmount: input.totalAmount,
        currency: input.currency,
        transactionReference: input.transactionReference,
        proofUrl: input.proofUrl,
        status: 'PENDING',
        createdById: input.createdById,
      },
    });
    await tx.donationCategorySplit.createMany({
      data: input.categorySplits.map((s) => ({ donationId: created.id, donationCategoryId: s.donationCategoryId, amount: s.amount })),
    });
    return created;
  });

  const member = await prisma.member.findUniqueOrThrow({ where: { id: input.memberId } });
  await enqueueNotification({
    userId: member.userId,
    templateKey: 'DONATION_SUBMITTED',
    category: 'SERVICE',
    to: { PUSH: member.userId, IN_APP: member.userId },
    body: `Your donation ${donation.publicId} of ${input.currency} ${input.totalAmount.toFixed(2)} to ${org.name} is pending verification.`,
  });

  broadcastDashboardUpdate(input.organizationId);
  return donation;
}

/** Admin shortcut: enter JFJM108 -> auto-fill donor details (§5.8). */
export async function lookupDonor(memberPublicId: string) {
  const member = await prisma.member.findUnique({
    where: { publicId: memberPublicId },
    select: { id: true, publicId: true, fullName: true, mobile: true, photoUrl: true },
  });
  if (!member) throw ApiError.notFound('No member found for this ID');
  return member;
}

export async function decideDonation(donationId: string, decision: 'VERIFY' | 'REJECT', actorUserId: string, reason?: string) {
  const donation = await prisma.donation.findUnique({ where: { id: donationId }, include: { member: true, organization: true } });
  if (!donation) throw ApiError.notFound('Donation not found');
  if (donation.status !== 'PENDING') throw ApiError.conflict(`Donation already ${donation.status.toLowerCase()}`);

  if (decision === 'REJECT') {
    const updated = await prisma.donation.update({
      where: { id: donationId },
      data: { status: 'REJECTED', rejectionReason: reason, verifiedById: actorUserId, verifiedAt: new Date() },
    });
    await enqueueNotification({
      userId: donation.member.userId,
      templateKey: 'DONATION_REJECTED',
      category: 'SERVICE',
      to: { PUSH: donation.member.userId, IN_APP: donation.member.userId },
      body: `Your donation ${donation.publicId} could not be verified.${reason ? ` Reason: ${reason}` : ''}`,
    });
    if (donation.organizationId) {
      broadcastDashboardUpdate(donation.organizationId);
    }
    return updated;
  }

  const updated = await prisma.donation.update({
    where: { id: donationId },
    data: { status: 'VERIFIED', verifiedById: actorUserId, verifiedAt: new Date() },
  });

  const receipt = await issueDonationReceipt(donationId);

  await enqueueNotification({
    userId: donation.member.userId,
    templateKey: 'DONATION_VERIFIED',
    category: 'SERVICE',
    to: { PUSH: donation.member.userId, IN_APP: donation.member.userId },
    body: `Your donation ${donation.publicId} has been verified. Receipt ${receipt.publicId} is available for download.`,
  });

  if (donation.organizationId) {
    broadcastDashboardUpdate(donation.organizationId);
  }
  return updated;
}

export async function submitPlatformDonation(input: {
  flowType: Extract<DonationFlowType, 'PLATFORM_ONLINE' | 'MUSIC_FESTIVAL'>;
  memberId: string;
  amount: number;
  currency: string;
  paymentGatewayRef: string;
}) {
  const config = await prisma.donationCampaignConfig.findUnique({ where: { type: input.flowType } });
  if (!config?.isActive) throw ApiError.notFound('This donation campaign is not currently active');

  const donation = await prisma.$transaction(async (tx) => {
    const publicId = await nextPublicId('DONATION', tx);
    return tx.donation.create({
      data: {
        publicId,
        flowType: input.flowType,
        memberId: input.memberId,
        totalAmount: input.amount,
        currency: input.currency,
        paymentGatewayRef: input.paymentGatewayRef,
        status: 'VERIFIED', // online gateway donations auto-confirm (§5.8)
        verifiedAt: new Date(),
      },
    });
  });

  const receipt = await issueDonationReceipt(donation.id);

  const member = await prisma.member.findUniqueOrThrow({ where: { id: input.memberId } });
  await enqueueNotification({
    userId: member.userId,
    templateKey: 'DONATION_VERIFIED',
    category: 'SERVICE',
    to: { PUSH: member.userId, IN_APP: member.userId },
    body: `Thank you! Your donation ${donation.publicId} is confirmed. Receipt ${receipt.publicId} is available.`,
  });

  return { donation, receipt };
}

export async function getCampaignConfig(flowType: 'PLATFORM_ONLINE' | 'MUSIC_FESTIVAL') {
  return prisma.donationCampaignConfig.findUnique({ where: { type: flowType } });
}

export async function updateCampaignConfig(flowType: 'PLATFORM_ONLINE' | 'MUSIC_FESTIVAL', input: { message?: string; isActive?: boolean }, updatedById: string) {
  return prisma.donationCampaignConfig.update({ where: { type: flowType }, data: { ...input, updatedById } });
}

async function issueDonationReceipt(donationId: string) {
  const donation = await prisma.donation.findUniqueOrThrow({
    where: { id: donationId },
    include: { member: true, organization: true, categorySplits: { include: { donationCategory: true } } },
  });

  const receiptPublicId = await prisma.$transaction((tx) => nextPublicId('RECEIPT', tx));

  const pdf = await generateReceiptPdf({
    receiptNumber: receiptPublicId,
    type: 'DONATION',
    organizationName: donation.organization?.name ?? 'JiNANAM Platform',
    trustRegistrationNumber: donation.organization?.trustRegistrationNumber ?? undefined,
    is80gEligible: donation.organization?.is80gEligible ?? false,
    memberName: donation.member.fullName,
    memberPublicId: donation.member.publicId,
    amount: donation.totalAmount.toString(),
    currency: donation.currency,
    issuedAt: new Date(),
    lineItems: [
      { label: 'Donation ID', value: donation.publicId },
      ...(donation.transactionReference ? [{ label: 'Transaction Reference', value: donation.transactionReference }] : []),
      ...donation.categorySplits.map((s) => ({ label: s.donationCategory.name, value: `${donation.currency} ${s.amount.toString()}` })),
    ],
  });

  const stored = await storage.save(pdf, `${receiptPublicId}.pdf`, 'application/pdf', 'receipts');

  return prisma.receipt.create({
    data: {
      publicId: receiptPublicId,
      type: 'DONATION',
      organizationId: donation.organizationId,
      memberId: donation.memberId,
      donationId: donation.id,
      amount: donation.totalAmount,
      currency: donation.currency,
      pdfUrl: stored.url,
    },
  });
}

/** Org-scoped donation listing — org admins never see other orgs' financials (§5.8). */
export async function listOrgDonations(organizationId: string, query: { status?: any; page: number; pageSize: number }) {
  const where: Prisma.DonationWhereInput = { organizationId, status: query.status };
  const [total, rows] = await Promise.all([
    prisma.donation.count({ where }),
    prisma.donation.findMany({
      where,
      include: { member: { select: { fullName: true, publicId: true } }, categorySplits: { include: { donationCategory: true } }, receipt: { select: { publicId: true, pdfUrl: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { total, rows };
}

export async function listMyDonations(memberId: string, query: { page: number; pageSize: number }) {
  const where: Prisma.DonationWhereInput = { memberId };
  const [total, rows] = await Promise.all([
    prisma.donation.count({ where }),
    prisma.donation.findMany({
      where,
      include: { organization: { select: { name: true, publicId: true } }, categorySplits: { include: { donationCategory: true } }, receipt: { select: { publicId: true, pdfUrl: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { total, rows };
}
