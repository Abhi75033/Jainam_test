import { z } from 'zod';

export const createBuildingSchema = z.object({ body: z.object({ name: z.string().min(1) }) });
export const createWingSchema = z.object({ body: z.object({ name: z.string().min(1), floor: z.string().optional() }) });

export const createRoomSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    type: z.enum(['ROOM', 'HALL', 'DORMITORY']),
    capacity: z.number().int().min(1),
    pricePerUnit: z.number().min(0).default(0),
    currency: z.string().default('INR'),
    amenities: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(),
    status: z.enum(['AVAILABLE', 'UNAVAILABLE', 'MAINTENANCE']).optional(),
  }),
});

export const updateRoomSchema = z.object({ body: createRoomSchema.shape.body.partial() });
