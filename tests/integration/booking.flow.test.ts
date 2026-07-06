/**
 * DoD flow (§10): booking -> payment window -> verify -> receipt.
 * Requires live Postgres + Redis: RUN_INTEGRATION=1 npm test
 */
import request from 'supertest';

const RUN = process.env.RUN_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

d('Booking flow (§5.7)', () => {
  jest.setTimeout(60_000);
  let app: import('express').Express;
  let helpers: typeof import('./helpers');

  beforeAll(async () => {
    helpers = await import('./helpers');
    const { createApp } = await import('@/app');
    app = createApp();
  });

  afterAll(async () => {
    await helpers.prismaTest.$disconnect();
  });

  it('runs submit -> approve -> payment proof -> verify -> CONFIRMED with receipt', async () => {
    const org = await helpers.createOrgFixture('TEMPLE');
    const admin = await helpers.createActor('TEMPLE_ADMIN', [org.id]);
    const member = await helpers.createActor('MEMBER');

    // Admin configures a paid booking item
    const category = await helpers.prismaTest.bookingCategory.upsert({
      where: { name: 'Test Hall' },
      update: {},
      create: { name: 'Test Hall' },
    });
    const itemRes = await request(app)
      .post('/api/v1/bookings/items')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        organizationId: org.id,
        name: 'Community Hall',
        categoryId: category.id,
        type: 'PAID',
        durationType: 'FULL_DAY',
        chargeAmount: 5000,
        paymentWindowHours: 2,
        capacityMaxBookings: 1,
      });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id;

    // Member submits a booking
    const dateFrom = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
    const submitRes = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ bookingItemId: itemId, dateFrom, peopleCount: 2 });
    expect(submitRes.status).toBe(201);
    expect(submitRes.body.data.status).toBe('PENDING_APPROVAL');
    const bookingId = submitRes.body.data.id;

    // Admin approves -> payment window starts
    const approveRes = await request(app)
      .post(`/api/v1/bookings/${bookingId}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ decision: 'APPROVE' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('PAYMENT_PENDING');
    expect(approveRes.body.data.paymentWindowExpiresAt).toBeTruthy();

    // Member submits payment proof (idempotent)
    const idempotencyKey = `test-${bookingId}`;
    const proofRes = await request(app)
      .post(`/api/v1/bookings/${bookingId}/payment-proof`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ paymentReference: 'UTR123456', paymentProofUrl: 'http://x/proof.png', idempotencyKey });
    expect(proofRes.status).toBe(200);
    expect(proofRes.body.data.status).toBe('PAYMENT_VERIFICATION');

    // Replay with same idempotency key returns the same booking, no state change
    const replayRes = await request(app)
      .post(`/api/v1/bookings/${bookingId}/payment-proof`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ paymentReference: 'UTR123456', paymentProofUrl: 'http://x/proof.png', idempotencyKey });
    expect(replayRes.status).toBe(200);

    // Admin verifies payment -> CONFIRMED + receipt
    const verifyRes = await request(app)
      .post(`/api/v1/bookings/${bookingId}/payment-verification`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ decision: 'APPROVE' });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.status).toBe('CONFIRMED');

    const receipt = await helpers.prismaTest.receipt.findUnique({ where: { bookingId } });
    expect(receipt).not.toBeNull();
    expect(receipt!.type).toBe('BOOKING');
    expect(receipt!.pdfUrl).toBeTruthy();

    // Status timeline is complete
    const history = await helpers.prismaTest.bookingStatusHistory.findMany({ where: { bookingId }, orderBy: { changedAt: 'asc' } });
    const statuses = history.map((h) => h.status);
    expect(statuses).toEqual(expect.arrayContaining(['SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'PAYMENT_PENDING', 'PAYMENT_VERIFICATION', 'CONFIRMED']));
  });

  it('tenant isolation: another temple admin cannot decide this org\'s booking', async () => {
    const orgA = await helpers.createOrgFixture('TEMPLE');
    const orgB = await helpers.createOrgFixture('TEMPLE');
    const adminB = await helpers.createActor('TEMPLE_ADMIN', [orgB.id]);
    const member = await helpers.createActor('MEMBER');

    const category = await helpers.prismaTest.bookingCategory.upsert({ where: { name: 'Test Hall' }, update: {}, create: { name: 'Test Hall' } });
    const item = await helpers.prismaTest.bookingItem.create({
      data: { organizationId: orgA.id, name: 'Hall A', categoryId: category.id, type: 'FREE', durationType: 'FULL_DAY' },
    });

    const submitRes = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ bookingItemId: item.id, dateFrom: new Date(Date.now() + 3 * 24 * 3600_000).toISOString(), peopleCount: 1 });
    expect(submitRes.status).toBe(201);

    // Admin B (different org) tries to list org A's bookings -> tenant scope violation
    const listRes = await request(app).get(`/api/v1/bookings/org/${orgA.id}`).set('Authorization', `Bearer ${adminB.token}`);
    expect(listRes.status).toBe(403);
  });
});
