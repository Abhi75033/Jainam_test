import { isActionAllowed, listAssignedModules, EffectivePermissions } from '@/engines/rbac/permission.service';

function makeEffective(overrides: Partial<EffectivePermissions> = {}): EffectivePermissions {
  return {
    role: 'TEMPLE_ADMIN',
    isSuperAdmin: false,
    organizationIds: ['org1'],
    permissions: { EVENTS: ['VIEW', 'CREATE', 'EDIT'], BOOKINGS: ['VIEW', 'APPROVE'] },
    organizationOverrides: {},
    ...overrides,
  };
}

describe('Permission Engine (§3)', () => {
  it('grants role-default permissions', () => {
    const e = makeEffective();
    expect(isActionAllowed(e, 'EVENTS', 'CREATE')).toBe(true);
    expect(isActionAllowed(e, 'BOOKINGS', 'APPROVE')).toBe(true);
  });

  it('denies actions not in the role defaults', () => {
    const e = makeEffective();
    expect(isActionAllowed(e, 'EVENTS', 'DELETE')).toBe(false);
    expect(isActionAllowed(e, 'ADS', 'VIEW')).toBe(false);
  });

  it('Super Admin bypasses all checks', () => {
    const e = makeEffective({ isSuperAdmin: true, permissions: {} });
    expect(isActionAllowed(e, 'ANYTHING', 'DELETE')).toBe(true);
  });

  it('org-scoped overrides replace role defaults for that org', () => {
    const e = makeEffective({
      organizationOverrides: { org1: { EVENTS: ['VIEW'] } }, // override strips CREATE/EDIT within org1
    });
    expect(isActionAllowed(e, 'EVENTS', 'CREATE', 'org1')).toBe(false);
    expect(isActionAllowed(e, 'EVENTS', 'VIEW', 'org1')).toBe(true);
    // No org context -> role defaults apply
    expect(isActionAllowed(e, 'EVENTS', 'CREATE')).toBe(true);
  });

  it('global user overrides take precedence over everything for non-super-admins', () => {
    const e = makeEffective({
      organizationOverrides: { __global__: { EVENTS: [] } },
    });
    expect(isActionAllowed(e, 'EVENTS', 'VIEW', 'org1')).toBe(false);
  });

  it('lists assigned modules for GET /me/modules', () => {
    const e = makeEffective();
    const modules = listAssignedModules(e);
    expect(modules).toContain('EVENTS');
    expect(modules).toContain('BOOKINGS');

    const superAdmin = makeEffective({ isSuperAdmin: true });
    expect(listAssignedModules(superAdmin)).toEqual(['*']);
  });
});
