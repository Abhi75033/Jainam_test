import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ID_PREFIXES, ID_SEQUENCE_START, IdPrefixKey } from '@/config/constants';

type TxClient = Prisma.TransactionClient | PrismaClient;

/**
 * Unique ID Generation Engine (§4.1).
 *
 * Every public-facing entity ID is system-generated, sequential, immutable,
 * and never reused. Backed by `id_sequences` + `SELECT ... FOR UPDATE` so
 * concurrent creates never produce duplicates or gaps from reuse.
 *
 * IMPORTANT: call `nextPublicId` from WITHIN the same Prisma transaction that
 * creates the owning record, so a rolled-back create does not "waste" an ID
 * silently forking the sequence from what's visible in the table (a wasted ID
 * is acceptable per spec — IDs are never reused — but keeping it in the same
 * transaction keeps sequence advancement and record creation atomic).
 */
export async function nextPublicId(entity: IdPrefixKey, tx: TxClient = prisma): Promise<string> {
  const prefix = ID_PREFIXES[entity];

  // Row-level lock via raw SQL FOR UPDATE guarantees serialized increments
  // even under high concurrency (multiple API instances hitting the same prefix).
  const rows = await tx.$queryRaw<{ lastValue: number }[]>(
    Prisma.sql`SELECT "lastValue" FROM "id_sequences" WHERE "prefix" = ${prefix} FOR UPDATE`,
  );

  const existing = rows[0];
  let current: number;
  if (!existing) {
    await tx.$executeRaw(
      Prisma.sql`INSERT INTO "id_sequences" ("prefix", "lastValue") VALUES (${prefix}, ${ID_SEQUENCE_START - 1})`,
    );
    current = ID_SEQUENCE_START - 1;
  } else {
    current = existing.lastValue;
  }

  const next = current + 1;
  await tx.$executeRaw(
    Prisma.sql`UPDATE "id_sequences" SET "lastValue" = ${next} WHERE "prefix" = ${prefix}`,
  );

  return `${prefix}${next}`;
}

/** Convenience wrapper that opens its own transaction (use when not already inside one). */
export async function generatePublicId(entity: IdPrefixKey): Promise<string> {
  return prisma.$transaction((tx) => nextPublicId(entity, tx));
}

export function parsePublicId(publicId: string): { prefix: string; sequence: number } | null {
  const match = publicId.match(/^([A-Z]+?)(\d+)$/);
  if (!match || !match[1] || !match[2]) return null;
  return { prefix: match[1], sequence: Number(match[2]) };
}
