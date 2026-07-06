/**
 * DoD flow (§10): paid event -> seat lock -> ticket -> QR scan -> duplicate rejection.
 * Requires live Postgres + Redis: RUN_INTEGRATION=1 npm test
 */
import request from 'supertest';

const RUN = process.env.RUN_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

d('Paid event + ticketing flow (§5.9)', () => {
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

  it('temple admin is blocked from creating a paid event (support-ticket message)', async () => {
    const org = await helpers.createOrgFixture('TEMPLE');
    const admin = await helpers.createActor('TEMPLE_ADMIN', [org.id]);

    const res = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        organizationId: org.id,
        title: 'Paid Satsang',
        startAt: new Date(Date.now() + 5 * 24 * 3600_000).toISOString(),
        endAt: new Date(Date.now() + 5 * 24 * 3600_000 + 4 * 3600_000).toISOString(),
        isPaid: true,
      });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('support ticket');
  });

  it('runs seat lock -> purchase (idempotent) -> scan -> duplicate scan rejected with first-scan info', async () => {
    const org = await helpers.createOrgFixture('TEMPLE');
    const superAdmin = await helpers.createSuperAdmin();
    const buyer = await helpers.createActor('MEMBER');
    const scanner = await helpers.createActor('EVENT_SCANNER');

    // Super Admin creates the paid event (starts within the 24h scan window)
    const eventRes = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({
        organizationId: org.id,
        title: 'Grand Paid Event',
        startAt: new Date(Date.now() + 12 * 3600_000).toISOString(),
        endAt: new Date(Date.now() + 20 * 3600_000).toISOString(),
        isPaid: true,
      });
    expect(eventRes.status).toBe(201);
    const eventId = eventRes.body.data.id;

    await request(app)
      .post(`/api/v1/events/${eventId}/transition`)
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ status: 'PUBLISHED' })
      .expect(200);

    // Ticket category + reserved seating layout
    const categoryRes = await request(app)
      .post(`/api/v1/tickets/events/${eventId}/categories`)
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ name: 'VIP', price: 500, capacity: 10 });
    expect(categoryRes.status).toBe(201);
    const ticketCategoryId = categoryRes.body.data.id;

    const layoutRes = await request(app)
      .post(`/api/v1/seating/events/${eventId}/layout`)
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ sections: [{ name: 'Front', mode: 'RESERVED', rows: [{ name: 'A', seats: ['A1', 'A2', 'A3'] }] }] });
    expect(layoutRes.status).toBe(201);

    const seatMap = await request(app).get(`/api/v1/seating/events/${eventId}/seat-map`).set('Authorization', `Bearer ${buyer.token}`);
    const seatId = seatMap.body.data[0].rows[0].seats[0].id;

    // Lock the seat during checkout (Redis TTL)
    const checkoutSessionId = `checkout-${Date.now()}`;
    const lockRes = await request(app)
      .post(`/api/v1/seating/seats/${seatId}/lock`)
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ checkoutSessionId });
    expect(lockRes.status).toBe(200);

    // Second buyer cannot lock the same seat
    const otherBuyer = await helpers.createActor('MEMBER');
    const conflictRes = await request(app)
      .post(`/api/v1/seating/seats/${seatId}/lock`)
      .set('Authorization', `Bearer ${otherBuyer.token}`)
      .send({ checkoutSessionId: 'someone-else' });
    expect(conflictRes.status).toBe(409);

    // Purchase with idempotency key
    const purchaseRes = await request(app)
      .post(`/api/v1/tickets/events/${eventId}/purchase`)
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({
        ticketCategoryId,
        attendees: [{ memberPublicId: buyer.member.publicId, seatId }],
        paymentRef: 'PAY-123',
        idempotencyKey: checkoutSessionId,
      });
    expect(purchaseRes.status).toBe(201);
    const ticket = purchaseRes.body.data[0];
    expect(ticket.status).toBe('TICKET_GENERATED');
    expect(ticket.qrToken).toBeTruthy();

    // Idempotent replay returns the same tickets, no duplicates
    const replayRes = await request(app)
      .post(`/api/v1/tickets/events/${eventId}/purchase`)
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({
        ticketCategoryId,
        attendees: [{ memberPublicId: buyer.member.publicId, seatId }],
        paymentRef: 'PAY-123',
        idempotencyKey: checkoutSessionId,
      });
    expect(replayRes.status).toBe(201);
    const ticketCount = await helpers.prismaTest.ticket.count({ where: { bookingGroupId: checkoutSessionId } });
    expect(ticketCount).toBe(1);

    // Scanner checks in the ticket (within the 24h-before window)
    const scanRes = await request(app)
      .post('/api/v1/tickets/scan')
      .set('Authorization', `Bearer ${scanner.token}`)
      .send({ qrToken: ticket.qrToken, gate: 'Gate 1' });
    expect(scanRes.status).toBe(200);
    expect(scanRes.body.data.status).toBe('CHECKED_IN');
    expect(scanRes.body.data.memberPublicId).toBe(buyer.member.publicId);

    // Duplicate scan -> "Ticket Already Used" with first scan info
    const dupRes = await request(app)
      .post('/api/v1/tickets/scan')
      .set('Authorization', `Bearer ${scanner.token}`)
      .send({ qrToken: ticket.qrToken, gate: 'Gate 2' });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.message).toContain('Ticket Already Used');
  });
});
