/**
 * DoD flow (§10): manual donation -> category split validation -> receipt.
 * Requires live Postgres + Redis: RUN_INTEGRATION=1 npm test
 */
import request from 'supertest';

const RUN = process.env.RUN_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

d('Donation flow (§5.8)', () => {
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

  it('rejects splits that do not sum to the total (422), accepts valid ones, verifies with receipt', async () => {
    const org = await helpers.createOrgFixture('TEMPLE');
    const admin = await helpers.createActor('TEMPLE_ADMIN', [org.id]);
    const member = await helpers.createActor('MEMBER');

    const catGeneral = await helpers.prismaTest.donationCategory.upsert({ where: { name: 'General' }, update: {}, create: { name: 'General' } });
    const catGauSeva = await helpers.prismaTest.donationCategory.upsert({ where: { name: 'Gau Seva' }, update: {}, create: { name: 'Gau Seva' } });

    // Bad split: 600 + 300 != 1000
    const badRes = await request(app)
      .post('/api/v1/donations/manual')
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        organizationId: org.id,
        totalAmount: 1000,
        transactionReference: 'UTR-BAD',
        proofUrl: 'http://x/proof.png',
        categorySplits: [
          { donationCategoryId: catGeneral.id, amount: 600 },
          { donationCategoryId: catGauSeva.id, amount: 300 },
        ],
      });
    expect(badRes.status).toBe(422);

    // Good split
    const goodRes = await request(app)
      .post('/api/v1/donations/manual')
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        organizationId: org.id,
        totalAmount: 1000,
        transactionReference: 'UTR-GOOD',
        proofUrl: 'http://x/proof.png',
        categorySplits: [
          { donationCategoryId: catGeneral.id, amount: 600 },
          { donationCategoryId: catGauSeva.id, amount: 400 },
        ],
      });
    expect(goodRes.status).toBe(201);
    expect(goodRes.body.data.status).toBe('PENDING');
    const donationId = goodRes.body.data.id;

    // Admin verifies -> receipt auto-issued
    const verifyRes = await request(app)
      .post(`/api/v1/donations/${donationId}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ decision: 'VERIFY' });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.status).toBe('VERIFIED');

    const receipt = await helpers.prismaTest.receipt.findUnique({ where: { donationId } });
    expect(receipt).not.toBeNull();
    expect(receipt!.type).toBe('DONATION');
  });

  it('admin donor-lookup auto-fills details from a member public ID', async () => {
    const org = await helpers.createOrgFixture('TEMPLE');
    const admin = await helpers.createActor('TEMPLE_ADMIN', [org.id]);
    const donor = await helpers.createActor('MEMBER');

    const lookupRes = await request(app)
      .get(`/api/v1/donations/donor-lookup?memberPublicId=${donor.member.publicId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(lookupRes.status).toBe(200);
    expect(lookupRes.body.data.fullName).toBe(donor.member.fullName);
    expect(lookupRes.body.data.mobile).toBe(donor.mobile);
  });
});
