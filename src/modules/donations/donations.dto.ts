import { z } from 'zod';

export const submitManualDonationSchema = z.object({
  body: z.object({
    organizationId: z.string().min(1),
    totalAmount: z.number().positive(),
    currency: z.string().default('INR'),
    transactionReference: z.string().min(1),
    proofUrl: z.string().min(1),
    idempotencyKey: z.string().min(8).optional(),
    categorySplits: z
      .array(z.object({ donationCategoryId: z.string().min(1), amount: z.number().positive() }))
      .min(1),
    /** Admin shortcut: donate on behalf of a member by public ID (offline/cash donations). */
    donorMemberPublicId: z.string().optional(),
  }),
});

export const donationDecisionSchema = z.object({
  body: z.object({ decision: z.enum(['VERIFY', 'REJECT']), reason: z.string().optional() }),
});

export const platformDonationSchema = z.object({
  body: z.object({
    flowType: z.enum(['PLATFORM_ONLINE', 'MUSIC_FESTIVAL']),
    amount: z.number().positive(),
    currency: z.string().default('INR'),
    paymentGatewayRef: z.string().min(1),
  }),
});

export const donationListQuerySchema = z.object({
  query: z.object({
    status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const donorLookupQuerySchema = z.object({
  query: z.object({ memberPublicId: z.string().min(1) }),
});
