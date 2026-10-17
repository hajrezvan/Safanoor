import {
  AccessLevel,
  Action,
  Actor,
  GrantRow,
  PolicyRow,
  Relations,
  Resource,
} from './access.types';

const levels: Record<AccessLevel, number> = { none: 0, summary: 1, detail: 2 };
export function can(
  actor: Actor,
  action: Action,
  resource: Resource,
  context: {
    policies: readonly PolicyRow[];
    relations: Relations;
    grants?: readonly GrantRow[];
  },
): AccessLevel {
  if (actor.status !== 'active') return 'none';
  if (
    resource.status &&
    resource.status !== 'active' &&
    ['emergency', 'person_file', 'confidential_note'].includes(resource.type)
  )
    return 'none';
  const relations = new Set<string>(actor.external ? [] : ['organization']);
  for (const [key, enabled] of Object.entries(context.relations))
    if (enabled) relations.add(key);
  if (actor.isAdmin) relations.add('admin');
  if (actor.isParent) {
    relations.clear();
    if (context.relations.self) relations.add('self');
    if (context.relations.parent) relations.add('parent');
  }
  if (context.relations.campLead && context.relations.campActive)
    relations.add('activeCampLead');
  const activeGrant = context.grants?.some(
    (grant) =>
      grant.resourceType === resource.type &&
      grant.resourceId === resource.id &&
      grant.granteePersonId === actor.personId &&
      !grant.revokedAt,
  );
  if (
    activeGrant &&
    (!actor.isParent ||
      (resource.type === 'consultation_summary' && context.relations.parent))
  )
    relations.add('grant');
  let result: AccessLevel = 'none';
  for (const policy of context.policies) {
    if (
      policy.resourceType !== resource.type ||
      policy.action !== action ||
      !relations.has(policy.viewerRelation) ||
      (policy.ownerRole !== '*' && policy.ownerRole !== resource.ownerRole)
    )
      continue;
    if (levels[policy.level] > levels[result]) result = policy.level;
  }
  return result;
}
