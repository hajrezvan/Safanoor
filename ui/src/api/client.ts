import type { paths } from './generated/schema';

import createClient from 'openapi-fetch';

import { fa } from 'src/locales/fa';

let csrf = '';
let renewing: Promise<void> | undefined;
const raw = globalThis.fetch.bind(globalThis);
async function csrfToken() {
  if (!csrf) {
    const response = await raw('/api/v1/auth/csrf', { credentials: 'include', cache: 'no-store' });
    if (!response.ok) throw new Error('CSRF');
    const data = (await response.json()) as { csrfToken: string };
    csrf = data.csrfToken;
  }
  return csrf;
}
async function transport(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const isAuth = /\/auth\/(login|refresh|csrf)/.test(url.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method))
    request.headers.set('x-csrf-token', await csrfToken());
  const backup = request.clone();
  let response = await raw(request);
  if (response.status === 401 && !isAuth) {
    if (!renewing)
      renewing = (async () => {
        const refresh = await raw('/api/v1/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', 'x-csrf-token': await csrfToken() },
          body: '{}',
        });
        if (!refresh.ok) throw new Error('SESSION');
        csrf = ((await refresh.json()) as { csrfToken: string }).csrfToken;
      })().finally(() => {
        renewing = undefined;
      });
    try {
      await renewing;
      backup.headers.set('x-csrf-token', csrf);
      response = await raw(backup);
    } catch {
      return response;
    }
  }
  if (response.ok && url.pathname.endsWith('/auth/login'))
    csrf = ((await response.clone().json()) as { csrfToken: string }).csrfToken;
  return response;
}
export const client = createClient<paths>({
  baseUrl: typeof window === 'undefined' ? 'http://localhost:3033' : window.location.origin,
  credentials: 'include',
  cache: 'no-store',
  fetch: transport,
});
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
export function unwrap<T>({
  data,
  error,
  response,
}: {
  data?: T;
  error?: unknown;
  response: Response;
}): T {
  if (error || !response.ok) {
    let message: string = fa.error;
    if (
      error &&
      typeof error === 'object' &&
      'error' in error &&
      error.error &&
      typeof error.error === 'object' &&
      'message' in error.error &&
      typeof error.error.message === 'string'
    )
      message = error.error.message;
    throw new ApiError(response.status, message);
  }
  return data as T;
}
export const api = {
  me: async () => unwrap(await client.GET('/api/v1/people/me')),
  setActiveRole: async (roleId: string) =>
    unwrap(await client.POST('/api/v1/people/me/active-role', { body: { roleId } })),
  login: async (body: { login: string; password: string }) =>
    unwrap(await client.POST('/api/v1/auth/login', { body })),
  logout: async () => unwrap(await client.POST('/api/v1/auth/logout')),
  people: async (page = 1, search = '') =>
    unwrap(await client.GET('/api/v1/people', { params: { query: { page, limit: 15, search } } })),
  groups: async (page = 1) =>
    unwrap(await client.GET('/api/v1/groups', { params: { query: { page, limit: 100 } } })),
  notifications: async (page = 1) =>
    unwrap(await client.GET('/api/v1/notifications', { params: { query: { page, limit: 15 } } })),
  consent: async (personId?: string) =>
    unwrap(await client.GET('/api/v1/consent', { params: { query: { personId } } })),
  overview: async () => unwrap(await client.GET('/api/v1/admin/overview')),
  mentorDashboard: async () => unwrap(await client.GET('/api/v1/dashboard/mentor')),
  chatThreads: async (page = 1) =>
    unwrap(
      await client.GET('/api/v1/communications/threads', {
        params: { query: { page, limit: 50 } },
      })
    ),
  chatMessages: async (threadId: string, page = 1) =>
    unwrap(
      await client.GET('/api/v1/communications/threads/{id}/messages', {
        params: { path: { id: threadId }, query: { page, limit: 50 } },
      })
    ),
  postChatMessage: async (threadId: string, body: string) =>
    unwrap(
      await client.POST('/api/v1/communications/threads/{id}/messages', {
        params: { path: { id: threadId } },
        body: { body },
      })
    ),
};
