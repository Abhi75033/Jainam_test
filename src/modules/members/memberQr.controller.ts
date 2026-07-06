import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';
import { createSignedToken, renderQrPngDataUrl } from '@/engines/qr/qr.service';

/** Member ID QR — digital membership card (§4.5): signed token + rendered PNG data URL. */
export const myMemberQr = asyncHandler(async (req: Request, res: Response) => {
  const member = await prisma.member.findUnique({
    where: { userId: req.actor!.userId },
    select: { publicId: true, fullName: true, photoUrl: true },
  });
  if (!member) throw ApiError.notFound('Member profile not found');

  const token = createSignedToken({ purpose: 'MEMBER_ID', id: member.publicId });
  const qrDataUrl = await renderQrPngDataUrl(token);

  return ok(res, {
    memberPublicId: member.publicId,
    fullName: member.fullName,
    photoUrl: member.photoUrl,
    qrToken: token,
    qrDataUrl,
  });
});
