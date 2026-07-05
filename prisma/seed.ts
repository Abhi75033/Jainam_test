import 'dotenv/config';
import { PrismaClient, PermissionAction, RoleKey } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { nextPublicId } from '../src/engines/idGenerator/id.service';

const prisma = new PrismaClient();

// -----------------------------------------------------------------------------
// 1. Roles + default permission matrix (§3)
// -----------------------------------------------------------------------------

const ROLE_DEFINITIONS: { key: RoleKey; name: string; description: string }[] = [
  { key: 'SUPER_ADMIN', name: 'Super Admin', description: 'Platform owner — full cross-tenant access, sole owner of DELETE and paid-event/ads/master-data management.' },
  { key: 'TEMPLE_ADMIN', name: 'Temple Admin', description: 'Scoped admin for one or more Temples/Derasar.' },
  { key: 'DHARAMSHALA_ADMIN', name: 'Dharamshala Admin', description: 'Scoped admin for one or more Dharamshalas.' },
  { key: 'JAIN_CENTER_ADMIN', name: 'Jain Center Admin', description: 'Scoped admin for one or more Jain Centers.' },
  { key: 'MONK_ADMIN', name: 'Monk Admin', description: 'Manages shared monk profiles collaboratively.' },
  { key: 'STAFF', name: 'Staff', description: 'Org staff with module-level permissions assigned by their admin.' },
  { key: 'SECURITY_GUARD', name: 'Security Guard', description: 'Visitor check-in/out app role — no access to confidential member data.' },
  { key: 'EVENT_SCANNER', name: 'Event Scanner', description: 'QR ticket scanning only — no edits/reports/payments/member details.' },
  { key: 'PAGE_OWNER', name: 'Page Owner', description: 'Manages one Community Page assigned by Super Admin.' },
  { key: 'MEMBER', name: 'Jain Member', description: 'Registered Jain community member.' },
  { key: 'NON_JAIN_MEMBER', name: 'Non-Jain Member', description: 'Registered non-Jain member with restricted capabilities.' },
];

const ALL_MODULES = [
  'MEMBERS', 'FAMILY', 'MONKS', 'TEMPLES', 'DHARAMSHALAS', 'JAIN_CENTERS', 'STAFF', 'VISITORS',
  'BOOKINGS', 'DONATIONS', 'EVENTS', 'EVENTS_PAID', 'TICKETS', 'SEATING', 'TOURS', 'FEED', 'OFFERS',
  'ADS', 'NEWS', 'COMMUNITY_PAGES', 'POLLS', 'CALENDAR', 'COUNTERS', 'TRACKING', 'DEVICES', 'ALERTS',
  'COMMUNICATION', 'ANNOUNCEMENTS', 'GALLERY', 'VOLUNTEERS', 'SUPPORT_TICKETS', 'NOTIFICATIONS',
  'REPORTS', 'SETTINGS', 'AUDIT_LOGS', 'DASHBOARD', 'MASTER_DATA',
];

const ALL_ACTIONS: PermissionAction[] = ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'REJECT', 'DELETE'];

