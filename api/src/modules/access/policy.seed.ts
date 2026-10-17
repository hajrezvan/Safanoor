import { Action, AccessLevel, PolicyRow } from './access.types';

export function foundationPolicies(): PolicyRow[] {
  const policies: PolicyRow[] = [];
  const allow = (
    resourceType: string,
    action: Action,
    relations: string[],
    level: AccessLevel = 'detail',
    ownerRole = '*',
  ) => {
    for (const viewerRelation of relations)
      policies.push({ resourceType, action, ownerRole, viewerRelation, level });
  };
  allow('file', 'read', ['self']);
  allow('person', 'read', ['self', 'mentor', 'groupMentor']);
  allow('person', 'read', ['followingAssistant', 'admin'], 'summary');
  allow('person', 'create', ['admin', 'groupMentor']);
  allow('person', 'update', ['self', 'mentor', 'admin']);
  allow('person', 'deactivate', ['mentor', 'admin']);
  allow('group', 'read', ['sameGroup', 'groupMentor', 'ancestor', 'admin']);
  allow('group', 'create', ['admin']);
  allow('group', 'update', ['groupMentor', 'admin']);
  allow('membership', 'assign', ['groupMentor', 'admin']);
  allow('assignment', 'assign', ['groupMentor', 'admin']);
  allow('policy', 'read', ['admin']);
  allow('audit', 'read', ['admin']);
  allow('admin', 'read', ['admin', 'groupMentor']);
  allow('admin', 'manage', ['admin']);
  allow('grant', 'read', ['self', 'mentor']);
  allow('grant', 'grant', ['mentor']);
  allow('grant', 'revoke', ['mentor']);
  allow('consent', 'read', ['self', 'parent', 'admin']);
  allow('consent', 'create', ['self', 'parent']);
  allow('consent', 'manage', ['admin']);
  allow('notification', 'read', ['self']);
  allow('notification', 'update', ['self']);
  allow('import', 'read', ['self']);
  allow('import', 'create', ['groupMentor', 'admin']);
  allow('import', 'update', ['self']);
  allow('person_file', 'read', ['mentor', 'grant']);
  allow('confidential_note', 'read', ['self', 'mentor', 'grant']);
  allow('consultation_summary', 'read', [
    'self',
    'mentor',
    'followingAssistant',
    'grant',
  ]);
  allow(
    'consultation_private_note',
    'read',
    ['self', 'mentor'],
    'detail',
    'assistant',
  );
  allow('consultation_private_note', 'read', ['self'], 'detail', 'mentor');
  allow('schedule', 'read', [
    'self',
    'mentor',
    'headMentor',
    'ancestor',
    'supervisor',
  ]);
  allow('private_schedule', 'read', ['self', 'mentor']);
  allow('private_schedule', 'read', ['headMentor'], 'detail', 'assistant');
  allow(
    'private_schedule',
    'read',
    ['followingAssistant', 'headMentor', 'ancestor', 'supervisor'],
    'summary',
  );
  allow('meeting', 'read', ['attendee', 'attendeeAncestor']);
  allow('photo', 'read', [
    'sameGroup',
    'groupMentor',
    'ancestor',
    'supervisor',
  ]);
  allow('photo', 'update', ['hostMentor']);
  allow('fund', 'read', ['groupMentor', 'financeOfficer']);
  allow('transparency', 'read', ['organization'], 'summary');
  allow('parent_camp', 'read', ['self', 'parent', 'mentor'], 'summary');
  allow('emergency', 'emergency', [
    'mentor',
    'followingAssistant',
    'activeCampLead',
  ]);
  allow('project_report', 'read', ['self']);
  allow('project_feedback', 'read', ['self', 'authorizedFollower']);
  return policies;
}
