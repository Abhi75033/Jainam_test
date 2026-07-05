import { z } from 'zod';

export const registerDeviceSchema = z.object({
  body: z.object({
    monkId: z.string().optional(),
    type: z.string().default('GPS_TRACKER'),
  }),
});

export const assignDeviceSchema = z.object({
  body: z.object({ monkId: z.string().min(1) }),
});

export const addSimRecordSchema = z.object({
  body: z.object({
    operator: z.string().optional(),
    msisdn: z.string().optional(),
    validityStart: z.coerce.date().optional(),
    validityExpiry: z.coerce.date().optional(),
  }),
});

/** GPS device ingestion endpoint (§5.10): interval-based location posts. */
export const locationPingSchema = z.object({
  body: z.object({
    deviceId: z.string().min(1),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    battery: z.number().int().min(0).max(100).optional(),
    timestamp: z.coerce.date().optional(),
  }),
});
