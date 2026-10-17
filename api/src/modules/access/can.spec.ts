import { can } from './can';
import {
  AccessLevel,
  Action,
  Actor,
  emptyRelations,
  Relations,
  Resource,
  RESOURCE_TYPES,
} from './access.types';
import { foundationPolicies } from './policy.seed';

const columns = [
  'self',
  'followingAssistant',
  'otherAssistant',
  'mentor',
  'otherMentor',
  'headMentor',
  'supervisor',
  'parent',
  'unrelated',
  'admin',
] as const;
const relationMap: Record<(typeof columns)[number], Partial<Relations>> = {
  self: { self: true, sameGroup: true },
  followingAssistant: {
    followingAssistant: true,
    otherAssistant: true,
    sameGroup: true,
    authorizedFollower: true,
  },
  otherAssistant: { otherAssistant: true, sameGroup: true },
  mentor: { mentor: true, groupMentor: true, hostMentor: true, ancestor: true },
  otherMentor: {},
  headMentor: { headMentor: true, ancestor: true },
  supervisor: { supervisor: true, ancestor: true },
  parent: { parent: true },
  unrelated: {},
  admin: {},
};
const matrix: Record<string, { action: Action; expected: string }> = {
  file: { action: 'read', expected: 'D N N N N N N N N N' },
  person: { action: 'read', expected: 'D S N D N N N N N S' },
  group: { action: 'read', expected: 'D D D D N D D N N D' },
  membership: { action: 'assign', expected: 'N N N D N N N N N D' },
  assignment: { action: 'assign', expected: 'N N N D N N N N N D' },
  policy: { action: 'read', expected: 'N N N N N N N N N D' },
  grant: { action: 'read', expected: 'D N N D N N N N N N' },
  audit: { action: 'read', expected: 'N N N N N N N N N D' },
  consent: { action: 'read', expected: 'D N N N N N N D N D' },
  notification: { action: 'read', expected: 'D N N N N N N N N N' },
  import: { action: 'read', expected: 'D N N N N N N N N N' },
  admin: { action: 'read', expected: 'N N N D N N N N N D' },
  person_file: { action: 'read', expected: 'N N N D N N N N N N' },
  confidential_note: { action: 'read', expected: 'D N N D N N N N N N' },
  consultation_summary: { action: 'read', expected: 'D D N D N N N N N N' },
  consultation_private_note: {
    action: 'read',
    expected: 'D N N D N N N N N N',
  },
  schedule: { action: 'read', expected: 'D N N D N D D N N N' },
  private_schedule: { action: 'read', expected: 'D S N D N S S N N N' },
  meeting: { action: 'read', expected: 'N N N N N N N N N N' },
  photo: { action: 'read', expected: 'D D D D N D D N N N' },
  fund: { action: 'read', expected: 'N N N D N N N N N N' },
  transparency: { action: 'read', expected: 'S S S S S S S N S N' },
  parent_camp: { action: 'read', expected: 'S N N S N N N S N N' },
  emergency: { action: 'emergency', expected: 'N D N D N N N N N N' },
  project_report: { action: 'read', expected: 'D N N N N N N N N N' },
  project_feedback: { action: 'read', expected: 'D D N N N N N N N N' },
};
const actor: Actor = {
  userId: 'user',
  personId: 'viewer',
  isAdmin: false,
  isParent: false,
  external: false,
  orgLevel: 'member',
  status: 'active',
  consentRequired: false,
};
const policies = foundationPolicies();
const levels: Record<string, AccessLevel> = {
  N: 'none',
  S: 'summary',
  D: 'detail',
};

