import { z } from 'zod';

const visibilityConfigSchema = z.object({
  isPublic: z.boolean().optional(),
  followedEntityIds: z.object({ organizationIds: z.array(z.string()).optional(), monkIds: z.array(z.string()).optional() }).optional(),
  community: z.object({ communityIds: z.array(z.string()).optional(), subCommunityIds: z.array(z.string()).optional(), gacchaIds: z.array(z.string()).optional() }).optional(),
  geo: z.object({ gpsRadiusKm: z.number().optional(), centerLat: z.number().optional(), centerLng: z.number().optional(), city: z.string().optional(), state: z.string().optional(), country: z.string().optional() }).optional(),
  linkedMemberIds: z.array(z.string()).optional(),
});

export const createEventSchema = z.object({
  body: z.object({
    organizationId: z.string().min(1),
    title: z.string().min(1),
    bannerUrl: z.string().optional(),
    categoryId: z.string().optional(),
    description: z.string().optional(),
    venue: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    attachments: z.array(z.string()).optional(),
    visibilityConfig: visibilityConfigSchema.optional(),
    rsvpCapacity: z.number().int().positive().optional(),
    waitingListEnabled: z.boolean().default(true),
    isPaid: z.boolean().default(false),
  }),
});

export const updateEventSchema = z.object({ body: createEventSchema.shape.body.partial() });

export const rsvpSchema = z.object({
  body: z.object({ attendeeCount: z.number().int().min(1).max(20).default(1) }),
});

export const createTicketCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1),
    price: z.number().min(0),
    currency: z.string().default('INR'),
    capacity: z.number().int().positive(),
    description: z.string().optional(),
    saleStartAt: z.coerce.date().optional(),
    saleEndAt: z.coerce.date().optional(),
    visibilityConfig: visibilityConfigSchema.optional(),
  }),
});

export const purchaseTicketsSchema = z.object({
  body: z.object({
    ticketCategoryId: z.string().min(1),
    attendees: z
      .array(
        z.object({
          memberPublicId: z.string().optional(), // guests may be blank per event policy
          seatId: z.string().optional(),
        }),
      )
      .min(1)
      .max(10),
    paymentRef: z.string().min(1),
    idempotencyKey: z.string().min(8),
  }),
});

export const scanTicketSchema = z.object({
  body: z.object({ qrToken: z.string().min(10), gate: z.string().optional() }),
});

export const eventFeedbackSchema = z.object({
  body: z.object({ rating: z.number().int().min(1).max(5), comment: z.string().optional() }),
});

export const addGalleryImagesSchema = z.object({
  body: z.object({ imageUrls: z.array(z.string()).min(1).max(25) }),
});

export const addVideoLinkSchema = z.object({ body: z.object({ url: z.string().url() }) });

export const memberEventsQuerySchema = z.object({
  query: z.object({
    scope: z.enum(['upcoming', 'today', 'my-rsvp', 'my-tickets', 'waiting-list', 'past']).default('upcoming'),
    organizationId: z.string().optional(),
    year: z.coerce.number().int().optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
});
