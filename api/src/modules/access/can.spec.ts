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
  avatar: { action: 'read', expected: 'D N N N N N N N N N' },
  person: { action: 'read', expected: 'D S N D N S S N N S' },
  group: { action: 'read', expected: 'D D D D N D D N N D' },
  membership: { action: 'assign', expected: 'N N N D N N N N N D' },
  assignment: { action: 'assign', expected: 'N N N D N N N N N D' },
  assistant_invite: { action: 'create', expected: 'N N N D N N N N N N' },
  policy: { action: 'read', expected: 'N N N N N N N N N D' },
  grant: { action: 'read', expected: 'D N N D N N N N N N' },
  audit: { action: 'read', expected: 'N N N N N N N N N D' },
  consent: { action: 'read', expected: 'D N N N N N N D N D' },
  notification: { action: 'read', expected: 'D N N N N N N N N N' },
  import: { action: 'read', expected: 'D N N N N N N N N N' },
  admin: { action: 'read', expected: 'N N N D N N N N N D' },
  person_file: { action: 'read', expected: 'N N N D N N N N N N' },
  confidential_note: { action: 'read', expected: 'D N N D N N N N N N' },
  consultation: { action: 'read', expected: 'D D N D N N N N N D' },
  consultation_summary: { action: 'read', expected: 'D D N D N N N N N D' },
  consultation_private_note: {
    action: 'read',
    expected: 'D N N D N N N N N N',
  },
  schedule: { action: 'read', expected: 'D N N D N D D N N N' },
  private_schedule: { action: 'read', expected: 'D S N D N S S N N N' },
  meeting: { action: 'read', expected: 'N N N N N N N N N D' },
  photo: { action: 'read', expected: 'D D D D N D D N N D' },
  location_option: { action: 'read', expected: 'D D D D D D D N D D' },
  fund: { action: 'read', expected: 'N N N D N N N N N N' },
  transparency: { action: 'read', expected: 'S S S S S S S N S N' },
  parent_camp: { action: 'read', expected: 'S N N S N N N S N N' },
  emergency: { action: 'emergency', expected: 'N D N D N N N N N N' },
  project_report: { action: 'read', expected: 'D N N N N N N N N N' },
  project_feedback: { action: 'read', expected: 'D D N N N N N N N N' },
  chat_thread: { action: 'read', expected: 'N N N D N N N N N D' },
  study_reading: { action: 'read', expected: 'D N N N N N N N N N' },
  study_path: { action: 'read', expected: 'D D D D N N N N N D' },
  lms_item: { action: 'read', expected: 'D D D D N N N N N D' },
  member_finance: { action: 'read', expected: 'D N N N N N N N N N' },
  program_event: { action: 'read', expected: 'N N N D N N N N N D' },
  camp: { action: 'read', expected: 'D D D D N N N N N D' },
  dashboard: { action: 'read', expected: 'N N N D N N N N N D' },
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
  it('only self can update an avatar', () => {
    for (const column of columns) {
      expect(
        can(
          {
            ...actor,
            isAdmin: column === 'admin',
            isParent: column === 'parent',
          },
          'update',
          { type: 'avatar', ownerId: 'owner' },
          {
            policies,
            relations: { ...emptyRelations, ...relationMap[column] },
          },
        ),
      ).toBe(column === 'self' ? 'detail' : 'none');
    }
  });

  it('only self may update reading progress, including when superiors or admins ask', () => {
    for (const column of columns) {
      expect(
        can(
          {
            ...actor,
            isAdmin: column === 'admin',
            isParent: column === 'parent',
          },
          'update',
          { type: 'study_reading', ownerId: 'owner' },
          {
            policies,
            relations: { ...emptyRelations, ...relationMap[column] },
          },
        ),
      ).toBe(column === 'self' ? 'detail' : 'none');
    }
  });

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
  it('only the private-note author can create or update; mentors cannot write an assistant note', () => {
    for (const action of ['create', 'update'] as const) {
      expect(
        can(
          actor,
          action,
          { type: 'consultation_private_note', ownerRole: 'assistant' },
          { policies, relations: { ...emptyRelations, self: true } },
        ),
      ).toBe('detail');
      expect(
        can(
          actor,
          action,
          { type: 'consultation_private_note', ownerRole: 'assistant' },
          { policies, relations: { ...emptyRelations, mentor: true } },
        ),
      ).toBe('none');
      expect(
        can(
          actor,
          action,
          { type: 'consultation_private_note', ownerRole: 'mentor' },
          {
            policies,
            relations: { ...emptyRelations, groupMentor: true },
          },
        ),
      ).toBe('none');
    }
  });
  it('assistant private notes are readable by the assistant and their mentor only', () => {
    expect(
      can(
        actor,
        'read',
        { type: 'consultation_private_note', ownerRole: 'assistant' },
        { policies, relations: { ...emptyRelations, self: true } },
      ),
    ).toBe('detail');
    expect(
      can(
        actor,
        'read',
        { type: 'consultation_private_note', ownerRole: 'assistant' },
        { policies, relations: { ...emptyRelations, mentor: true } },
      ),
    ).toBe('detail');
    expect(
      can(
        actor,
        'read',
        { type: 'consultation_private_note', ownerRole: 'assistant' },
        {
          policies,
          relations: { ...emptyRelations, headMentor: true, ancestor: true },
        },
      ),
    ).toBe('none');
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
  it('only the host group mentor creates or updates meetings', () => {
    for (const action of ['create', 'update'] as const) {
      expect(
        can(
          actor,
          action,
          { type: 'meeting' },
          { policies, relations: { ...emptyRelations, groupMentor: true } },
        ),
      ).toBe('detail');
      expect(
        can(
          actor,
          action,
          { type: 'meeting' },
          { policies, relations: { ...emptyRelations, attendee: true } },
        ),
      ).toBe('none');
    }
  });
  it('consultation attendees and following assistants can read shared consultation records', () => {
    for (const relation of ['attendee', 'followingAssistant'] as const)
      expect(
        can(
          actor,
          'read',
          { type: 'consultation' },
          { policies, relations: { ...emptyRelations, [relation]: true } },
        ),
      ).toBe('detail');
    expect(
      can(
        actor,
        'read',
        { type: 'consultation' },
        { policies, relations: { ...emptyRelations, attendeeAncestor: true } },
      ),
    ).toBe('none');
  });
  it('mentor or group assistant can create consultations; only author or mentor updates', () => {
    expect(
      can(
        actor,
        'create',
        { type: 'consultation' },
        { policies, relations: { ...emptyRelations, groupMentor: true } },
      ),
    ).toBe('detail');
    expect(
      can(
        actor,
        'create',
        { type: 'consultation' },
        { policies, relations: { ...emptyRelations, otherAssistant: true } },
      ),
    ).toBe('detail');
    expect(
      can(
        actor,
        'create',
        { type: 'consultation' },
        { policies, relations: { ...emptyRelations, attendee: true } },
      ),
    ).toBe('none');
    expect(
      can(
        actor,
        'update',
        { type: 'consultation' },
        { policies, relations: { ...emptyRelations, self: true } },
      ),
    ).toBe('detail');
    expect(
      can(
        actor,
        'update',
        { type: 'consultation' },
        { policies, relations: { ...emptyRelations, groupMentor: true } },
      ),
    ).toBe('detail');
    expect(
      can(
        actor,
        'update',
        { type: 'consultation' },
        {
          policies,
          relations: { ...emptyRelations, otherAssistant: true },
        },
      ),
    ).toBe('none');
  });
  it('chat participants and group mentors can read and post; others cannot', () => {
    expect(
      can(
        actor,
        'read',
        { type: 'chat_thread' },
        { policies, relations: { ...emptyRelations, attendee: true } },
      ),
    ).toBe('detail');
    expect(
      can(
        actor,
        'create',
        { type: 'chat_thread' },
        { policies, relations: { ...emptyRelations, groupMentor: true } },
      ),
    ).toBe('detail');
    expect(
      can(
        actor,
        'read',
        { type: 'chat_thread' },
        { policies, relations: { ...emptyRelations, sameGroup: true } },
      ),
    ).toBe('none');
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
  it('only the group mentor can create or manage study paths', () => {
    for (const action of ['create', 'update', 'manage'] as const) {
      expect(
        can(
          actor,
          action,
          { type: 'study_path' },
          { policies, relations: { ...emptyRelations, groupMentor: true } },
        ),
      ).toBe('detail');
      expect(
        can(
          actor,
          action,
          { type: 'study_path' },
          { policies, relations: { ...emptyRelations, sameGroup: true } },
        ),
      ).toBe('none');
    }
  });
  it('only the group mentor can create or manage lms items', () => {
    for (const action of ['create', 'update', 'manage'] as const) {
      expect(
        can(
          actor,
          action,
          { type: 'lms_item' },
          { policies, relations: { ...emptyRelations, groupMentor: true } },
        ),
      ).toBe('detail');
      expect(
        can(
          actor,
          action,
          { type: 'lms_item' },
          { policies, relations: { ...emptyRelations, sameGroup: true } },
        ),
      ).toBe('none');
    }
  });
  it('only the host mentor can upload or retag album photos; group members can read', () => {
    expect(
      can(
        actor,
        'create',
        { type: 'photo' },
        { policies, relations: { ...emptyRelations, hostMentor: true } },
      ),
    ).toBe('detail');
    expect(
      can(
        actor,
        'create',
        { type: 'photo' },
        { policies, relations: { ...emptyRelations, sameGroup: true } },
      ),
    ).toBe('none');
    expect(
      can(
        actor,
        'update',
        { type: 'photo' },
        { policies, relations: { ...emptyRelations, hostMentor: true } },
      ),
    ).toBe('detail');
    expect(
      can(
        actor,
        'read',
        { type: 'photo' },
        { policies, relations: { ...emptyRelations, sameGroup: true } },
      ),
    ).toBe('detail');
  });
  it('only the group mentor can create or manage camps', () => {
    for (const action of ['create', 'update', 'manage'] as const) {
      expect(
        can(
          actor,
          action,
          { type: 'camp' },
          { policies, relations: { ...emptyRelations, groupMentor: true } },
        ),
      ).toBe('detail');
      expect(
        can(
          actor,
          action,
          { type: 'camp' },
          { policies, relations: { ...emptyRelations, sameGroup: true } },
        ),
      ).toBe('none');
    }
  });
  it('only the group mentor manages program finance; finance officer may read', () => {
    expect(
      can(
        actor,
        'read',
        { type: 'program_event' },
        { policies, relations: { ...emptyRelations, financeOfficer: true } },
      ),
    ).toBe('detail');
    for (const action of ['create', 'update', 'manage'] as const) {
      expect(
        can(
          actor,
          action,
          { type: 'program_event' },
          { policies, relations: { ...emptyRelations, groupMentor: true } },
        ),
      ).toBe('detail');
      expect(
        can(
          actor,
          action,
          { type: 'program_event' },
          {
            policies,
            relations: { ...emptyRelations, financeOfficer: true },
          },
        ),
      ).toBe('none');
    }
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
