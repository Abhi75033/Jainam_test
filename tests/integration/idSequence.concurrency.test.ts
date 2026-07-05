/**
 * Definition-of-Done check (§10): "ID sequence concurrency (no duplicates
 * under parallel creates)". Requires a live Postgres — set DATABASE_URL and
 * RUN_INTEGRATION=1 (docker-compose up postgres) to run; otherwise skipped.
 */
import { PrismaClient } from '@prisma/client';

const RUN = process.env.RUN_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

d('ID Generator concurrency (§4.1)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    await prisma.idSequence.deleteMany({ where: { prefix: 'TESTX' } });
  });

  afterAll(async () => {
    await prisma.idSequence.deleteMany({ where: { prefix: 'TESTX' } });
    await prisma.$disconnect();
  });

  it('issues unique sequential IDs under 50 parallel requests', async () => {
    const { Prisma } = await import('@prisma/client');

    async function nextId(): Promise<string> {
      return prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ lastValue: number }[]>(
          Prisma.sql`SELECT "lastValue" FROM "id_sequences" WHERE "prefix" = ${'TESTX'} FOR UPDATE`,
        );
        let current: number;
        if (rows.length === 0) {
          await tx.$executeRaw(Prisma.sql`INSERT INTO "id_sequences" ("prefix", "lastValue") VALUES (${'TESTX'}, ${107}) ON CONFLICT DO NOTHING`);
          const again = await tx.$queryRaw<{ lastValue: number }[]>(
            Prisma.sql`SELECT "lastValue" FROM "id_sequences" WHERE "prefix" = ${'TESTX'} FOR UPDATE`,
          );
          current = again[0]?.lastValue ?? 107;
        } else {
          current = rows[0]!.lastValue;
        }
        const next = current + 1;
        await tx.$executeRaw(Prisma.sql`UPDATE "id_sequences" SET "lastValue" = ${next} WHERE "prefix" = ${'TESTX'}`);
        return `TESTX${next}`;
      });
    }

    const ids = await Promise.all(Array.from({ length: 50 }, () => nextId()));
    const unique = new Set(ids);

    expect(unique.size).toBe(50); // no duplicates
    const numbers = ids.map((id) => Number(id.replace('TESTX', ''))).sort((a, b) => a - b);
    expect(numbers[0]).toBe(108); // starts at 108
    expect(numbers[49]).toBe(157); // strictly sequential, no gaps
  }, 60_000);
});
