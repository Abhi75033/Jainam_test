import { z } from 'zod';

export const createMonkSchema = z.object({
  body: z.object({
    dikshaName: z.string().min(1),
    photoUrl: z.string().optional().nullable(),
    gender: z.enum(['SADHU', 'SADHVI']),
    dob: z.coerce.date().optional().nullable(),
    dobPlace: z.string().optional().nullable(),
    nameBeforeDiksha: z.string().optional().nullable(),
    bio: z.string().optional().nullable(),
    dikshaDate: z.coerce.date().optional().nullable(),
    dikshaPlace: z.string().optional().nullable(),
    dikshaGuruId: z.string().optional().nullable(),
    communityId: z.string().optional().nullable(),
    subCommunityId: z.string().optional().nullable(),
    gacchaId: z.string().optional().nullable(),
    currentTempleId: z.string().optional().nullable(),
    emergencyContact: z.any().optional(),
    groupId: z.string().optional().nullable(),

    // New profile fields
    shortName: z.string().optional().nullable(),
    nirvanaDate: z.coerce.date().optional().nullable(),
    nirvanaPlace: z.string().optional().nullable(),
    preDikshaFather: z.any().optional(),
    preDikshaMother: z.any().optional(),
    siblings: z.any().optional(),
    preDikshaLocation: z.any().optional(),
    timeline: z.any().optional(),
    tapasya: z.any().optional(),
    tracking: z.any().optional(),
    chaturmasHistory: z.any().optional(),
    routine: z.any().optional(),
    languages: z.any().optional(),
    health: z.any().optional(),
    media: z.any().optional(),
    sanghContacts: z.any().optional(),
    recognitions: z.any().optional(),
    socialLinks: z.any().optional(),
    verified: z.boolean().optional(),
    assignedAdminId: z.string().optional().nullable(),
  }),
});

export const updateMonkSchema = z.object({ body: createMonkSchema.shape.body.partial() });

export const createMonkGroupSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    leaderMonkId: z.string().optional().nullable(),
    memberMonkIds: z.array(z.string()).optional(),
    groupNumber: z.string().optional().nullable(),
    jainMembers: z.any().optional(),
    nonJainMembers: z.any().optional(),
    notes: z.string().optional().nullable(),
  }),
});