/** Default role -> module -> allowed actions matrix (§3 permission matrix highlights). DELETE is never granted here — enforced separately as Super-Admin-only regardless. */
function defaultMatrixFor(role: RoleKey): Record<string, PermissionAction[]> {
  const orgAdminBase: Record<string, PermissionAction[]> = {
    MEMBERS: ['VIEW', 'CREATE'], // §3: admins can add + view members, never edit/delete
    FAMILY: ['VIEW'],
    MONKS: ['VIEW', 'CREATE', 'EDIT'], // shared profiles, collaborative edit
    STAFF: ['VIEW', 'CREATE', 'EDIT'],
    VISITORS: ['VIEW', 'CREATE', 'EDIT'],
    BOOKINGS: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'REJECT'],
    DONATIONS: ['VIEW', 'APPROVE', 'REJECT'],
    EVENTS: ['VIEW', 'CREATE', 'EDIT'], // free events only; paid gated separately
    TICKETS: ['VIEW'],
    SEATING: ['VIEW', 'CREATE', 'EDIT'],
    TOURS: ['VIEW', 'CREATE', 'EDIT'],
    FEED: ['VIEW', 'CREATE', 'EDIT'],
    OFFERS: ['VIEW'],
    NEWS: ['VIEW', 'CREATE', 'EDIT'], // own org news only
    POLLS: ['VIEW', 'CREATE'],
    CALENDAR: ['VIEW'],
    COUNTERS: ['VIEW'],
    TRACKING: ['VIEW', 'CREATE', 'EDIT'],
    DEVICES: ['VIEW', 'CREATE', 'EDIT'],
    ALERTS: ['VIEW'],
    COMMUNICATION: ['VIEW', 'CREATE'],
    ANNOUNCEMENTS: ['VIEW', 'CREATE'],
    GALLERY: ['VIEW', 'CREATE', 'EDIT'],
    VOLUNTEERS: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'REJECT'],
    SUPPORT_TICKETS: ['VIEW', 'CREATE'],
    NOTIFICATIONS: ['VIEW'],
    REPORTS: ['VIEW'],
    AUDIT_LOGS: ['VIEW'], // limited to own org, enforced in service layer
    DASHBOARD: ['VIEW'],
  };

  switch (role) {
    case 'SUPER_ADMIN': {
      const all: Record<string, PermissionAction[]> = {};
      for (const m of ALL_MODULES) all[m] = [...ALL_ACTIONS];
      return all;
    }
    case 'TEMPLE_ADMIN':
    case 'JAIN_CENTER_ADMIN':
      return { ...orgAdminBase, TEMPLES: ['VIEW', 'EDIT'], JAIN_CENTERS: ['VIEW', 'EDIT'] };
    case 'DHARAMSHALA_ADMIN':
      return { ...orgAdminBase, DHARAMSHALAS: ['VIEW', 'EDIT'] };
    case 'MONK_ADMIN':
      return { MONKS: ['VIEW', 'CREATE', 'EDIT'], TRACKING: ['VIEW', 'CREATE', 'EDIT'], TOURS: ['VIEW', 'CREATE', 'EDIT'] };
    case 'STAFF':
      return {}; // module list is fully driven by StaffModulePermission, not role defaults
    case 'SECURITY_GUARD':
      return { VISITORS: ['VIEW', 'CREATE', 'EDIT'] };
    case 'EVENT_SCANNER':
      return { TICKETS: ['VIEW', 'EDIT'] }; // scan+check-in only, enforced narrowly in service
    case 'PAGE_OWNER':
      return { COMMUNITY_PAGES: ['VIEW', 'EDIT'], FEED: ['VIEW', 'CREATE', 'EDIT'], POLLS: ['VIEW', 'CREATE'], GALLERY: ['VIEW', 'CREATE', 'EDIT'] };
    case 'MEMBER':
    case 'NON_JAIN_MEMBER':
      return {
        MEMBERS: ['VIEW', 'EDIT'], // own profile only, enforced in service layer
        BOOKINGS: ['VIEW', 'CREATE'],
        DONATIONS: ['VIEW', 'CREATE'],
        EVENTS: ['VIEW'],
        TICKETS: ['VIEW', 'CREATE'],
        TOURS: ['VIEW'],
        FEED: ['VIEW'],
        OFFERS: ['VIEW'],
        NEWS: ['VIEW'],
        POLLS: ['VIEW', 'CREATE'],
        CALENDAR: ['VIEW'],
        COUNTERS: ['VIEW', 'CREATE', 'EDIT'],
        VOLUNTEERS: ['VIEW', 'CREATE'],
      };
    default:
      return {};
  }
}

async function seedRolesAndPermissions() {
  for (const def of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { key: def.key },
      update: { name: def.name, description: def.description },
      create: { key: def.key, name: def.name, description: def.description },
    });

    const matrix = defaultMatrixFor(def.key);
    for (const [module, actions] of Object.entries(matrix)) {
      for (const action of actions) {
        await prisma.rolePermission.upsert({
          where: { roleId_module_action: { roleId: role.id, module, action } },
          update: { allowed: true },
          create: { roleId: role.id, module, action, allowed: true },
        });
      }
    }
  }
  console.log(`Seeded ${ROLE_DEFINITIONS.length} roles + permission matrices`);
}

// -----------------------------------------------------------------------------
// 2. Master data (§4.8)
// -----------------------------------------------------------------------------

async function upsertByName<T extends { name: string }>(
  model: { upsert: (args: any) => Promise<any> },
  items: string[],
): Promise<Record<string, string>> {
  const idsByName: Record<string, string> = {};
  for (const name of items) {
    const row = await model.upsert({ where: { name }, update: {}, create: { name } });
    idsByName[name] = row.id;
  }
  return idsByName;
}

