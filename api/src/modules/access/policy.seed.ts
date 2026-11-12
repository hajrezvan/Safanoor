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
  allow('avatar', 'read', ['self']);
  allow('avatar', 'update', ['self']);
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
  allow('assistant_invite', 'create', ['groupMentor']);
  allow('assistant_invite', 'read', ['groupMentor', 'self']);
  allow('assistant_invite', 'update', ['self']);
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
  allow('consultation', 'read', [
    'attendee',
    'self',
    'groupMentor',
    'followingAssistant',
    'admin',
  ]);
  allow('consultation', 'create', ['groupMentor', 'otherAssistant']);
  allow('consultation', 'update', ['self', 'groupMentor']);
  allow('consultation_summary', 'read', [
    'self',
    'mentor',
    'followingAssistant',
    'grant',
    'admin',
  ]);
  allow(
    'consultation_private_note',
    'read',
    ['self', 'mentor'],
    'detail',
    'assistant',
  );
  allow('consultation_private_note', 'read', ['self'], 'detail', 'mentor');
  allow('consultation_private_note', 'create', ['self']);
  allow('consultation_private_note', 'update', ['self']);
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
  allow('meeting', 'read', ['attendee', 'attendeeAncestor', 'admin']);
  allow('meeting', 'create', ['groupMentor']);
  allow('meeting', 'update', ['groupMentor']);
  allow('photo', 'create', ['hostMentor']);
  allow('photo', 'read', [
    'sameGroup',
    'groupMentor',
    'ancestor',
    'supervisor',
    'admin',
  ]);
  allow('photo', 'update', ['hostMentor']);
  allow('location_option', 'read', ['organization', 'admin']);
  allow('location_option', 'create', ['groupMentor', 'admin']);
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
  allow('chat_thread', 'read', ['attendee', 'groupMentor', 'admin']);
  allow('chat_thread', 'create', ['attendee', 'groupMentor']);
  allow('study_reading', 'read', ['self']);
  allow('study_reading', 'update', ['self']);
  allow('study_path', 'read', ['sameGroup', 'groupMentor', 'admin']);
  allow('study_path', 'create', ['groupMentor']);
  allow('study_path', 'update', ['groupMentor']);
  allow('study_path', 'manage', ['groupMentor']);
  allow('lms_item', 'read', ['sameGroup', 'groupMentor', 'admin']);
  allow('lms_item', 'create', ['groupMentor']);
  allow('lms_item', 'update', ['groupMentor']);
  allow('lms_item', 'manage', ['groupMentor']);
  allow('member_finance', 'read', ['self']);
  allow('program_event', 'read', ['groupMentor', 'financeOfficer', 'admin']);
  allow('program_event', 'create', ['groupMentor']);
  allow('program_event', 'update', ['groupMentor']);
  allow('program_event', 'manage', ['groupMentor']);
  allow('camp', 'read', ['campStaff', 'groupMentor', 'admin']);
  allow('camp', 'create', ['groupMentor']);
  allow('camp', 'update', ['groupMentor']);
  allow('camp', 'manage', ['groupMentor']);
  allow('dashboard', 'read', ['groupMentor', 'admin']);
  return policies;
}
