import {
  actorFromRole,
  pickDefaultRole,
  resolveActiveRole,
  roleId,
} from './active-role';

describe('active role helpers', () => {
  const roles = [
    {
      id: 'technical_manager',
      kind: 'technical_manager' as const,
      label: 'مدیر فنی',
    },
    {
      id: roleId('mentor', 'g33'),
      kind: 'mentor' as const,
      groupId: 'g33',
      groupName: 'صفا ۳۳',
      label: 'صفا ۳۳ - مربی',
    },
    {
      id: roleId('assistant', 'g27'),
      kind: 'assistant' as const,
      groupId: 'g27',
      groupName: 'صفا ۲۷',
      label: 'صفا ۲۷ - کمک‌مربی',
    },
    {
      id: roleId('member', 'g27'),
      kind: 'member' as const,
      groupId: 'g27',
      groupName: 'صفا ۲۷',
      label: 'صفا ۲۷ - نیرو',
    },
  ];

  it('defaults to orgLevel role then mentor', () => {
    expect(pickDefaultRole(roles, 'mentor').kind).toBe('mentor');
    expect(pickDefaultRole(roles, 'assistant').kind).toBe('assistant');
  });

  it('resolves stored role and falls back when stale', () => {
    expect(resolveActiveRole(roles, roleId('assistant', 'g27'), 'mentor').kind).toBe(
      'assistant',
    );
    expect(resolveActiveRole(roles, 'mentor:missing', 'mentor').kind).toBe(
      'mentor',
    );
  });

  it('scopes isAdmin only for technical manager', () => {
    const identity = {
      userId: 'u',
      personId: 'p',
      isAdmin: true,
      isParent: false,
      external: false,
      orgLevel: 'mentor',
      status: 'active',
      consentRequired: false,
    };
    const mentor = actorFromRole(identity, roles[1]);
    expect(mentor.isAdmin).toBe(false);
    expect(mentor.orgLevel).toBe('mentor');
    expect(mentor.activeGroupId).toBe('g33');

    const admin = actorFromRole(identity, roles[0]);
    expect(admin.isAdmin).toBe(true);
    expect(admin.activeRoleKind).toBe('technical_manager');
    expect(admin.activeGroupId).toBeNull();
  });
});
