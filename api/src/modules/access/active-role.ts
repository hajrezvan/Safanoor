import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { rows } from '../../libs/database/database.types';
import { Actor } from './access.types';

export const ACTIVE_ROLE_KINDS = [
  'technical_manager',
  'supervisor',
  'head_mentor',
  'mentor',
  'assistant',
  'member',
] as const;

export type ActiveRoleKind = (typeof ACTIVE_ROLE_KINDS)[number];

export interface ActiveRole {
  id: string;
  kind: ActiveRoleKind;
  groupId?: string;
  groupName?: string;
  label: string;
}

export interface ActorIdentity {
  userId: string;
  personId: string;
  isAdmin: boolean;
  isParent: boolean;
  external: boolean;
  orgLevel: string;
  status: string;
  consentRequired: boolean;
}

const kindLabel: Record<ActiveRoleKind, string> = {
  technical_manager: 'مدیر فنی',
  supervisor: 'ناظر',
  head_mentor: 'سرمربی',
  mentor: 'مربی',
  assistant: 'کمک‌مربی',
  member: 'نیرو',
};

export function roleId(kind: ActiveRoleKind, groupId?: string): string {
  return groupId ? `${kind}:${groupId}` : kind;
}

export function parseRoleId(
  id: string,
): { kind: ActiveRoleKind; groupId?: string } | null {
  if ((ACTIVE_ROLE_KINDS as readonly string[]).includes(id))
    return { kind: id as ActiveRoleKind };
  const split = id.indexOf(':');
  if (split <= 0) return null;
  const kind = id.slice(0, split);
  const groupId = id.slice(split + 1);
  if (!(ACTIVE_ROLE_KINDS as readonly string[]).includes(kind) || !groupId)
    return null;
  return { kind: kind as ActiveRoleKind, groupId };
}

function withLabel(
  kind: ActiveRoleKind,
  groupId?: string,
  groupName?: string,
): ActiveRole {
  return {
    id: roleId(kind, groupId),
    kind,
    groupId,
    groupName,
    label: groupName ? `${groupName} - ${kindLabel[kind]}` : kindLabel[kind],
  };
}

/** All selectable roles for a person (memberships, owned groups, admin). */
export async function listAvailableRoles(
  db: DataSource | EntityManager,
  identity: Pick<ActorIdentity, 'personId' | 'userId' | 'isAdmin' | 'orgLevel'>,
): Promise<ActiveRole[]> {
  const owned = await rows<{ id: string; name: string }>(
    db,
    `SELECT id, name FROM organization_group
     WHERE owner_person_id=$1
     ORDER BY name, id`,
    [identity.personId],
  );
  const memberships = await rows<{
    groupId: string;
    groupName: string;
    role: string;
  }>(
    db,
    `SELECT m.group_id AS "groupId", g.name AS "groupName", m.role
     FROM membership m
     JOIN organization_group g ON g.id=m.group_id
     WHERE m.person_id=$1 AND m.valid_to IS NULL
     ORDER BY g.name, g.id, m.role`,
    [identity.personId],
  );

  const roles: ActiveRole[] = [];
  const seen = new Set<string>();
  const push = (role: ActiveRole) => {
    if (seen.has(role.id)) return;
    seen.add(role.id);
    roles.push(role);
  };

  if (identity.isAdmin) push(withLabel('technical_manager'));

  if (identity.orgLevel === 'supervisor') push(withLabel('supervisor'));
  if (identity.orgLevel === 'head_mentor') push(withLabel('head_mentor'));

  for (const group of owned) push(withLabel('mentor', group.id, group.name));

  for (const row of memberships) {
    if (row.role === 'assistant')
      push(withLabel('assistant', row.groupId, row.groupName));
    if (row.role === 'member')
      push(withLabel('member', row.groupId, row.groupName));
  }

  return roles;
}

export function pickDefaultRole(
  roles: ActiveRole[],
  orgLevel: string,
): ActiveRole {
  if (roles.length === 0)
    return withLabel(
      (ACTIVE_ROLE_KINDS as readonly string[]).includes(orgLevel)
        ? (orgLevel as ActiveRoleKind)
        : 'member',
    );
  const preferred =
    roles.find((role) => role.kind === orgLevel) ??
    roles.find((role) => role.kind === 'mentor') ??
    roles.find((role) => role.kind === 'assistant') ??
    roles.find((role) => role.kind === 'member') ??
    roles[0];
  return preferred;
}

export function resolveActiveRole(
  roles: ActiveRole[],
  storedId: string | null | undefined,
  orgLevel: string,
): ActiveRole {
  if (storedId) {
    const match = roles.find((role) => role.id === storedId);
    if (match) return match;
  }
  return pickDefaultRole(roles, orgLevel);
}

/** Apply the selected role onto actor flags used by can() and list scopes. */
export function actorFromRole(
  identity: ActorIdentity,
  role: ActiveRole,
): Actor {
  const scopedAdmin = role.kind === 'technical_manager' && identity.isAdmin;
  const orgLevel =
    role.kind === 'technical_manager'
      ? identity.orgLevel
      : role.kind === 'supervisor' ||
          role.kind === 'head_mentor' ||
          role.kind === 'mentor' ||
          role.kind === 'assistant' ||
          role.kind === 'member'
        ? role.kind
        : identity.orgLevel;
  return {
    userId: identity.userId,
    personId: identity.personId,
    isAdmin: scopedAdmin,
    isParent: identity.isParent,
    external: identity.external,
    orgLevel,
    status: identity.status,
    consentRequired: identity.consentRequired,
    activeRoleId: role.id,
    activeRoleKind: role.kind,
    activeGroupId: role.groupId ?? null,
  };
}

export async function loadActorWithRole(
  db: DataSource | EntityManager,
  identity: ActorIdentity,
  storedRoleId: string | null | undefined,
): Promise<{ actor: Actor; activeRole: ActiveRole; availableRoles: ActiveRole[] }> {
  const availableRoles = await listAvailableRoles(db, identity);
  const activeRole = resolveActiveRole(
    availableRoles,
    storedRoleId,
    identity.orgLevel,
  );
  return {
    actor: actorFromRole(identity, activeRole),
    activeRole,
    availableRoles,
  };
}

export async function assertSelectableRole(
  db: DataSource | EntityManager,
  identity: Pick<ActorIdentity, 'personId' | 'userId' | 'isAdmin' | 'orgLevel'>,
  roleIdValue: string,
): Promise<ActiveRole> {
  const available = await listAvailableRoles(db, identity);
  const match = available.find((role) => role.id === roleIdValue);
  if (!match)
    throw new BadRequestException('این نقش برای حساب شما در دسترس نیست.');
  return match;
}

export async function persistActiveRole(
  db: DataSource | EntityManager,
  sessionId: string,
  userId: string,
  roleIdValue: string,
): Promise<void> {
  await rows(
    db,
    `UPDATE auth_session SET active_role_id=$1
     WHERE id=$2 AND user_id=$3 AND revoked_at IS NULL AND expires_at>now()`,
    [roleIdValue, sessionId, userId],
  );
}
