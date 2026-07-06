/**
 * DoD flow (§10): visitor offline sync idempotency + vehicle duplicate prevention.
 * Requires live Postgres + Redis: RUN_INTEGRATION=1 npm test
 */
import request from 'supertest';
import crypto from 'crypto';

const RUN = process.env.RUN_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

d('Visitor offline sync (§5.11)', () => {
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

  it('replaying the same idempotency keys never creates duplicate entries', async () => {
    const org = await helpers.createOrgFixture('TEMPLE');
    const guard = await helpers.createActor('SECURITY_GUARD', [org.id]);

    const keyA = crypto.randomUUID();
    const keyB = crypto.randomUUID();
    const entries = [
      { organizationId: org.id, entryType: 'NON_MEMBER', visitorName: 'Offline Visitor A', visitorMobile: '+919876500001', purpose: 'Darshan', idempotencyKey: keyA },
      { organizationId: org.id, entryType: 'NON_MEMBER', visitorName: 'Offline Visitor B', visitorMobile: '+919876500002', purpose: 'Darshan', idempotencyKey: keyB },
    ];

    const firstSync = await request(app).post('/api/v1/visitors/sync').set('Authorization', `Bearer ${guard.token}`).send({ entries });
    expect(firstSync.status).toBe(200);
    expect(firstSync.body.data.every((r: any) => r.success)).toBe(true);
    expect(firstSync.body.data.filter((r: any) => r.replayed).length).toBe(0);

    // Device reconnects and re-sends the same batch
    const secondSync = await request(app).post('/api/v1/visitors/sync').set('Authorization', `Bearer ${guard.token}`).send({ entries });
    expect(secondSync.status).toBe(200);
    expect(secondSync.body.data.every((r: any) => r.success && r.replayed)).toBe(true);

    const count = await helpers.prismaTest.visitorEntry.count({ where: { idempotencyKey: { in: [keyA, keyB] } } });
    expect(count).toBe(2); // not 4
  });

  it('prevents a second active entry for the same vehicle at the same location', async () => {
    const org = await helpers.createOrgFixture('TEMPLE');
    const guard = await helpers.createActor('SECURITY_GUARD', [org.id]);
    const vehicleNumber = `GJ01${crypto.randomInt(1000, 9999)}`;

    const first = await request(app)
      .post('/api/v1/visitors/check-in')
      .set('Authorization', `Bearer ${guard.token}`)
      .send({ organizationId: org.id, entryType: 'VEHICLE', vehicleNumber, idempotencyKey: crypto.randomUUID() });
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post('/api/v1/visitors/check-in')
      .set('Authorization', `Bearer ${guard.token}`)
      .send({ organizationId: org.id, entryType: 'VEHICLE', vehicleNumber, idempotencyKey: crypto.randomUUID() });
    expect(duplicate.status).toBe(409);

    // After checkout, the vehicle can enter again
    await request(app).post(`/api/v1/visitors/check-out/${first.body.data.publicId}`).set('Authorization', `Bearer ${guard.token}`).expect(200);
    const reentry = await request(app)
      .post('/api/v1/visitors/check-in')
      .set('Authorization', `Bearer ${guard.token}`)
      .send({ organizationId: org.id, entryType: 'VEHICLE', vehicleNumber, idempotencyKey: crypto.randomUUID() });
    expect(reentry.status).toBe(201);
  });

  it('guard member-lookup returns only name/photo/ID — never confidential fields', async () => {
    const org = await helpers.createOrgFixture('TEMPLE');
    const guard = await helpers.createActor('SECURITY_GUARD', [org.id]);
    const member = await helpers.createActor('MEMBER');

    const res = await request(app).get(`/api/v1/visitors/member-lookup?q=${member.member.publicId}`).set('Authorization', `Bearer ${guard.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({ publicId: member.member.publicId, fullName: member.member.fullName }),
    );
    expect(res.body.data.mobile).toBeUndefined();
    expect(res.body.data.aadhaarEncrypted).toBeUndefined();
    expect(res.body.data.medicalNotes).toBeUndefined();
  });
});