const KNOWN_GACCHAS = [
  'Tapa Gaccha', 'Kharatara Gaccha', 'Anchal Gaccha', 'Agamik Gaccha', 'Parshwachandra Gaccha',
  'Sardapurnimiya Gaccha', 'Vimal Gaccha', 'Sagar Gaccha', 'Pipplak Gaccha', 'Nagori Tapa Gaccha',
  'Lonka Gaccha', 'Upkeshiya Gaccha', 'Chitod Gaccha', 'Bruhad Tapa Gaccha', 'Ancal Gaccha',
  'Kaduaa Gaccha', 'Purnima Gaccha', 'Sardhapurnimika Gaccha', 'Rudrapalliya Gaccha', 'Vadhamana Gaccha',
];

/** NOTE (DECISIONS.md D-003): the canonical 83-item Gaccha list wasn't provided in the source
 * spec, so known Gaccha names are seeded and padded to exactly 83 with clearly-labeled
 * placeholders. All Gaccha rows are Super-Admin editable master data — nothing here is hardcoded
 * into application logic; it only affects what this seed run inserts as *starting* data. */
function buildGacchaList(): string[] {
  const list = [...KNOWN_GACCHAS];
  let i = list.length + 1;
  while (list.length < 83) {
    list.push(`Gaccha ${i}`);
    i += 1;
  }
  return list;
}

const TIRTHANKARAS = [
  'Rushabhdev', 'Ajitnath', 'Sambhavnath', 'Abhinandan Swami', 'Sumatinath', 'Padmaprabhu',
  'Suparshvanath', 'Chandraprabhu', 'Suvidhinath', 'Shitalnath', 'Shreyansanath', 'Vasupujya',
  'Vimalnath', 'Anantnath', 'Dharmanath', 'Kunthunath', 'Aranath', 'Mallinath',
  'Munisuvrat Swami', 'Naminath', 'Neminath', 'Parshvanath', 'Mahavir Swami',
];

