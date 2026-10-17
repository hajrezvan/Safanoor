'use client';

import type { components } from 'src/api/generated/schema';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useContext, createContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ApiError } from 'src/api/client';

import { Shell, QueryState, type NavItem } from 'src/components/ui';

const SessionContext = createContext<components['schemas']['MeDto'] | null>(null);
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('Session required');
  return session;
}
export function Session({ children }: { children: React.ReactNode }) {
  const query = useQuery({ queryKey: ['me'], queryFn: api.me, retry: false });
  const router = useRouter();
  const cache = useQueryClient();
  const path = usePathname();
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401)
      router.replace('/auth/jwt/sign-in');
  }, [query.error, router]);
  const me = query.data;
  useEffect(() => {
    if (me?.consentRequired && path !== '/consent' && path !== '/notifications')
      router.replace('/consent');
  }, [me, path, router]);
  const nav: NavItem[] = me
    ? [
        { key: 'overview', href: '/admin', icon: 'admin' },
        {
          key: 'people',
          href: '/admin/people',
          icon: 'people',
          visible: me.capabilities.managePeople,
        },
        {
          key: 'groups',
          href: '/admin/groups',
          icon: 'groups',
          visible: me.capabilities.manageGroups || me.capabilities.managePeople,
        },
        {
          key: 'imports',
          href: '/admin/imports',
          icon: 'imports',
          visible: me.capabilities.importPeople,
        },
        {
          key: 'access',
          href: '/admin/access',
          icon: 'access',
          visible: me.capabilities.managePeople || me.capabilities.viewPolicies,
        },
        { key: 'audit', href: '/admin/audit', icon: 'audit', visible: me.capabilities.viewAudit },
        {
          key: 'settings',
          href: '/admin/settings',
          icon: 'settings',
          visible: me.capabilities.manageSettings,
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
  return (
    <Shell
      admin={path.startsWith('/admin')}
      nav={nav}
      canAdmin={me?.capabilities.admin ?? false}
      onLogout={() => void logout()}
    >
      <QueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}>
        {me && <SessionContext.Provider value={me}>{children}</SessionContext.Provider>}
      </QueryState>
    </Shell>
  );
}
