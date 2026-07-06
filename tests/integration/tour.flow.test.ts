/**
 * DoD flow (§10): tour jatra counting -> milestone -> certificate;
 * plus registration -> family auto-account.
 * Requires live Postgres + Redis: RUN_INTEGRATION=1 npm test
 */
import request from 'supertest';

const RUN = process.env.RUN_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

d('Tour (99 Management) flow (§5.19)', () => {
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

  it('locks target on first participant, computes cumulative counts, fires milestones, generates certificate at 100%', async () => {
    const org = await helpers.createOrgFixture('TEMPLE');
    const admin = await helpers.createActor('TEMPLE_ADMIN', [org.id]);
    const participant = await helpers.createActor('MEMBER');
    const parent = await helpers.createActor('MEMBER');

    const tourCategory = await helpers.prismaTest.tourCategory.upsert({ where: { name: '99' }, update: {}, create: { name: '99' } });
    const { nextPublicId } = await import('@/engines/idGenerator/id.service');
    const monkPublicId = await helpers.prismaTest.$transaction((tx) => nextPublicId('MONK', tx));
    const monk = await helpers.prismaTest.monkProfile.create({
      data: { publicId: monkPublicId, dikshaName: 'Test Maharaj', gender: 'SADHU' },
    });

    // Create a small-target tour (4 jatras for a fast test)
    const tourRes = await request(app)
      .post('/api/v1/tours')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Test Palitana 99',
        categoryId: tourCategory.id,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 10 * 24 * 3600_000).toISOString(),
        jatraTarget: 4,
        primaryMonkId: monk.id,
      });
    expect(tourRes.status).toBe(201);
    const tourId = tourRes.body.data.id;
    expect(tourRes.body.data.targetLocked).toBe(false);

    // Add participant by Member ID with parent link
    const addRes = await request(app)
      .post(`/api/v1/tours/${tourId}/participants`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ memberPublicId: participant.member.publicId, parentMemberPublicId: parent.member.publicId });
    expect(addRes.status).toBe(201);
    const participantId = addRes.body.data.id;

    // Target locks after first participant (§5.19)
    const tour = await helpers.prismaTest.tour.findUniqueOrThrow({ where: { id: tourId } });
    expect(tour.targetLocked).toBe(true);

    // Non-super-admin cannot change the locked target
    const targetChange = await request(app)
      .patch(`/api/v1/tours/${tourId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ jatraTarget: 108 });
    expect(targetChange.status).toBe(403);

    // Unknown member ID is rejected (participants only by Member ID)
    const badAdd = await request(app)
      .post(`/api/v1/tours/${tourId}/participants`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ memberPublicId: 'JFJM999999' });
    expect(badAdd.status).toBe(404);

    // Daily counts: day1=1 (25%), day2=1 (50%), day3=2 (100%)
    const day = (offset: number) => new Date(Date.now() + offset * 24 * 3600_000).toISOString();
    const count1 = await request(app)
      .post(`/api/v1/tours/participants/${participantId}/jatra-counts`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ date: day(0), count: 1 });
    expect(count1.status).toBe(200);
    expect(count1.body.data.cumulativeCount).toBe(1);
    expect(count1.body.data.progressPct).toBe(25);

    await request(app)
      .post(`/api/v1/tours/participants/${participantId}/jatra-counts`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ date: day(1), count: 1 })
      .expect(200);

    const finalCount = await request(app)
      .post(`/api/v1/tours/participants/${participantId}/jatra-counts`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ date: day(2), count: 2 });
    expect(finalCount.body.data.cumulativeCount).toBe(4);
    expect(finalCount.body.data.progressPct).toBe(100);

    // Milestones 25/50/100 recorded
    const milestones = await helpers.prismaTest.tourMilestone.findMany({ where: { participantId } });
    const pcts = milestones.map((m) => m.milestonePct).sort((a, b) => a - b);
    expect(pcts).toEqual(expect.arrayContaining([25, 50, 100]));

    // Certificate generation (normally via the queue worker; invoked directly here)
    const { generateTourCertificate } = await import('@/modules/tours99/tours99.service');
    await generateTourCertificate(participantId);
    const done = await helpers.prismaTest.tourMilestone.findUnique({
      where: { participantId_milestonePct: { participantId, milestonePct: 100 } },
    });
    expect(done!.certificateUrl).toBeTruthy();
  });
});

d('Member registration -> family auto-account (§5.2)', () => {
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

  it('adding a family member with an unknown mobile auto-creates an Inactive account', async () => {
    const primary = await helpers.createActor('MEMBER');
    const relationship = await helpers.prismaTest.relationshipType.upsert({ where: { name: 'Brother' }, update: {}, create: { name: 'Brother' } });
    const newMobile = helpers.uniqueMobile();

    const res = await request(app)
      .post('/api/v1/family')
      .set('Authorization', `Bearer ${primary.token}`)
      .send({ name: 'Auto Brother', relationshipTypeId: relationship.id, mobile: newMobile, category: 'JAIN' });
    expect(res.status).toBe(201);

    const created = await helpers.prismaTest.member.findUnique({ where: { mobile: newMobile } });
    expect(created).not.toBeNull();
    expect(created!.status).toBe('INACTIVE');
    expect(created!.isAutoCreated).toBe(true);
    expect(created!.publicId).toMatch(/^JFJM\d+$/);

    // Duplicate link is rejected
    const dup = await request(app)
      .post('/api/v1/family')
      .set('Authorization', `Bearer ${primary.token}`)
      .send({ name: 'Auto Brother', relationshipTypeId: relationship.id, mobile: newMobile, category: 'JAIN' });
    expect(dup.status).toBe(409);
  });
});
