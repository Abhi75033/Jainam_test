import { z } from 'zod';

const addressSchema = z.object({
  line1: z.preprocess((val) => (val === '' ? undefined : val), z.string({ required_error: 'Required' }).min(1, 'Required')),
  line2: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
  address: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
  area: z.preprocess((val) => (val === '' ? undefined : val), z.string({ required_error: 'Required' }).min(1, 'Required')),
  district: z.preprocess((val) => (val === '' ? undefined : val), z.string({ required_error: 'Required' }).min(1, 'Required')),
  city: z.preprocess((val) => (val === '' ? undefined : val), z.string({ required_error: 'Required' }).min(1, 'Required')),
  state: z.preprocess((val) => (val === '' ? undefined : val), z.string({ required_error: 'Required' }).min(1, 'Required')),
  country: z.preprocess((val) => (val === '' ? undefined : val), z.string({ required_error: 'Required' }).min(1, 'Required')),
  pincode: z.preprocess((val) => (val === '' ? undefined : val), z.string({ required_error: 'Required' }).min(1, 'Required')),
});

// NOTE: addressSchema.partial() only wraps each field in .optional(), it does not
// make an empty string bypass the inner preprocess+required chain. Since '' is not
// literally `undefined`, .optional() lets it through, preprocess turns it into
// undefined, and the inner required-string check then throws "Required" — so any
// admin update that leaves an address sub-field blank fails validation. Build a
// genuinely-optional schema instead so blanks are accepted on update.
const updateAddressSchema = z.object({
  line1: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
  line2: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
  address: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
  area: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
  district: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
  city: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
  state: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
  country: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
  pincode: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
});

export const registerJainMemberSchema = z.object({
  body: z.object({
    firstName: z.preprocess((val) => (val === '' ? undefined : val), z.string({ required_error: 'Required' }).min(1, 'Required')),
    middleName: z.preprocess((val) => (val === '' ? undefined : val), z.string({ required_error: 'Required' }).min(1, 'Required')),
    surname: z.preprocess((val) => (val === '' ? undefined : val), z.string({ required_error: 'Required' }).min(1, 'Required')),
    gender: z.preprocess((val) => (val === '' ? undefined : val), z.string({ required_error: 'Required' }).min(1, 'Required')),
    dob: z.preprocess((val) => (val === '' || val === null ? undefined : val), z.coerce.date({ required_error: 'Required' })),
    nationality: z.preprocess((val) => (val === '' ? undefined : val), z.string({ required_error: 'Required' }).min(1, 'Required')),
    preferredLanguage: z
      .enum(['English', 'Hindi', 'Gujarati', 'Marathi', 'Rajasthani', 'Kutchi', 'Punjabi', 'Tamil', 'Telugu', 'Kannada', 'Bengali', 'Other'])
      .default('English'),
    pan: z.preprocess(
      (val) => (val === '' || val == null ? undefined : String(val).trim().toUpperCase()),
      z.string({ required_error: 'Required' }).regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Enter a valid 10-character PAN (e.g. ABCDE1234F)'),
    ),
    aadhaar: z.preprocess(
      (val) => (val === '' || val == null ? undefined : String(val).replace(/\D/g, '')),
      z.string({ required_error: 'Required' }).regex(/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'),
    ),
    maritalStatus: z.preprocess((val) => (val === '' ? undefined : val), z.string({ required_error: 'Required' }).min(1, 'Required')),
    motherTongue: z.preprocess((val) => (val === '' ? undefined : val), z.string({ required_error: 'Required' }).min(1, 'Required')),
    communityId: z.string().min(1, 'Community is required'),
    subCommunityId: z.preprocess((val) => (val === '' ? undefined : val), z.string({ required_error: 'Required' }).min(1, 'Required')),
    gacchaId: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
    tithiCalendarTypeId: z.preprocess((val) => (val === '' ? undefined : val), z.string({ required_error: 'Required' }).min(1, 'Required')),
    whatsapp: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
    email: z.preprocess((val) => (val === '' || val === null ? undefined : val), z.string().email().optional()),
    preferredCommunicationMethod: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
    alternateContact: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
    currentAddress: addressSchema,
    permanentAddress: addressSchema,
    sameAsPermanent: z.boolean().optional(),
    nativeVillage: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
    currentLat: z.number().optional(),
    currentLng: z.number().optional(),
    bloodGroup: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
    disability: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
    medicalNotes: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
    emergencyContact: z.object({ name: z.string(), mobile: z.string(), relation: z.string().optional() }).optional(),
    profession: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
    isVolunteer: z.boolean().optional(),
    volunteerAreas: z.array(z.string()).optional(),
    volunteerAvailability: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
    preferredTempleIds: z.array(z.string()).max(5).optional(),
    additionalLinks: z.array(z.object({ targetType: z.enum(['TEMPLE', 'MONK']), targetId: z.string() })).max(10).optional(),
    consents: z.array(z.object({ consentType: z.string(), guardianName: z.string().optional() })).optional(),
    siblings: z
      .array(
        z.object({
          linkProfile: z.boolean().optional(),
          siblingMemberId: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
          fullName: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
          relationship: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
        }),
      )
      .optional(),
  }),
});

export const registerNonJainMemberSchema = z.object({
  body: registerJainMemberSchema.shape.body
    .omit({ communityId: true, subCommunityId: true, gacchaId: true, tithiCalendarTypeId: true, motherTongue: true })
    .extend({
      govtDocuments: z
        .array(z.object({ docType: z.string(), docNumber: z.string(), imageUrl: z.string().optional() }))
        .max(2)
        .optional(),
      interests: z.array(z.string()).optional(),
    }),
});

export const updateMemberProfileSchema = z.object({
  body: registerJainMemberSchema.shape.body.partial().extend({
    email: z.preprocess((val) => (val === '' || val === null ? undefined : val), z.string().email().optional()),
    dob: z.preprocess((val) => (val === '' || val === null ? undefined : val), z.coerce.date().optional()),
    currentAddress: updateAddressSchema.optional(),
    permanentAddress: updateAddressSchema.optional(),
  }),
});

export const addFamilyMemberSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    relationshipTypeId: z.string().min(1),
    mobile: z.string().min(8),
    category: z.enum(['JAIN', 'NON_JAIN']).default('JAIN'),
  }),
});

export const linkFamilyMembersSchema = z.object({
  body: z.object({
    primaryMemberPublicId: z.string().min(1),
    relatedMemberPublicId: z.string().min(1),
    relationshipTypeId: z.string().min(1),
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
