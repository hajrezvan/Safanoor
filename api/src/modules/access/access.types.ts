export type AccessLevel = 'none' | 'summary' | 'detail';
export const RESOURCE_TYPES = [
  'file',
  'person',
  'group',
  'membership',
  'assignment',
  'assistant_invite',
  'policy',
  'grant',
  'audit',
  'consent',
  'notification',
  'import',
  'admin',
  'person_file',
  'confidential_note',
  'consultation',
  'consultation_summary',
  'consultation_private_note',
  'schedule',
  'private_schedule',
  'meeting',
  'photo',
  'location_option',
  'fund',
  'transparency',
  'parent_camp',
  'emergency',
  'project_report',
  'project_feedback',
  'chat_thread',
  'study_path',
  'lms_item',
  'program_event',
  'camp',
  'dashboard',
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];
export type Action =
  | 'read'
  | 'create'
  | 'update'
  | 'deactivate'
  | 'assign'
  | 'grant'
  | 'revoke'
  | 'manage'
  | 'emergency'
  | 'print';
export interface Actor {
  userId: string;
  personId: string;
  isAdmin: boolean;
  isParent: boolean;
  external: boolean;
  orgLevel: string;
  status: string;
  consentRequired: boolean;
}
export interface Resource {
  type: ResourceType;
  id?: string;
  ownerId?: string;
  memberId?: string;
  ownerRole?: string;
  groupIds?: string[];
  hostGroupId?: string;
  attendeeIds?: string[];
  campParticipantIds?: string[];
  campLeadId?: string;
  campStartsAt?: string;
  campEndsAt?: string;
  status?: string;
  public?: boolean;
}
export interface PolicyRow {
  resourceType: string;
  action: string;
  ownerRole: string;
  viewerRelation: string;
  level: AccessLevel;
}
export interface GrantRow {
  resourceType: string;
  resourceId: string;
  granteePersonId: string;
  revokedAt: string | null;
}
export interface Relations {
  self: boolean;
  mentor: boolean;
  headMentor: boolean;
  ancestor: boolean;
  followingAssistant: boolean;
  otherAssistant: boolean;
  supervisor: boolean;
  parent: boolean;
  sameGroup: boolean;
  groupMentor: boolean;
  hostMentor: boolean;
  financeOfficer: boolean;
  attendee: boolean;
  attendeeAncestor: boolean;
  campLead: boolean;
  campActive: boolean;
  authorizedFollower: boolean;
}
export const emptyRelations: Relations = {
  self: false,
  mentor: false,
  headMentor: false,
  ancestor: false,
  followingAssistant: false,
  otherAssistant: false,
  supervisor: false,
  parent: false,
  sameGroup: false,
  groupMentor: false,
  hostMentor: false,
  financeOfficer: false,
  attendee: false,
  attendeeAncestor: false,
  campLead: false,
  campActive: false,
  authorizedFollower: false,
};
