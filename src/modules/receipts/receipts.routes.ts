import { Router, Request, Response } from 'express';
import { requireAuth, requirePermission } from '@/middlewares/auth';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';

/**
 * §G3: dedicated Receipts view — the admin panel previously had no real
 * endpoint for this and instead re-derived fake receipt numbers from the
 * Donations list. The Receipt model (and the real PDF generation pipeline
 * in donations.service.ts / bookings.service.ts) already existed; this just
 * exposes it directly instead of leaving it write-only.
 */
export const receiptRoutes = Router();

const receiptSelect = {
  id: true,
  publicId: true,
  type: true,
  amount: true,
  currency: true,
  pdfUrl: true,
  issuedAt: true,
  organizationId: true,
  donation: { select: { publicId: true, member: { select: { publicId: true, fullName: true } } } },
  booking: { select: { publicId: true, member: { select: { publicId: true, fullName: true } } } },
} as const;

function serializeReceipt(r: {
  id: string;
  publicId: string;
  type: string;
  amount: unknown;
  currency: string;
  pdfUrl: string | null;
  issuedAt: Date;
  donation: { publicId: string; member: { publicId: string; fullName: string } } | null;
  booking: { publicId: string; member: { publicId: string; fullName: string } } | null;
}) {
  const source = r.donation || r.booking;
  return {
    id: r.id,
    publicId: r.publicId,
    type: r.type,
    amount: r.amount,
    currency: r.currency,
    pdfUrl: r.pdfUrl,
    issuedAt: r.issuedAt,
    payerName: source?.member?.fullName ?? null,
    payerPublicId: source?.member?.publicId ?? null,
    sourcePublicId: source?.publicId ?? null,
  };
}

// Super Admin sees every receipt; org admins only see receipts for their scoped organizations.
receiptRoutes.get(
  '/',
  requireAuth,
  requirePermission('DONATIONS', 'VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const isSuperAdmin = req.actor!.isSuperAdmin;
    const organizationIds = req.actor!.organizationIds;
    const rows = await prisma.receipt.findMany({
      where: isSuperAdmin ? {} : { organizationId: { in: organizationIds } },
      select: receiptSelect,
      orderBy: { issuedAt: 'desc' },
      take: 500,
    });
    return ok(res, rows.map(serializeReceipt));
  }),
);

// A member's own receipts across both donations and paid bookings.
receiptRoutes.get(
  '/my',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });
    if (!member) throw ApiError.notFound('Member profile not found');
    const rows = await prisma.receipt.findMany({
      where: { OR: [{ donation: { memberId: member.id } }, { booking: { memberId: member.id } }] },
      select: receiptSelect,
      orderBy: { issuedAt: 'desc' },
    });
    return ok(res, rows.map(serializeReceipt));
  }),
);