async function seedMasterData() {
  const digambar = await prisma.community.upsert({ where: { name: 'Digambar' }, update: {}, create: { name: 'Digambar' } });
  const shwetambar = await prisma.community.upsert({ where: { name: 'Shwetambar' }, update: {}, create: { name: 'Shwetambar' } });

  const subCommunitySeeds: { communityId: string; name: string }[] = [
    { communityId: shwetambar.id, name: 'Murtipujak' },
    { communityId: shwetambar.id, name: 'Sthanakvasi' },
    { communityId: shwetambar.id, name: 'Terapanthi (Shwetambar)' },
    { communityId: digambar.id, name: 'Bispanthi' },
    { communityId: digambar.id, name: 'Terapanthi (Digambar)' },
    { communityId: digambar.id, name: 'Taranpanthi' },
  ];
  const subCommunityIds: string[] = [];
  for (const s of subCommunitySeeds) {
    const row = await prisma.subCommunity.upsert({
      where: { communityId_name: { communityId: s.communityId, name: s.name } },
      update: {},
      create: s,
    });
    subCommunityIds.push(row.id);
  }

  const gacchaNames = buildGacchaList();
  for (let idx = 0; idx < gacchaNames.length; idx += 1) {
    const subCommunityId = subCommunityIds[idx % subCommunityIds.length]!;
    await prisma.gaccha.upsert({
      where: { subCommunityId_name: { subCommunityId, name: gacchaNames[idx]! } },
      update: {},
      create: { subCommunityId, name: gacchaNames[idx]! },
    });
  }
  console.log(`Seeded 2 communities, ${subCommunitySeeds.length} sub-communities, ${gacchaNames.length} gacchas`);

  await upsertByName(prisma.tithiCalendarType as any, ['Gujarati', 'Kutchi', 'Marwari', 'Hindi', 'Marathi', 'Other']);

  for (const name of TIRTHANKARAS) {
    await prisma.bhagwanMaster.upsert({ where: { name }, update: {}, create: { name } });
  }

  await upsertByName(prisma.bookingCategory as any, [
    'Dharamshala Room', 'Event Hall', 'Temple Hall/Space', 'Pooja', 'Pooja Materials',
    'Bhojanshala', 'Pathshala Hall', 'Seminar/Conference/Meeting Room', 'Locker', 'Parking', 'Other',
  ]);

  await upsertByName(prisma.eventCategory as any, [
    'Satsang', 'Pravachan', 'Pooja/Ritual', 'Utsav/Festival', 'Yatra', 'Cultural', 'Educational', 'Other',
  ]);

  await upsertByName(prisma.feedCategory as any, ['Announcement', 'Update', 'Achievement', 'General']);

  await upsertByName(prisma.offerCategory as any, ['Food', 'Retail', 'Travel', 'Wellness', 'Education', 'Other']);

  await upsertByName(prisma.newsCategory as any, ['Community', 'Temple', 'Platform', 'General']);

  await upsertByName(prisma.communityPageCategory as any, ['Organization', 'Trust', 'Youth Group', 'Mahila Mandal', 'Other']);

  await upsertByName(prisma.sponsorCategory as any, ['Individual', 'Family', 'Trust', 'Corporate']);

  const departments = [
    'Administration', 'Security', 'Housekeeping', 'Kitchen/Bhojanshala', 'Maintenance', 'Accounts',
    'IT', 'Front Office/Reception', 'Priest/Pujari', 'Volunteer Coordination', 'Transport',
    'Gardening', 'Event Management', 'Guest Relations', 'Medical/First Aid', 'Store/Inventory',
  ];
  const deptIds = await upsertByName(prisma.staffDepartment as any, departments);
  for (const [deptName, deptId] of Object.entries(deptIds)) {
    for (const designation of ['Executive', 'Head']) {
      await prisma.staffDesignation.upsert({
        where: { departmentId_name: { departmentId: deptId, name: `${designation} - ${deptName}` } },
        update: {},
        create: { departmentId: deptId, name: `${designation} - ${deptName}` },
      });
    }
  }

  await upsertByName(prisma.volunteerArea as any, [
    'Event Support', 'Bhojanshala Seva', 'Cleanliness', 'Pooja Assistance', 'Transportation',
    'Medical Camp', 'Registration Desk', 'Teaching (Pathshala)',
  ]);

  await upsertByName(prisma.donationCategory as any, [
    'General', 'Gau Seva', 'Jeev Daya', 'Anna Daan', 'Vidya Daan', 'Jinalaya Nirman', 'Sadharmik Bhakti', 'Medical Aid',
  ]);

  await upsertByName(prisma.relationshipType as any, [
    'Father', 'Mother', 'Spouse', 'Son', 'Daughter', 'Brother', 'Sister', 'Grandfather', 'Grandmother',
    'Grandson', 'Granddaughter', 'Father-in-law', 'Mother-in-law', 'Guardian', 'Other',
  ]);

  await upsertByName(prisma.facilityMaster as any, [
    'Parking', 'Wheelchair Access', 'Drinking Water', 'Restrooms', 'Bhojanshala', 'Guest House',
    'Library', 'Medical Room', 'CCTV', 'Wifi', 'AC Hall', 'Sound System',
  ]);

  const counterTypeIds = await upsertByName(prisma.counterType as any, ['Mantra', 'TAP', 'Jatras', 'Jain Visits']);
  const subTypeSeeds: [string, string][] = [
    ['Mantra', 'Navkar Mantra'], ['Mantra', 'Logas'], ['Mantra', 'Uvasaggaharam'],
    ['Jatras', 'Palitana Jatra'], ['Jatras', 'Girnar Jatra'], ['Jatras', 'Sammed Shikharji Jatra'],
    ['Jain Visits', 'Temple Visit'],
  ];
  for (const [typeName, subName] of subTypeSeeds) {
    const counterTypeId = counterTypeIds[typeName]!;
    await prisma.counterSubType.upsert({
      where: { counterTypeId_name: { counterTypeId, name: subName } },
      update: {},
      create: { counterTypeId, name: subName },
    });
  }

  await upsertByName(prisma.tourCategory as any, ['99', 'Palitana', 'Girnar', 'Sammed Shikharji', 'Other']);

  await prisma.alertThreshold.upsert({ where: { type: 'OFFLINE_MINUTES' }, update: {}, create: { type: 'OFFLINE_MINUTES', value: 30 } });
  await prisma.alertThreshold.upsert({ where: { type: 'LOW_BATTERY_PCT' }, update: {}, create: { type: 'LOW_BATTERY_PCT', value: 20 } });
  await prisma.alertThreshold.upsert({ where: { type: 'ROUTE_DELAY_MINUTES' }, update: {}, create: { type: 'ROUTE_DELAY_MINUTES', value: 30 } });

  await prisma.donationCampaignConfig.upsert({
    where: { type: 'PLATFORM_ONLINE' },
    update: {},
    create: { type: 'PLATFORM_ONLINE', message: 'Support the JiNANAM platform — every contribution helps us serve the Jain community better.', isActive: true },
  });
  await prisma.donationCampaignConfig.upsert({
    where: { type: 'MUSIC_FESTIVAL' },
    update: {},
    create: { type: 'MUSIC_FESTIVAL', message: 'Contribute to the Jain Music Festival fund.', isActive: true },
  });

  console.log('Seeded remaining master data (categories, departments, counters, thresholds, donation campaigns)');
}

