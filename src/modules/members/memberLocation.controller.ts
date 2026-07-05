import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { ApiError } from '@/utils/ApiError';
import { prisma } from '@/config/prisma';
import { redis } from '@/config/redis';
import { enqueueNotification } from '@/engines/notification/notification.service';

const GEOFENCE_RADIUS_KM = 5;
const GEOFENCE_DEDUPE_TTL_SECONDS = 6 * 3600; // don't re-notify for the same temple within 6h

/**
 * Member location ping (§4.3 geofence): stores current GPS on the member
 * profile (drives nearby temples/events/offers) and pushes a notification
 * when the member enters a 5 km radius of any temple, deduped via Redis.
 */
export const locationPing = asyncHandler(async (req: Request, res: Response) => {
  const member = await prisma.member.findUnique({ where: { userId: req.actor!.userId } });
  if (!member) throw ApiError.notFound('Member profile not found');

  const { lat, lng } = req.body as { lat: number; lng: number };

  await prisma.member.update({ where: { id: member.id }, data: { currentLat: lat, currentLng: lng } });

  const nearbyTemples = await prisma.$queryRaw<{ id: string; name: string }[]>(Prisma.sql`
    SELECT "id", "name" FROM "organizations"
    WHERE "type" = 'TEMPLE' AND "deletedAt" IS NULL AND "lat" IS NOT NULL AND "lng" IS NOT NULL
    AND (6371 * acos(
      cos(radians(${lat})) * cos(radians("lat")) *
      cos(radians("lng") - radians(${lng})) +
      sin(radians(${lat})) * sin(radians("lat"))
    )) <= ${GEOFENCE_RADIUS_KM}
    LIMIT 10
  `);

  const notified: string[] = [];
  for (const temple of nearbyTemples) {
    const dedupeKey = `geofence:${member.id}:${temple.id}`;
    const alreadyNotified = await redis.set(dedupeKey, '1', 'EX', GEOFENCE_DEDUPE_TTL_SECONDS, 'NX');
    if (alreadyNotified) {
      await enqueueNotification({
        userId: member.userId,
        templateKey: 'GEOFENCE_TEMPLE_NEARBY',
        category: 'SERVICE',
        to: { PUSH: member.userId },
        body: `${temple.name} is within ${GEOFENCE_RADIUS_KM} km of you — Jai Jinendra! Tap for darshan timings.`,
        data: { templeId: temple.id },
      });
      notified.push(temple.name);
    }
  }

  return ok(res, { updated: true, nearbyTemples: nearbyTemples.map((t) => t.name), notified });
});
