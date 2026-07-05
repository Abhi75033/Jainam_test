import { z } from 'zod';

export const createRouteSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    monkId: z.string().min(1),
    journeyDate: z.coerce.date(),
    stops: z
      .array(
        z.object({
          order: z.number().int().min(0),
          templeId: z.string().optional(),
          templeName: z.string(),
          expectedArrival: z.coerce.date().optional(),
        }),
      )
      .min(2, 'A route needs at least an origin and a destination'),
  }),
});

export const updateRouteSchema = z.object({ body: createRouteSchema.shape.body.partial() });

export const startJourneySchema = z.object({ body: z.object({ routeId: z.string().min(1) }) });

export const journeyEventSchema = z.object({
  body: z.object({
    type: z.enum(['DEPARTURE', 'ARRIVAL', 'DELAY', 'MANUAL_UPDATE']),
    templeId: z.string().optional(),
    note: z.string().optional(),
  }),
});

export const liveMapQuerySchema = z.object({
  query: z.object({
    templeId: z.string().optional(),
    routeId: z.string().optional(),
    status: z.enum(['MOVING', 'IDLE', 'OFFLINE']).optional(),
  }),
});
