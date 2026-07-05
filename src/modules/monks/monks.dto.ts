import { z } from 'zod';

export const createMonkSchema = z.object({
  body: z.object({
    dikshaName: z.string().min(1),
    photoUrl: z.string().optional(),
    gender: z.enum(['SADHU', 'SADHVI']),
    dob: z.coerce.date().optional(),
    dobPlace: z.string().optional(),
    nameBeforeDiksha: z.string().optional(),
    bio: z.string().optional(),
    dikshaDate: z.coerce.date().optional(),
    dikshaPlace: z.string().optional(),
    dikshaGuruId: z.string().optional(),
    communityId: z.string().optional(),
    subCommunityId: z.string().optional(),
    gacchaId: z.string().optional(),
    currentTempleId: z.string().optional(),
    emergencyContact: z.object({ name: z.string(), mobile: z.string() }).optional(),
    groupId: z.string().optional(),
  }),
});

export const updateMonkSchema = z.object({ body: createMonkSchema.shape.body.partial() });

export const createMonkGroupSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    leaderMonkId: z.string().optional(),
    memberMonkIds: z.array(z.string()).optional(),
  }),
});
