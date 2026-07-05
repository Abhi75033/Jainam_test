import { z } from 'zod';

const addressSchema = z.object({
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pincode: z.string().optional(),
});

export const registerJainMemberSchema = z.object({
  body: z.object({
    firstName: z.string().min(1),
    middleName: z.string().optional(),
    surname: z.string().optional(),
    gender: z.string().optional(),
    dob: z.coerce.date().optional(),
    nationality: z.string().optional(),
    preferredLanguage: z.enum(['English', 'Hindi', 'Gujarati']).default('English'),
    pan: z.string().optional(),
    aadhaar: z.string().optional(),
    maritalStatus: z.string().optional(),
    motherTongue: z.string().optional(),
    communityId: z.string().min(1, 'Community is required'),
    subCommunityId: z.string().optional(),
    gacchaId: z.string().optional(),
    tithiCalendarTypeId: z.string().optional(),
    whatsapp: z.string().optional(),
    email: z.string().email().optional(),
    preferredCommunicationMethod: z.string().optional(),
    alternateContact: z.string().optional(),
    currentAddress: addressSchema.optional(),
    permanentAddress: addressSchema.optional(),
    sameAsPermanent: z.boolean().optional(),
    nativeVillage: z.string().optional(),
    currentLat: z.number().optional(),
    currentLng: z.number().optional(),
    bloodGroup: z.string().optional(),
    disability: z.string().optional(),
    medicalNotes: z.string().optional(),
    emergencyContact: z.object({ name: z.string(), mobile: z.string(), relation: z.string().optional() }).optional(),
    profession: z.string().optional(),
    isVolunteer: z.boolean().optional(),
    volunteerAreas: z.array(z.string()).optional(),
    volunteerAvailability: z.string().optional(),
    preferredTempleIds: z.array(z.string()).max(5).optional(),
    additionalLinks: z.array(z.object({ targetType: z.enum(['TEMPLE', 'MONK']), targetId: z.string() })).max(10).optional(),
    consents: z.array(z.object({ consentType: z.string(), guardianName: z.string().optional() })).optional(),
  }),
});

export const registerNonJainMemberSchema = z.object({
  body: registerJainMemberSchema.shape.body
    .omit({ communityId: true, subCommunityId: true, gacchaId: true })
    .extend({
      govtDocuments: z
        .array(z.object({ docType: z.string(), docNumber: z.string(), imageUrl: z.string().optional() }))
        .max(2)
        .optional(),
      interests: z.array(z.string()).optional(),
    }),
});

export const updateMemberProfileSchema = z.object({
  body: registerJainMemberSchema.shape.body.partial(),
});

export const addFamilyMemberSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    relationshipTypeId: z.string().min(1),
    mobile: z.string().min(8),
    category: z.enum(['JAIN', 'NON_JAIN']).default('JAIN'),
  }),
});

export const bulkImportRowSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().min(8),
  city: z.string().optional(),
  state: z.string().optional(),
  community: z.string().optional(),
  address: z.string().optional(),
});

export const bulkImportSchema = z.object({
  body: z.object({
    rows: z.array(bulkImportRowSchema).min(1).max(5000),
  }),
});

export const updatePrivacySettingSchema = z.object({
  body: z.object({
    showMobile: z.boolean().optional(),
    showAddress: z.boolean().optional(),
    allowContact: z.boolean().optional(),
  }),
});

export const updateNotificationPrefSchema = z.object({
  body: z.object({
    channel: z.enum(['PUSH', 'WHATSAPP', 'SMS', 'EMAIL', 'IN_APP']),
    category: z.enum(['SERVICE', 'MARKETING']),
    enabled: z.boolean(),
  }),
});
