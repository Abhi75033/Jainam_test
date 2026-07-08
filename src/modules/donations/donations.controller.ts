import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import * as donationsService from './donations.service';
import { prisma } from '@/config/prisma';
import { recordAudit, auditContextFromRequest } from '@/engines/audit/audit.service';

async function requireMember(userId: string) {
  const member = await prisma.member.findUnique({ where: { userId } });
  if (!member) throw ApiError.notFound('Member profile not found');
  return member;
}

export const submitManualDonation = asyncHandler(async (req: Request, res: Response) => {
  let donorMemberId: string;

  if (req.body.donorMemberPublicId) {
    // Admin shortcut path — requires DONATIONS approve permission (route-guarded)
    const donor = await donationsService.lookupDonor(req.body.donorMemberPublicId);
    donorMemberId = donor.id;
  } else {
    const member = await requireMember(req.actor!.userId);
    donorMemberId = member.id;
  }

  const donation = await donationsService.submitManualDonation({
    organizationId: req.body.organizationId,
    memberId: donorMemberId,
    totalAmount: req.body.totalAmount,
    currency: req.body.currency,
    transactionReference: req.body.transactionReference,
    proofUrl: req.body.proofUrl,
    categorySplits: req.body.categorySplits,
    createdById: req.actor!.userId,
  });
  return created(res, donation);
});

export const lookupDonor = asyncHandler(async (req: Request, res: Response) => {
  const donor = await donationsService.lookupDonor(req.query.memberPublicId as string);
  return ok(res, donor);
});

export const decideDonation = asyncHandler(async (req: Request, res: Response) => {
  const donation = await donationsService.decideDonation(req.params.donationId as string, req.body.decision, req.actor!.userId, req.body.reason);
  await recordAudit({
    ...auditContextFromRequest(req),
    organizationId: donation.organizationId ?? undefined,
    module: 'DONATIONS',
    action: `DONATION_${req.body.decision}`,
    entityType: 'Donation',
    entityId: donation.id,
    after: { status: donation.status },
    isCritical: true,
  });
  return ok(res, donation);
});

export const submitPlatformDonation = asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const result = await donationsService.submitPlatformDonation({
    flowType: req.body.flowType,
    memberId: member.id,
    amount: req.body.amount,
    currency: req.body.currency,
    paymentGatewayRef: req.body.paymentGatewayRef,
  });
  return created(res, result);
});

export const getCampaignConfig = asyncHandler(async (req: Request, res: Response) => {
  const config = await donationsService.getCampaignConfig(req.params.flowType as 'PLATFORM_ONLINE' | 'MUSIC_FESTIVAL');
  return ok(res, config);
});

export const updateCampaignConfig = asyncHandler(async (req: Request, res: Response) => {
  const config = await donationsService.updateCampaignConfig(req.params.flowType as 'PLATFORM_ONLINE' | 'MUSIC_FESTIVAL', req.body, req.actor!.userId);
  return ok(res, config);
});

export const orgDonations = asyncHandler(async (req: Request, res: Response) => {
  const { status, page = 1, pageSize = 20 } = req.query as any;
  const { total, rows } = await donationsService.listOrgDonations(req.params.organizationId as string, { status, page: Number(page), pageSize: Number(pageSize) });
  return ok(res, rows, { total });
});

export const orgDonationsExport = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query as any;
  const { rows } = await donationsService.listOrgDonations(req.params.organizationId as string, { status, page: 1, pageSize: 5000 });
  const { sendListExport, parseExportFormat } = await import('@/utils/listExport');
  return sendListExport(
    res,
    parseExportFormat(req.query.format),
    'Organization Donations',
    rows.map((r) => ({
      donationId: r.publicId,
      donor: `${r.member.fullName} (${r.member.publicId})`,
      amount: r.totalAmount.toString(),
      currency: r.currency,
      status: r.status,
      categories: r.categorySplits.map((s) => `${s.donationCategory.name}: ${s.amount}`).join('; '),
      date: r.createdAt.toISOString().slice(0, 10),
    })),
    [
      { key: 'donationId', header: 'Donation ID' },
      { key: 'donor', header: 'Donor' },
      { key: 'amount', header: 'Amount' },
      { key: 'currency', header: 'Currency' },
      { key: 'status', header: 'Status' },
      { key: 'categories', header: 'Category Split' },
      { key: 'date', header: 'Date' },
    ],
  );
});

/** Platform-wide donation list — Super Admin only; org admins use /donations/org/:id. */
export const listAllDonations = asyncHandler(async (req: Request, res: Response) => {
  if (!req.actor!.isSuperAdmin) throw ApiError.forbidden('Platform-wide donation list is Super Admin only');
  const { status } = req.query as { status?: string };
  const rows = await prisma.donation.findMany({
    where: { ...(status && status !== 'ALL' ? { status: status as any } : {}) },
    include: {
      organization: { select: { name: true, publicId: true } },
      member: { select: { fullName: true, publicId: true } },
      categorySplits: { include: { donationCategory: { select: { name: true } } } },
      receipt: { select: { publicId: true, pdfUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return ok(res, rows);
});

export const myDonations = asyncHandler(async (req: Request, res: Response) => {
  const member = await requireMember(req.actor!.userId);
  const { page = 1, pageSize = 20 } = req.query as any;
  const { total, rows } = await donationsService.listMyDonations(member.id, { page: Number(page), pageSize: Number(pageSize) });
  return ok(res, rows, { total });
});