// -----------------------------------------------------------------------------
// 3. Super Admin
// -----------------------------------------------------------------------------

async function seedSuperAdmin() {
  const mobile = '+919999900000';
  const existing = await prisma.user.findUnique({ where: { mobile } });
  if (existing) {
    console.log('Super Admin already exists, skipping');
    return existing;
  }

  const passwordHash = await bcrypt.hash('ChangeMe@108', 10);
  const user = await prisma.user.create({
    data: {
      mobile,
      mobileVerifiedAt: new Date(),
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      primaryRoleKey: 'SUPER_ADMIN',
      status: 'ACTIVE',
      createdByAdmin: true,
    },
  });
  console.log(`Seeded Super Admin user (mobile: ${mobile}, temp password: ChangeMe@108 — rotate immediately)`);
  return user;
}

// -----------------------------------------------------------------------------
// 4. Demo organizations + members (for local testing / Definition-of-Done scripts)
// -----------------------------------------------------------------------------

async function seedDemoData() {
  const existingTemple = await prisma.organization.findFirst({ where: { name: 'Shree Shantinath Jain Derasar (Demo)' } });
  if (existingTemple) {
    console.log('Demo data already exists, skipping');
    return;
  }

  const shwetambar = await prisma.community.findUniqueOrThrow({ where: { name: 'Shwetambar' } });

  const templePublicId = await prisma.$transaction((tx) => nextPublicId('TEMPLE', tx));
  const temple = await prisma.organization.create({
    data: {
      publicId: templePublicId,
      type: 'TEMPLE',
      name: 'Shree Shantinath Jain Derasar (Demo)',
      shortName: 'Shantinath Derasar',
      status: 'ACTIVE',
      communityId: shwetambar.id,
      templeType: 'SHIKHAR_BADDHA',
      city: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India',
      lat: 23.0225,
      lng: 72.5714,
      hasBhojanshala: true,
      disclaimerText: 'Information provided is indicative; please confirm with temple administration.',
    },
  });

  const dharamshalaPublicId = await prisma.$transaction((tx) => nextPublicId('DHARAMSHALA', tx));
  await prisma.organization.create({
    data: {
      publicId: dharamshalaPublicId,
      type: 'DHARAMSHALA',
      name: 'JiNANAM Yatri Dharamshala (Demo)',
      status: 'ACTIVE',
      city: 'Palitana',
      state: 'Gujarat',
      country: 'India',
      lat: 21.5222,
      lng: 71.8266,
    },
  });

  const jcPublicId = await prisma.$transaction((tx) => nextPublicId('JAIN_CENTER', tx));
  await prisma.organization.create({
    data: {
      publicId: jcPublicId,
      type: 'JAIN_CENTER',
      name: 'JiNANAM Jain Center (Demo)',
      status: 'ACTIVE',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
    },
  });

  // Demo Temple Admin
  const templeAdminMobile = '+919999900001';
  const templeAdminUser = await prisma.user.create({
    data: {
      mobile: templeAdminMobile,
      mobileVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash('ChangeMe@108', 10),
      firstName: 'Demo',
      lastName: 'TempleAdmin',
      primaryRoleKey: 'TEMPLE_ADMIN',
      status: 'ACTIVE',
      createdByAdmin: true,
    },
  });
  await prisma.userOrganization.create({
    data: { userId: templeAdminUser.id, organizationId: temple.id, roleKey: 'TEMPLE_ADMIN' },
  });

  // Demo Jain Members
  for (let i = 1; i <= 3; i += 1) {
    const mobile = `+91900000000${i}`;
    const memberPublicId = await prisma.$transaction((tx) => nextPublicId('JAIN_MEMBER', tx));
    const user = await prisma.user.create({
      data: {
        mobile,
        mobileVerifiedAt: new Date(),
        primaryRoleKey: 'MEMBER',
        status: 'ACTIVE',
        publicId: memberPublicId,
      },
    });
    await prisma.member.create({
      data: {
        userId: user.id,
        publicId: memberPublicId,
        category: 'JAIN',
        firstName: `Demo${i}`,
        surname: 'Member',
        fullName: `Demo${i} Member`,
        communityId: shwetambar.id,
        mobile,
        mobileVerifiedAt: new Date(),
        status: 'ACTIVE',
        aadhaarHash: null,
      },
    });
  }

  console.log('Seeded demo organizations (Temple, Dharamshala, Jain Center), 1 Temple Admin, 3 Jain Members');
}

async function main() {
  await seedRolesAndPermissions();
  await seedMasterData();
  await seedSuperAdmin();
  await seedDemoData();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
