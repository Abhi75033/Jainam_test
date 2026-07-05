import { z } from 'zod';

export const createOrganizationSchema = z.object({
  body: z.object({
    type: z.enum(['TEMPLE', 'JAIN_CENTER', 'DHARAMSHALA', 'BHOJANSHALA', 'COMMUNITY_HALL', 'TRUST_OFFICE']),
    name: z.string().min(1),
    shortName: z.string().optional(),
    trustName: z.string().optional(),
    trustRegistrationNumber: z.string().optional(),
    communityId: z.string().optional(),
    subCommunityId: z.string().optional(),
    gacchaId: z.string().optional(),
    mulNayakBhagwanId: z.string().optional(),
    mulNayakImageUrl: z.string().optional(),
    muritCount: z.number().int().optional(),
    templeType: z.enum(['SHIKHAR_BADDHA', 'GHAR_DERASAR', 'JAIN_CENTRE']).optional(),
    tithiCalendarTypeId: z.string().optional(),
    history: z.string().optional(),
    addressLine: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    pincode: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    googleMapsLink: z.string().optional(),
    facilities: z.array(z.string()).optional(),
    hasUpashray: z.boolean().optional(),
    hasEventHall: z.boolean().optional(),
    eventHallBookable: z.boolean().optional(),
    hasBhojanshala: z.boolean().optional(),
    bankAccount: z.string().optional(),
    bankIfsc: z.string().optional(),
    upiId: z.string().optional(),
    is80gEligible: z.boolean().optional(),
    csrEligible: z.boolean().optional(),
    donationQrUrl: z.string().optional(),
    disclaimerText: z.string().optional(),
  }),
});

export const updateOrganizationSchema = z.object({ body: createOrganizationSchema.shape.body.partial() });

export const addTrusteeSchema = z.object({ body: z.object({ memberId: z.string(), designation: z.string().min(1) }) });
export const addVolunteerSchema = z.object({ body: z.object({ memberId: z.string(), area: z.string().optional() }) });
export const addContactSchema = z.object({ body: z.object({ memberId: z.string(), role: z.string().optional() }) });

export const addDhajaRecordSchema = z.object({
  body: z.object({
    year: z.number().int(),
    dhajaDate: z.coerce.date().optional(),
    descriptionEn: z.string().optional(),
    descriptionHi: z.string().optional(),
    linkedMemberIds: z.array(z.string()).optional(),
    status: z.enum(['FINALIZED', 'NOT_YET_FINALIZED', 'AVAILABLE', 'BOOKED', 'PENDING']).optional(),
  }),
});

export const addReviewSchema = z.object({ body: z.object({ rating: z.number().int().min(1).max(5), comment: z.string().optional() }) });
export const replyReviewSchema = z.object({ body: z.object({ adminReply: z.string().min(1) }) });

export const addNoticeSchema = z.object({
  body: z.object({ title: z.string().min(1), body: z.string().min(1), isPinned: z.boolean().optional(), startDate: z.coerce.date().optional(), endDate: z.coerce.date().optional() }),
});

export const addGalleryImageSchema = z.object({ body: z.object({ imageUrl: z.string().min(1), order: z.number().int().optional() }) });

export const reportIncorrectInfoSchema = z.object({ body: z.object({ description: z.string().min(1) }) });
