'use client';

import type { components } from 'src/api/generated/schema';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useContext, useState, createContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ApiError } from 'src/api/client';

import { Shell, QueryState, type NavItem } from 'src/components/ui';

type MeDto = components['schemas']['MeDto'];

type SessionValue = {
  me: MeDto;
  logout: () => Promise<void>;
};
const SessionContext = createContext<SessionValue | null>(null);
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('Session required');
  return session.me;
}
export function useLogout() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('Session required');
  return session.logout;
}

function homeForRole(_me: MeDto): string {
  return '/';
}

export function Session({ children }: { children: React.ReactNode }) {
  const query = useQuery({ queryKey: ['me'], queryFn: api.me, retry: false });
  const router = useRouter();
  const cache = useQueryClient();
  const path = usePathname();
  const [roleBusy, setRoleBusy] = useState(false);
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401)
      router.replace('/auth/jwt/sign-in');
  }, [query.error, router]);
  const me = query.data;
  useEffect(() => {
    if (me?.consentRequired && path !== '/consent' && path !== '/notifications')
      router.replace('/consent');
  }, [me, path, router]);
  const isMentor = me?.person.orgLevel === 'mentor';
  const isTechManager = me?.activeRole?.kind === 'technical_manager';
  const nav: NavItem[] = me
    ? [
        {
          key: isMentor ? 'myGroup' : 'people',
          href: '/admin/people',
          icon: 'people',
          // مدیر فنی does not use the people roster; mentors/assistants keep «اعضا» / «گروه من».
          visible: !isTechManager && me.capabilities.managePeople,
        },
        {
          key: 'communications',
          href: '/communications',
          icon: 'communications',
          visible:
            !me.isParent &&
            ['mentor', 'assistant', 'member'].includes(me.person.orgLevel),
        },
        {
          key: 'groups',
          href: '/admin/groups',
          icon: 'groups',
          visible:
            me.person.orgLevel !== 'mentor' &&
            (me.capabilities.manageGroups || me.capabilities.managePeople),
        },
        {
          key: 'imports',
          href: '/admin/imports',
          icon: 'imports',
          visible: isTechManager && me.capabilities.manageSettings,
        },
        {
          key: 'access',
          href: '/admin/access',
          icon: 'access',
          visible: me.capabilities.managePeople || me.capabilities.viewPolicies,
        },
        {
          key: 'audit',
          href: '/admin/audit',
          icon: 'audit',
          visible: isTechManager && me.capabilities.viewAudit,
        },
        {
          key: 'settings',
          href: '/admin/settings',
          icon: 'settings',
          visible: isTechManager && me.capabilities.manageSettings,
        },
      ]
    : [];
  const logout = async () => {
    try {
      await api.logout();
    } finally {
      cache.clear();
      router.replace('/auth/jwt/sign-in');
    }
  };
  const switchRole = async (roleId: string) => {
    setRoleBusy(true);
    try {
      const next = await api.setActiveRole(roleId);
      cache.clear();
      cache.setQueryData(['me'], next);
      router.replace(homeForRole(next));
      await cache.invalidateQueries();
    } finally {
      setRoleBusy(false);
    }
  };
  return (
    <Shell
      admin={path.startsWith('/admin')}
      nav={nav}
      user={
        me
          ? {
              name: `${me.person.firstName} ${me.person.lastName}`,
              role: me.person.orgLevel,
              roleLabel: me.activeRole?.label,
              groupName: me.person.groupName,
              photoUrl: me.avatarUrl,
              activeRoleId: me.activeRole?.id,
              roles: (me.availableRoles ?? []).map((role) => ({
                id: role.id,
                label: role.label,
              })),
            }
          : undefined
      }
      onLogout={() => void logout()}
      onRoleChange={(roleId) => void switchRole(roleId)}
      roleSwitchBusy={roleBusy}
    >
      <QueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}>
        {me && (
          <SessionContext.Provider value={{ me, logout }}>{children}</SessionContext.Provider>
        )}
      </QueryState>
    </Shell>
  );
}