describe('explicit organization policy matrix', () => {
  it('covers every registered resource type', () => {
    expect(Object.keys(matrix).sort()).toEqual([...RESOURCE_TYPES].sort());
  });
  for (const type of RESOURCE_TYPES) {
    const entry = matrix[type];
    for (const [index, column] of columns.entries())
      it(`${type}/${entry.action}/${column}`, () => {
        const resource: Resource = {
          type,
          id: 'resource',
          ownerRole:
            type === 'consultation_private_note' ? 'assistant' : 'member',
        };
        expect(
          can(
            {
              ...actor,
              isAdmin: column === 'admin',
              external: column === 'admin' || column === 'parent',
              isParent: column === 'parent',
            },
            entry.action,
            resource,
            {
              policies,
              relations: { ...emptyRelations, ...relationMap[column] },
            },
          ),
        ).toBe(levels[entry.expected.split(' ')[index]]);
      });
  }
  it('mentor private notes remain visible only to their author, even with a grant', () => {
    for (const column of columns)
      expect(
        can(
          { ...actor, personId: 'viewer', isAdmin: column === 'admin' },
          'read',
          {
            type: 'consultation_private_note',
            id: 'note',
            ownerRole: 'mentor',
          },
          {
            policies,
            relations: { ...emptyRelations, ...relationMap[column] },
            grants: [
              {
                resourceType: 'consultation_private_note',
                resourceId: 'note',
                granteePersonId: 'viewer',
                revokedAt: null,
              },
            ],
          },
        ),
      ).toBe(column === 'self' ? 'detail' : 'none');
  });
  it('head mentor sees assistant private-block details, while supervisor gets busy summary', () => {
    expect(
      can(
        actor,
        'read',
        { type: 'private_schedule', ownerRole: 'assistant' },
        { policies, relations: { ...emptyRelations, headMentor: true } },
      ),
    ).toBe('detail');
    expect(
      can(
        actor,
        'read',
        { type: 'private_schedule', ownerRole: 'assistant' },
        { policies, relations: { ...emptyRelations, supervisor: true } },
      ),
    ).toBe('summary');
  });
  it('meeting attendees and attendee ancestors see the meeting without unrelated admin access', () => {
    for (const relation of ['attendee', 'attendeeAncestor'] as const)
      expect(
        can(
          actor,
          'read',
          { type: 'meeting' },
          { policies, relations: { ...emptyRelations, [relation]: true } },
        ),
      ).toBe('detail');
  });
  it('only camp-day participants can be opened by camp lead', () => {
    expect(
      can(
        actor,
        'emergency',
        { type: 'emergency', status: 'active' },
        {
          policies,
          relations: { ...emptyRelations, campLead: true, campActive: false },
        },
      ),
    ).toBe('none');
    expect(
      can(
        actor,
        'emergency',
        { type: 'emergency', status: 'active' },
        {
          policies,
          relations: { ...emptyRelations, campLead: true, campActive: true },
        },
      ),
    ).toBe('detail');
    expect(
      can(
        actor,
        'emergency',
        { type: 'emergency', status: 'left' },
        { policies, relations: { ...emptyRelations, mentor: true } },
      ),
    ).toBe('none');
  });
  it('finance officer sees funds; administrators and supervisors cannot', () => {
    expect(
      can(
        actor,
        'read',
        { type: 'fund' },
        { policies, relations: { ...emptyRelations, financeOfficer: true } },
      ),
    ).toBe('detail');
  });
  it('revoked grants and expired parent relationships cannot authorize confidential access', () => {
    const resource: Resource = { type: 'consultation_summary', id: 'summary' };
    const grant = {
      resourceType: 'consultation_summary',
      resourceId: 'summary',
      granteePersonId: 'viewer',
      revokedAt: null,
    };
    expect(
      can({ ...actor, isParent: true }, 'read', resource, {
        policies,
        relations: { ...emptyRelations, parent: true },
        grants: [grant],
      }),
    ).toBe('detail');
    expect(
      can({ ...actor, isParent: true }, 'read', resource, {
        policies,
        relations: emptyRelations,
        grants: [grant],
      }),
    ).toBe('none');
    expect(
      can(actor, 'read', resource, {
        policies,
        relations: emptyRelations,
        grants: [{ ...grant, revokedAt: new Date().toISOString() }],
      }),
    ).toBe('none');
  });
  it('left users and missing policy rows always deny', () => {
    expect(
      can(
        { ...actor, status: 'left' },
        'read',
        { type: 'person' },
        { policies, relations: { ...emptyRelations, self: true } },
      ),
    ).toBe('none');
    expect(
      can(
        actor,
        'manage',
        { type: 'person' },
        { policies, relations: { ...emptyRelations, self: true } },
      ),
    ).toBe('none');
  });
});
