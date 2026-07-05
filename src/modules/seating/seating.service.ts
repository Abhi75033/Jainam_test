import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { redis } from '@/config/redis';
import { ApiError } from '@/utils/ApiError';
import { getQueue, QUEUE_NAMES } from '@/jobs/queues';

const SEAT_LOCK_TTL_SECONDS = 8 * 60; // checkout window for a locked seat

const seatLockKey = (seatId: string) => `seatlock:${seatId}`;

/**
 * Seating engine (§5.9): Mode 1 Open (FCFS, no seat rows needed) or Mode 2
 * Reserved (BookMyShow-style Sections -> Rows -> Seats with Redis TTL locks
 * during checkout).
 */

export async function createSeatingLayout(eventId: string, sections: { name: string; mode: 'OPEN' | 'RESERVED'; rows: { name: string; seats: string[] }[] }[]) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.deletedAt) throw ApiError.notFound('Event not found');

  return prisma.$transaction(async (tx) => {
    const created = [];
    for (const section of sections) {
      const sectionRow = await tx.seatingSection.create({ data: { eventId, name: section.name, mode: section.mode } });
      for (const row of section.rows) {
        const rowRecord = await tx.seatingRow.create({ data: { sectionId: sectionRow.id, name: row.name } });
        await tx.seat.createMany({ data: row.seats.map((label) => ({ rowId: rowRecord.id, label })) });
      }
      created.push(sectionRow);
    }
    return created;
  });
}

export async function getSeatMap(eventId: string) {
  return prisma.seatingSection.findMany({
    where: { eventId },
    include: { rows: { include: { seats: { orderBy: { label: 'asc' } } } } },
  });
}

/**
 * Lock a seat during checkout. Redis SET NX EX gives an atomic TTL lock; the
 * DB row mirrors it for seat-map display. A delayed job releases the DB state
 * if the lock expires without purchase.
 */
export async function lockSeat(seatId: string, checkoutSessionId: string): Promise<{ lockToken: string; expiresInSeconds: number }> {
  const seat = await prisma.seat.findUnique({ where: { id: seatId } });
  if (!seat) throw ApiError.notFound('Seat not found');
  if (seat.status === 'BOOKED' || seat.status === 'UNAVAILABLE') throw ApiError.conflict(`Seat ${seat.label} is not available`);

  const lockToken = `${checkoutSessionId}:${crypto.randomBytes(8).toString('hex')}`;
  const acquired = await redis.set(seatLockKey(seatId), lockToken, 'EX', SEAT_LOCK_TTL_SECONDS, 'NX');
  if (!acquired) throw ApiError.conflict(`Seat ${seat.label} is currently held by another buyer`);

  await prisma.seat.update({
    where: { id: seatId },
    data: { status: 'LOCKED', lockToken, lockExpiresAt: new Date(Date.now() + SEAT_LOCK_TTL_SECONDS * 1000) },
  });

  await getQueue(QUEUE_NAMES.SEAT_LOCK_RELEASE).add(
    'release',
    { seatId, lockToken },
    { delay: (SEAT_LOCK_TTL_SECONDS + 5) * 1000 },
  );

  return { lockToken, expiresInSeconds: SEAT_LOCK_TTL_SECONDS };
}

export async function releaseSeat(seatId: string, lockToken: string) {
  const current = await redis.get(seatLockKey(seatId));
  if (current !== lockToken) return; // lock changed hands or already released
  await redis.del(seatLockKey(seatId));
  await prisma.seat.updateMany({
    where: { id: seatId, lockToken, status: 'LOCKED' },
    data: { status: 'AVAILABLE', lockToken: null, lockExpiresAt: null },
  });
}

/** Called by the seat-lock-release queue when a TTL lapses without purchase. */
export async function releaseExpiredSeatLock(seatId: string, lockToken: string) {
  const stillLocked = await redis.get(seatLockKey(seatId));
  if (stillLocked === lockToken) {
    await redis.del(seatLockKey(seatId));
  }
  await prisma.seat.updateMany({
    where: { id: seatId, lockToken, status: 'LOCKED' },
    data: { status: 'AVAILABLE', lockToken: null, lockExpiresAt: null },
  });
}

/**
 * Converts a lock into a confirmed booking during ticket purchase. The caller
 * passes the checkout session (idempotency key) — the seat's lock token must
 * have been issued for the same session.
 */
export async function confirmSeatBooking(seatId: string, checkoutSessionId: string, tx: Prisma.TransactionClient) {
  const seat = await tx.seat.findUnique({ where: { id: seatId } });
  if (!seat) throw ApiError.notFound('Seat not found');
  if (seat.status === 'BOOKED') throw ApiError.conflict(`Seat ${seat.label} is already booked`);
  if (seat.status !== 'LOCKED' || !seat.lockToken?.startsWith(`${checkoutSessionId}:`)) {
    throw ApiError.conflict(`Seat ${seat.label} is not locked by this checkout session — lock it first`);
  }

  await tx.seat.update({ where: { id: seatId }, data: { status: 'BOOKED', lockToken: null, lockExpiresAt: null } });
  await redis.del(seatLockKey(seatId));
}
