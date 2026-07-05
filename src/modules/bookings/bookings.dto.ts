import { z } from 'zod';

export const createBookingItemSchema = z.object({
  body: z.object({
    organizationId: z.string().min(1),
    name: z.string().min(1),
    categoryId: z.string().min(1),
    description: z.string().optional(),
    images: z.array(z.string()).optional(),
    termsAndConditions: z.string().optional(),
    guidelines: z.string().optional(),
    cancellationPolicy: z.string().optional(),
    type: z.enum(['FREE', 'PAID']),
    durationType: z.enum(['HOURLY', 'HALF_DAY', 'FULL_DAY', 'MULTI_DAY', 'CUSTOM_SLOT']),
    capacityMaxBookings: z.number().int().optional(),
    capacityMaxPeople: z.number().int().optional(),
    availabilityConfig: z.record(z.string(), z.unknown()).optional(),
    chargeAmount: z.number().min(0).default(0),
    currency: z.string().default('INR'),
    paymentType: z.string().optional(),
    bankDetails: z.record(z.string(), z.unknown()).optional(),
    paymentWindowHours: z.union([z.literal(2), z.literal(3), z.literal(6), z.literal(12), z.literal(24)]).default(24),
  }),
});

export const updateBookingItemSchema = z.object({ body: createBookingItemSchema.shape.body.partial() });

export const addBlackoutDateSchema = z.object({
  body: z.object({ date: z.coerce.date(), reason: z.string().optional() }),
});

export const addInternalReservationSchema = z.object({
  body: z.object({ date: z.coerce.date(), slot: z.string().optional(), reason: z.string().min(1) }),
});

export const availabilityQuerySchema = z.object({
  query: z.object({ from: z.coerce.date(), to: z.coerce.date() }),
});

export const submitBookingSchema = z.object({
  body: z.object({
    bookingItemId: z.string().min(1),
    dateFrom: z.coerce.date(),
    dateTo: z.coerce.date().optional(),
    slot: z.string().optional(),
    peopleCount: z.number().int().min(1).default(1),
  }),
});

export const bookingDecisionSchema = z.object({
  body: z.object({
    decision: z.enum(['APPROVE', 'REJECT', 'REQUEST_INFO']),
    reason: z.string().optional(),
  }),
});

export const submitPaymentProofSchema = z.object({
  body: z.object({
    paymentReference: z.string().min(1),
    paymentProofUrl: z.string().min(1),
    paymentNotes: z.string().optional(),
    idempotencyKey: z.string().min(8),
  }),
});

export const paymentVerificationSchema = z.object({
  body: z.object({ decision: z.enum(['APPROVE', 'REJECT']), reason: z.string().optional() }),
});

export const myBookingsQuerySchema = z.object({
  query: z.object({
    scope: z.enum(['upcoming', 'past', 'all']).default('all'),
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().optional(),
    categoryId: z.string().optional(),
    organizationId: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
});
