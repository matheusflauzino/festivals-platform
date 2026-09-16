# Frontend Admin (Auth + Shell + Festivais) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first navigable slice of the admin area in `apps/web` — login, an authenticated dashboard shell, and full Festival management (list, create, edit, publish, close, stages, grade criteria) — consuming the already-merged NestJS backend with zero backend logic duplication.

**Architecture:** `app/(admin)/...` splits into a public `login` route and a nested `(protected)` route group whose layout enforces authentication client-side. Auth state (access token, admin) lives in a React context, never in `localStorage`; the refresh token stays a `httpOnly` cookie the browser manages automatically. TanStack Query handles all server-state caching; `react-hook-form` + the *same* Zod schemas already used by the backend (`@fenac-platform/contracts`) validate every form, client and server side, from one source of truth.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `axios`, Vitest + Testing Library, Playwright.

**Spec:** `docs/specs/2026-09-16-frontend-admin-design.md` (all sections), `docs/specs/2026-09-15-fenac-platform-architecture-design.md` §7.

## Global Constraints

- **No `localStorage`/`sessionStorage` for the access token** — it lives only in a React context (in-memory), lost on full page reload by design; a silent refresh (via the `httpOnly` cookie) restores it on mount.
- **Reuse `@fenac-platform/contracts` schemas verbatim** for every form's validation — never redefine a Zod schema that already exists there.
- **Never modify any already-merged backend file except `apps/api/src/main.ts`** (CORS, Task 1) and a new standalone seed script (Task 13) — every other backend file (controllers, use cases, entities) is out of scope and already reviewed.
- **`tenantSlug` comes from `NEXT_PUBLIC_TENANT_SLUG`**, never from user input — the system is single-tenant (FENAC) at launch.
- **Client-visible env vars must be prefixed `NEXT_PUBLIC_`** — Next.js strips unprefixed vars from the client bundle (see `apps/web/AGENTS.md`, this project runs Next.js 16, verify any unfamiliar API against `apps/web/node_modules/next/dist/docs/` before assuming training-data behavior).
- **This project has no `middleware.ts` — Next.js 16 renamed it to `proxy.ts`.** This plan does not need one (all auth is client-side), but do not reach for `middleware.ts` out of habit.
- **RBAC on the client is UX-only** — hiding a button for a non-`ORGANIZER` role is a convenience, never a security boundary; the backend's `RolesGuard` is the only real enforcement, already in place and untouched by this plan.
- **Every task must pass `pnpm --filter web build`, `pnpm --filter web lint`, and `pnpm --filter web test`** before being considered done — not just the tests for that task's own files.

---

### Task 1: Enable CORS on the API + install frontend HTTP/data dependencies

**Files:**
- Modify: `apps/api/src/main.ts`
- Modify: `.env.example` (repo root)
- Create: `apps/web/.env.example`
- Modify: `apps/web/package.json` (via `pnpm add`)
- Create: `apps/web/src/lib/api/client.ts`
- Create: `apps/web/src/lib/api/client.spec.ts`

**Interfaces:**
- Produces: `apiClient` (a configured `axios` instance, base URL from `NEXT_PUBLIC_API_URL`, `withCredentials: true`) — consumed by every API-calling module in this plan.

**Context:** the web app (`localhost:3000` in dev) and the API (`localhost:3001` in dev, per `docker-compose.yml`'s port mapping) are different origins from the browser's point of view (different ports). Without CORS enabled on the API, every fetch from the browser will be blocked before this plan's UI can do anything. `withCredentials: true` (and matching `credentials: true` server-side) is required for the browser to send/receive the `httpOnly` `adminRefreshToken` cookie on cross-origin requests.

- [ ] **Step 1: Add CORS to the API**

Open `apps/api/src/main.ts` and add `app.enableCors(...)` before `app.listen(...)`:

```typescript
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **Step 2: Add `WEB_ORIGIN` to the root `.env.example`**

Append to `.env.example` (repo root):

```
WEB_ORIGIN="http://localhost:3000"
```

- [ ] **Step 3: Verify the API still builds and its full test suite still passes**

Run: `cd apps/api && pnpm run build && pnpm run test && pnpm run test:integration`
Expected: all PASS, no regressions from the CORS change (there is no test asserting CORS headers yet — this step only confirms nothing else broke; a CORS-specific check happens in Task 14's e2e smoke test, which exercises a real cross-origin-shaped request).

- [ ] **Step 4: Commit the CORS change**

```bash
git add apps/api/src/main.ts .env.example
git commit -m "feat(api): enable CORS for the web app's origin"
```

- [ ] **Step 5: Install frontend dependencies**

```bash
cd apps/web
pnpm add @tanstack/react-query react-hook-form @hookform/resolvers axios zod
```

(`zod` itself is added directly here too — `@hookform/resolvers/zod` needs it as a peer dependency, and form-value types in later tasks use `z.input<typeof someSchema>` for date-field coercion, described in Task 10.)

- [ ] **Step 6: Create the web app's env example**

Create `apps/web/.env.example`:

```
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_TENANT_SLUG="fenac"
```

- [ ] **Step 7: Write the failing test for the API client**

Create `apps/web/src/lib/api/client.spec.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { apiClient } from './client';

describe('apiClient', () => {
  it('is configured with the API base URL and credentials enabled', () => {
    expect(apiClient.defaults.baseURL).toBe('http://localhost:3001');
    expect(apiClient.defaults.withCredentials).toBe(true);
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `cd apps/web && pnpm test client.spec.ts`
Expected: FAIL — `Cannot find module './client'`.

- [ ] **Step 9: Implement the API client**

Create `apps/web/src/lib/api/client.ts`:

```typescript
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});
```

- [ ] **Step 10: Add the env var for the test environment**

Vitest reads `process.env` directly (no Next.js runtime involved in unit tests), so the test needs the variable set when it runs. Modify `apps/web/vitest.config.ts` to set it:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    env: {
      NEXT_PUBLIC_API_URL: 'http://localhost:3001',
      NEXT_PUBLIC_TENANT_SLUG: 'fenac',
    },
  },
});
```

- [ ] **Step 11: Run the test to verify it passes**

Run: `cd apps/web && pnpm test client.spec.ts`
Expected: PASS.

- [ ] **Step 12: Verify build and lint**

```bash
cd apps/web && pnpm run build && pnpm run lint
```

- [ ] **Step 13: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/.env.example apps/web/vitest.config.ts apps/web/src/lib/api/client.ts apps/web/src/lib/api/client.spec.ts
git commit -m "feat(web): add HTTP/data dependencies and configured API client"
```

---

### Task 2: Admin auth API client functions

**Files:**
- Create: `apps/web/src/lib/api/admin-auth.ts`
- Create: `apps/web/src/lib/api/admin-auth.spec.ts`

**Interfaces:**
- Consumes: `apiClient` (Task 1).
- Produces: `AdminUser` type (`{id, name, email, role: 'ORGANIZER'|'JUDGE'|'COMMITTEE'}`), `loginRequest(email, password): Promise<{accessToken: string; admin: AdminUser}>`, `refreshRequest(): Promise<{accessToken: string}>`, `meRequest(accessToken: string): Promise<AdminUser>` — consumed by Task 3's `AuthProvider`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/api/admin-auth.spec.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { apiClient } from './client';
import { loginRequest, refreshRequest, meRequest } from './admin-auth';

vi.mock('./client', () => ({
  apiClient: { post: vi.fn(), get: vi.fn() },
}));

const mockedPost = vi.mocked(apiClient.post);
const mockedGet = vi.mocked(apiClient.get);

beforeEach(() => {
  mockedPost.mockReset();
  mockedGet.mockReset();
});

describe('loginRequest', () => {
  it('posts to the tenant-scoped login endpoint and returns the response data', async () => {
    const admin = { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' as const };
    mockedPost.mockResolvedValue({ data: { accessToken: 'token-abc', admin } });

    const result = await loginRequest('ana@example.com', 'secret');

    expect(mockedPost).toHaveBeenCalledWith('/tenants/fenac/admin/login', {
      email: 'ana@example.com',
      password: 'secret',
    });
    expect(result).toEqual({ accessToken: 'token-abc', admin });
  });
});

describe('refreshRequest', () => {
  it('posts to the refresh endpoint and returns the new access token', async () => {
    mockedPost.mockResolvedValue({ data: { accessToken: 'token-xyz' } });

    const result = await refreshRequest();

    expect(mockedPost).toHaveBeenCalledWith('/tenants/fenac/admin/refresh');
    expect(result).toEqual({ accessToken: 'token-xyz' });
  });
});

describe('meRequest', () => {
  it('gets the current admin using the given access token', async () => {
    const admin = { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' as const };
    mockedGet.mockResolvedValue({ data: admin });

    const result = await meRequest('token-abc');

    expect(mockedGet).toHaveBeenCalledWith('/tenants/fenac/admin/me', {
      headers: { Authorization: 'Bearer token-abc' },
    });
    expect(result).toEqual(admin);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm test admin-auth.spec.ts`
Expected: FAIL — `Cannot find module './admin-auth'`.

- [ ] **Step 3: Implement**

Create `apps/web/src/lib/api/admin-auth.ts`:

```typescript
import { apiClient } from './client';

export type AdminRole = 'ORGANIZER' | 'JUDGE' | 'COMMITTEE';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

const tenantSlug = process.env.NEXT_PUBLIC_TENANT_SLUG;

interface LoginResponse {
  accessToken: string;
  admin: AdminUser;
}

interface RefreshResponse {
  accessToken: string;
}

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>(`/tenants/${tenantSlug}/admin/login`, {
    email,
    password,
  });
  return response.data;
}

export async function refreshRequest(): Promise<RefreshResponse> {
  const response = await apiClient.post<RefreshResponse>(`/tenants/${tenantSlug}/admin/refresh`);
  return response.data;
}

export async function meRequest(accessToken: string): Promise<AdminUser> {
  const response = await apiClient.get<AdminUser>(`/tenants/${tenantSlug}/admin/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm test admin-auth.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify build and lint**

```bash
cd apps/web && pnpm run build && pnpm run lint
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api/admin-auth.ts apps/web/src/lib/api/admin-auth.spec.ts
git commit -m "feat(web): add admin auth API client functions"
```

---

### Task 3: `AuthProvider` + `useAuth`

**Files:**
- Create: `apps/web/src/lib/auth/auth-context.tsx`
- Create: `apps/web/src/lib/auth/auth-context.spec.tsx`

**Interfaces:**
- Consumes: `loginRequest`/`refreshRequest`/`meRequest`, `AdminUser` (Task 2).
- Produces: `AuthProvider` (React component, `'use client'`), `useAuth()` hook returning `{status: 'loading'|'authenticated'|'unauthenticated', admin: AdminUser|null, accessToken: string|null, login(email, password): Promise<void>, logout(): void}` — consumed by Task 4 (interceptors), Task 6 (login form), Task 7 (protected layout), and every screen that reads `admin.role`.

**Context:** on mount, `AuthProvider` attempts a silent refresh (using the `httpOnly` cookie) followed by a `/me` call to restore the session without forcing a fresh login on every page reload. `login()` uses the login endpoint's own response (which already includes `admin`), skipping the extra `/me` round-trip.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/auth/auth-context.spec.tsx`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './auth-context';
import * as adminAuth from '../api/admin-auth';

vi.mock('../api/admin-auth');

const admin = { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' as const };

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="admin-name">{auth.admin?.name ?? ''}</span>
      <button onClick={() => auth.login('ana@example.com', 'secret')}>Login</button>
      <button onClick={() => auth.logout()}>Logout</button>
    </div>
  );
}

beforeEach(() => {
  vi.mocked(adminAuth.refreshRequest).mockReset();
  vi.mocked(adminAuth.meRequest).mockReset();
  vi.mocked(adminAuth.loginRequest).mockReset();
});

describe('AuthProvider', () => {
  it('restores the session via silent refresh + me on mount when a valid cookie exists', async () => {
    vi.mocked(adminAuth.refreshRequest).mockResolvedValue({ accessToken: 'token-1' });
    vi.mocked(adminAuth.meRequest).mockResolvedValue(admin);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    expect(screen.getByTestId('admin-name').textContent).toBe('Ana');
  });

  it('falls back to unauthenticated when the silent refresh fails (no valid cookie)', async () => {
    vi.mocked(adminAuth.refreshRequest).mockRejectedValue(new Error('no cookie'));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));
    expect(adminAuth.meRequest).not.toHaveBeenCalled();
  });

  it('login() authenticates using the login response directly, without an extra /me call', async () => {
    vi.mocked(adminAuth.refreshRequest).mockRejectedValue(new Error('no cookie'));
    vi.mocked(adminAuth.loginRequest).mockResolvedValue({ accessToken: 'token-2', admin });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));

    await userEvent.click(screen.getByText('Login'));

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    expect(screen.getByTestId('admin-name').textContent).toBe('Ana');
    expect(adminAuth.meRequest).not.toHaveBeenCalled();
  });

  it('logout() clears the session', async () => {
    vi.mocked(adminAuth.refreshRequest).mockResolvedValue({ accessToken: 'token-1' });
    vi.mocked(adminAuth.meRequest).mockResolvedValue(admin);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));

    await userEvent.click(screen.getByText('Logout'));

    expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
    expect(screen.getByTestId('admin-name').textContent).toBe('');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm add -D @testing-library/user-event && pnpm test auth-context.spec.tsx`
Expected: FAIL — `Cannot find module './auth-context'`.

- [ ] **Step 3: Implement**

Create `apps/web/src/lib/auth/auth-context.tsx`:

```typescript
'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { loginRequest, logoutLocally, meRequest, refreshRequest, type AdminUser } from '../api/admin-auth';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  admin: AdminUser | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        const { accessToken: token } = await refreshRequest();
        const restoredAdmin = await meRequest(token);
        if (cancelled) return;
        setAccessToken(token);
        setAdmin(restoredAdmin);
        setStatus('authenticated');
      } catch {
        if (cancelled) return;
        setStatus('unauthenticated');
      }
    }
    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken: token, admin: loggedInAdmin } = await loginRequest(email, password);
    setAccessToken(token);
    setAdmin(loggedInAdmin);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    setAdmin(null);
    setStatus('unauthenticated');
  }, []);

  return (
    <AuthContext.Provider value={{ status, admin, accessToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm test auth-context.spec.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Self-review note on the test's `logoutLocally` import**

The test file and implementation above reference `logoutLocally` in the import list from `../api/admin-auth` but never actually use a function by that name (`logout()` in this context component is purely local state reset, not an API call — there is no backend logout endpoint, a documented gap from the spec). Remove `logoutLocally` from the import — it does not exist in Task 2's `admin-auth.ts` and would fail the build. The corrected import line is:

```typescript
import { loginRequest, meRequest, refreshRequest, type AdminUser } from '../api/admin-auth';
```

- [ ] **Step 6: Verify build and lint**

```bash
cd apps/web && pnpm run build && pnpm run lint
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/src/lib/auth/auth-context.tsx apps/web/src/lib/auth/auth-context.spec.tsx
git commit -m "feat(web): add AuthProvider and useAuth"
```

---

### Task 4: Axios auth interceptors (inject token, retry-once-on-401)

**Files:**
- Create: `apps/web/src/lib/api/auth-interceptors.ts`
- Create: `apps/web/src/lib/api/auth-interceptors.spec.ts`
- Modify: `apps/web/src/lib/auth/auth-context.tsx`

**Interfaces:**
- Consumes: `apiClient` (Task 1), `refreshRequest` (Task 2).
- Produces: `registerAuthInterceptors(apiClient, handlers: {getAccessToken(): string|null; onTokenRefreshed(token: string): void; onAuthFailure(): void}): void` — called once by `AuthProvider` (Task 3) after mount.

**Context:** two interceptors: a request interceptor injects `Authorization: Bearer <token>` on every outgoing call (reading the *current* token via a getter function, not a stale closed-over value, since the token changes after login/refresh); a response interceptor catches a 401, calls `refreshRequest()` exactly once, and either retries the original request with the new token or gives up and calls `onAuthFailure()` (which `AuthProvider` wires to `logout()`).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/api/auth-interceptors.spec.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from './client';
import * as adminAuth from './admin-auth';
import { registerAuthInterceptors } from './auth-interceptors';

vi.mock('./admin-auth', async () => {
  const actual = await vi.importActual<typeof adminAuth>('./admin-auth');
  return { ...actual, refreshRequest: vi.fn() };
});

const mock = new MockAdapter(apiClient);

beforeEach(() => {
  mock.reset();
  vi.mocked(adminAuth.refreshRequest).mockReset();
});

describe('registerAuthInterceptors', () => {
  it('injects the current access token on every request', async () => {
    let getAccessTokenCalls = 0;
    registerAuthInterceptors(apiClient, {
      getAccessToken: () => {
        getAccessTokenCalls += 1;
        return 'token-1';
      },
      onTokenRefreshed: vi.fn(),
      onAuthFailure: vi.fn(),
    });
    mock.onGet('/ping').reply((config) => {
      expect(config.headers?.Authorization).toBe('Bearer token-1');
      return [200, { ok: true }];
    });

    await apiClient.get('/ping');
    expect(getAccessTokenCalls).toBeGreaterThan(0);
  });

  it('retries once with a refreshed token after a 401, then succeeds', async () => {
    const onTokenRefreshed = vi.fn();
    let currentToken = 'expired-token';
    registerAuthInterceptors(apiClient, {
      getAccessToken: () => currentToken,
      onTokenRefreshed,
      onAuthFailure: vi.fn(),
    });
    vi.mocked(adminAuth.refreshRequest).mockImplementation(async () => {
      currentToken = 'fresh-token';
      return { accessToken: 'fresh-token' };
    });

    let attempt = 0;
    mock.onGet('/protected').reply((config) => {
      attempt += 1;
      if (attempt === 1) {
        expect(config.headers?.Authorization).toBe('Bearer expired-token');
        return [401];
      }
      expect(config.headers?.Authorization).toBe('Bearer fresh-token');
      return [200, { ok: true }];
    });

    const response = await apiClient.get('/protected');
    expect(response.data).toEqual({ ok: true });
    expect(onTokenRefreshed).toHaveBeenCalledWith('fresh-token');
    expect(attempt).toBe(2);
  });

  it('calls onAuthFailure and rejects when the refresh itself fails', async () => {
    const onAuthFailure = vi.fn();
    registerAuthInterceptors(apiClient, {
      getAccessToken: () => 'expired-token',
      onTokenRefreshed: vi.fn(),
      onAuthFailure,
    });
    vi.mocked(adminAuth.refreshRequest).mockRejectedValue(new Error('no cookie'));
    mock.onGet('/protected').reply(401);

    await expect(apiClient.get('/protected')).rejects.toBeInstanceOf(axios.AxiosError);
    expect(onAuthFailure).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm add -D axios-mock-adapter && pnpm test auth-interceptors.spec.ts`
Expected: FAIL — `Cannot find module './auth-interceptors'`.

- [ ] **Step 3: Implement**

Create `apps/web/src/lib/api/auth-interceptors.ts`:

```typescript
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { refreshRequest } from './admin-auth';

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

interface AuthInterceptorHandlers {
  getAccessToken: () => string | null;
  onTokenRefreshed: (token: string) => void;
  onAuthFailure: () => void;
}

export function registerAuthInterceptors(
  client: AxiosInstance,
  handlers: AuthInterceptorHandlers,
): void {
  client.interceptors.request.use((config) => {
    const token = handlers.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      const isAxiosLikeError =
        typeof error === 'object' &&
        error !== null &&
        'config' in error &&
        'response' in error;
      if (!isAxiosLikeError) {
        return Promise.reject(error);
      }

      const axiosError = error as { config: RetriableRequestConfig; response?: { status: number } };
      const isUnauthorized = axiosError.response?.status === 401;
      const alreadyRetried = axiosError.config._retried === true;

      if (!isUnauthorized || alreadyRetried) {
        return Promise.reject(error);
      }

      try {
        const { accessToken } = await refreshRequest();
        handlers.onTokenRefreshed(accessToken);
        axiosError.config._retried = true;
        axiosError.config.headers.Authorization = `Bearer ${accessToken}`;
        return client(axiosError.config);
      } catch (refreshError) {
        handlers.onAuthFailure();
        return Promise.reject(refreshError);
      }
    },
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm test auth-interceptors.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire the interceptors into `AuthProvider`**

Modify `apps/web/src/lib/auth/auth-context.tsx` — register the interceptors once, on mount, using a ref to always expose the *current* access token to the interceptor's `getAccessToken()` (since the interceptor is registered once but the token changes over the component's lifetime):

```typescript
'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { loginRequest, meRequest, refreshRequest, type AdminUser } from '../api/admin-auth';
import { apiClient } from '../api/client';
import { registerAuthInterceptors } from '../api/auth-interceptors';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  admin: AdminUser | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);

  const setAccessToken = useCallback((token: string | null) => {
    accessTokenRef.current = token;
    setAccessTokenState(token);
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    setAdmin(null);
    setStatus('unauthenticated');
  }, [setAccessToken]);

  useEffect(() => {
    registerAuthInterceptors(apiClient, {
      getAccessToken: () => accessTokenRef.current,
      onTokenRefreshed: (token) => setAccessToken(token),
      onAuthFailure: () => logout(),
    });
  }, [setAccessToken, logout]);

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        const { accessToken: token } = await refreshRequest();
        const restoredAdmin = await meRequest(token);
        if (cancelled) return;
        setAccessToken(token);
        setAdmin(restoredAdmin);
        setStatus('authenticated');
      } catch {
        if (cancelled) return;
        setStatus('unauthenticated');
      }
    }
    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, [setAccessToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { accessToken: token, admin: loggedInAdmin } = await loginRequest(email, password);
      setAccessToken(token);
      setAdmin(loggedInAdmin);
      setStatus('authenticated');
    },
    [setAccessToken],
  );

  return (
    <AuthContext.Provider value={{ status, admin, accessToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

- [ ] **Step 6: Re-run Task 3's test suite to confirm no regression**

Run: `cd apps/web && pnpm test auth-context.spec.tsx`
Expected: PASS (4 tests, unchanged behavior — `registerAuthInterceptors` runs against the real `apiClient` singleton, which the mocked `admin-auth` module in that spec file doesn't affect since no HTTP call is actually made in those tests beyond the mocked functions).

- [ ] **Step 7: Verify build and lint**

```bash
cd apps/web && pnpm run build && pnpm run lint
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/src/lib/api/auth-interceptors.ts apps/web/src/lib/api/auth-interceptors.spec.ts apps/web/src/lib/auth/auth-context.tsx
git commit -m "feat(web): add axios auth interceptors (inject token, retry-once-on-401)"
```

---

### Task 5: `Providers` wrapper + wire into `app/(admin)/layout.tsx`

**Files:**
- Create: `apps/web/src/components/providers.tsx`
- Create: `apps/web/app/(admin)/layout.tsx`

**Interfaces:**
- Consumes: `AuthProvider` (Task 3).
- Produces: `Providers` (`'use client'` component combining `QueryClientProvider` + `AuthProvider`) — used by every route under `app/(admin)/`, both the public `login` route and the `(protected)` group (Task 7).

No dedicated test for this task — it is pure composition/wiring with no logic of its own; it is exercised indirectly by every later screen's tests (which render through `Providers`) and by Task 14's e2e smoke test.

- [ ] **Step 1: Implement `Providers`**

Create `apps/web/src/components/providers.tsx`:

```typescript
'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../lib/auth/auth-context';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Wire it into the `(admin)` route group's layout**

Create `apps/web/app/(admin)/layout.tsx` (a Server Component — it only needs to render the Client Component `Providers` around its children, per the "Context providers" pattern documented in `apps/web/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`):

```typescript
import type { ReactNode } from 'react';
import { Providers } from '../../src/components/providers';

export default function AdminGroupLayout({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
```

Note: the existing root `app/layout.tsx` uses the generated `LayoutProps<'/'>` helper type (see it in that file for reference), but this project's Next.js 16 typegen keys that helper by the literal route path, and it is genuinely unclear without running `next dev` whether a route-GROUP layout like this one (which wraps multiple sibling routes — `/login`, `/festivals`, etc. — not a single path segment) generates a matching `LayoutProps<'/'>` entry. Use the always-correct explicit `{ children: ReactNode }` prop typing here instead of guessing; it works identically at runtime. If `next dev`/`next build` (Step 3) reports a type mismatch, that confirms the generated-type approach doesn't apply here — no fix needed, the explicit typing already used is correct as-is.

- [ ] **Step 3: Verify build and lint**

```bash
cd apps/web && pnpm run build && pnpm run lint
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/providers.tsx "apps/web/app/(admin)/layout.tsx"
git commit -m "feat(web): add Providers wrapper and wire into the admin route group"
```

---

### Task 6: Login page + form

**Files:**
- Create: `apps/web/app/(admin)/login/page.tsx`
- Create: `apps/web/app/(admin)/login/login-form.tsx`
- Create: `apps/web/app/(admin)/login/login-form.spec.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 3), `loginAdminUserSchema`/`LoginAdminUserDto` from `@fenac-platform/contracts`.
- Produces: `/login` route — this is the only route under `app/(admin)/` NOT inside the `(protected)` group (Task 7), reachable whether or not the visitor is authenticated.

- [ ] **Step 1: Write the failing test**

Create `apps/web/app/(admin)/login/login-form.spec.tsx`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './login-form';
import { useAuth } from '../../../src/lib/auth/auth-context';

vi.mock('../../../src/lib/auth/auth-context');
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

beforeEach(() => {
  mockPush.mockReset();
});

describe('LoginForm', () => {
  it('shows a validation error for an invalid email without calling login()', async () => {
    const login = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      status: 'unauthenticated',
      admin: null,
      accessToken: null,
      login,
      logout: vi.fn(),
    });

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.type(screen.getByLabelText('Senha'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText(/e-mail inválido/i)).toBeDefined();
    expect(login).not.toHaveBeenCalled();
  });

  it('calls login() with the form values and navigates to /festivals on success', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      status: 'unauthenticated',
      admin: null,
      accessToken: null,
      login,
      logout: vi.fn(),
    });

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('ana@example.com', 'secret'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/festivals'));
  });

  it('shows an error message when login() rejects (invalid credentials)', async () => {
    const login = vi.fn().mockRejectedValue(new Error('invalid credentials'));
    vi.mocked(useAuth).mockReturnValue({
      status: 'unauthenticated',
      admin: null,
      accessToken: null,
      login,
      logout: vi.fn(),
    });

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText(/e-mail ou senha inválidos/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm test login-form.spec.tsx`
Expected: FAIL — `Cannot find module './login-form'`.

- [ ] **Step 3: Implement the form**

Create `apps/web/app/(admin)/login/login-form.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginAdminUserSchema, type LoginAdminUserDto } from '@fenac-platform/contracts';
import { useAuth } from '../../../src/lib/auth/auth-context';

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginAdminUserDto>({
    resolver: zodResolver(loginAdminUserSchema),
  });

  async function onSubmit(values: LoginAdminUserDto) {
    setSubmitError(null);
    try {
      await login(values.email, values.password);
      router.push('/festivals');
    } catch {
      setSubmitError('E-mail ou senha inválidos.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('email')}
        />
        {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('password')}
        />
        {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
      </div>
      {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
      >
        Entrar
      </button>
    </form>
  );
}
```

Note: `loginAdminUserSchema` validates `email` with `z.string().email()`, whose default message in this Zod version reads "Invalid email" in English — the test above expects a Portuguese "e-mail inválido" (case-insensitive substring match). If the actual message text differs, this is expected: check `packages/contracts/src/participant-auth.schema.ts` or `admin-auth.schema.ts` for whether a custom message was ever configured; if not, adjust the test's regex to match the schema's real message rather than editing the shared schema (never modify a `packages/contracts` schema from this plan — Global Constraints).

- [ ] **Step 4: Create the page**

Create `apps/web/app/(admin)/login/page.tsx`:

```typescript
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <h1 className="text-center text-2xl font-semibold">FENAC — Área Administrativa</h1>
        <LoginForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/web && pnpm test login-form.spec.tsx`
Expected: PASS (3 tests) — adjust the error-message assertion per Step 3's note if the actual Zod message text differs.

- [ ] **Step 6: Verify build and lint**

```bash
cd apps/web && pnpm run build && pnpm run lint
```

- [ ] **Step 7: Commit**

```bash
git add "apps/web/app/(admin)/login"
git commit -m "feat(web): add login page and form"
```

---

### Task 7: `RequireAuth` + protected layout + dashboard shell

**Files:**
- Create: `apps/web/src/components/dashboard-shell.tsx`
- Create: `apps/web/app/(admin)/(protected)/layout.tsx`
- Create: `apps/web/app/(admin)/(protected)/layout.spec.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 3).
- Produces: every screen under `(protected)/` (Tasks 9-12) is wrapped by this layout — redirects to `/login` when `status === 'unauthenticated'`, shows a loading state while `status === 'loading'`, renders the `DashboardShell` (sidebar + topbar) around `children` when `status === 'authenticated'`.

**Note on the route group split:** `(protected)` is a route group — it adds no URL segment. `app/(admin)/(protected)/festivals/page.tsx` (created in Task 9) resolves to the URL `/festivals`, sitting alongside the sibling `app/(admin)/login/page.tsx` (`/login`, NOT wrapped by this layout). Both share the outer `app/(admin)/layout.tsx`'s `Providers` (Task 5).

- [ ] **Step 1: Write the failing test**

Create `apps/web/app/(admin)/(protected)/layout.spec.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProtectedLayout from './layout';
import { useAuth } from '../../../src/lib/auth/auth-context';

vi.mock('../../../src/lib/auth/auth-context');
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

describe('ProtectedLayout', () => {
  it('redirects to /login when unauthenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'unauthenticated',
      admin: null,
      accessToken: null,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(<ProtectedLayout>{'content'}</ProtectedLayout>);

    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('shows a loading state without redirecting while status is loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'loading',
      admin: null,
      accessToken: null,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(<ProtectedLayout>{'content'}</ProtectedLayout>);

    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByText(/carregando/i)).toBeDefined();
  });

  it('renders the dashboard shell and children when authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token',
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(<ProtectedLayout>{'festival list here'}</ProtectedLayout>);

    expect(screen.getByText('festival list here')).toBeDefined();
    expect(screen.getByText('Ana')).toBeDefined();
    expect(screen.getByText('Festivais')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm test "layout.spec.tsx"`
Expected: FAIL — `Cannot find module './layout'`.

- [ ] **Step 3: Implement the dashboard shell**

Create `apps/web/src/components/dashboard-shell.tsx`:

```typescript
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth/auth-context';

export function DashboardShell({ children }: { children: ReactNode }) {
  const { admin, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-slate-50 p-4">
        <nav className="flex flex-col gap-2">
          <Link href="/festivals" className="rounded px-3 py-2 hover:bg-slate-200">
            Festivais
          </Link>
          <span className="rounded px-3 py-2 text-gray-400">Usuários (em breve)</span>
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
          <div>
            <span className="font-medium">{admin?.name}</span>
            <span className="ml-2 text-sm text-gray-500">{admin?.role}</span>
          </div>
          <button onClick={logout} className="text-sm text-gray-600 hover:text-gray-900">
            Sair
          </button>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement the protected layout**

Create `apps/web/app/(admin)/(protected)/layout.tsx`:

```typescript
'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../src/lib/auth/auth-context';
import { DashboardShell } from '../../../src/components/dashboard-shell';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Carregando…</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return <DashboardShell>{children}</DashboardShell>;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/web && pnpm test "layout.spec.tsx"`
Expected: PASS (3 tests).

- [ ] **Step 6: Verify build and lint**

```bash
cd apps/web && pnpm run build && pnpm run lint
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/dashboard-shell.tsx "apps/web/app/(admin)/(protected)/layout.tsx" "apps/web/app/(admin)/(protected)/layout.spec.tsx"
git commit -m "feat(web): add RequireAuth-equivalent protected layout and dashboard shell"
```

---

### Task 8: Festivals API client functions

**Files:**
- Create: `apps/web/src/lib/api/festivals.ts`
- Create: `apps/web/src/lib/api/festivals.spec.ts`

**Interfaces:**
- Consumes: `apiClient` (Task 1), `CreateFestivalDto`/`UpdateFestivalDto`/`CreateStageDto`/`CreateGradeCriterionDto` from `@fenac-platform/contracts`.
- Produces: `Festival`, `Stage`, `GradeCriterion` response types, and `listFestivals(token)`, `getFestival(token, festivalId)`, `createFestival(token, body)`, `updateFestival(token, festivalId, body)`, `publishFestival(token, festivalId)`, `closeFestival(token, festivalId)`, `createStage(token, festivalId, body)`, `listStages(token, festivalId)`, `createGradeCriterion(token, stageId, body)`, `listGradeCriteria(token, stageId)` — consumed by Tasks 9-12.

**Note:** every function takes the access token explicitly as its first argument rather than reading it from a module-level variable — this keeps the module framework-agnostic and trivially testable (no context/provider needed in this file's own tests), matching the same "explicit dependency" discipline used throughout the backend's use cases in this project.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/api/festivals.spec.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { apiClient } from './client';
import {
  listFestivals,
  getFestival,
  createFestival,
  updateFestival,
  publishFestival,
  closeFestival,
  createStage,
  listStages,
  createGradeCriterion,
  listGradeCriteria,
} from './festivals';

vi.mock('./client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

const token = 'token-1';
const authHeader = { headers: { Authorization: `Bearer ${token}` } };

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset();
  vi.mocked(apiClient.post).mockReset();
  vi.mocked(apiClient.patch).mockReset();
});

describe('festivals API client', () => {
  it('listFestivals GETs the tenant-scoped collection', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await listFestivals(token);
    expect(apiClient.get).toHaveBeenCalledWith('/tenants/fenac/festivals', authHeader);
  });

  it('getFestival GETs a single festival by id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
    await getFestival(token, 'festival-1');
    expect(apiClient.get).toHaveBeenCalledWith('/tenants/fenac/festivals/festival-1', authHeader);
  });

  it('createFestival POSTs the body', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    const body = { number: 58, year: 2026, name: 'FENAC', inscriptionFee: 25 } as never;
    await createFestival(token, body);
    expect(apiClient.post).toHaveBeenCalledWith('/tenants/fenac/festivals', body, authHeader);
  });

  it('updateFestival PATCHes the body', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
    const body = { name: 'FENAC' } as never;
    await updateFestival(token, 'festival-1', body);
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/tenants/fenac/festivals/festival-1',
      body,
      authHeader,
    );
  });

  it('publishFestival POSTs to the publish sub-route with no body', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await publishFestival(token, 'festival-1');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/tenants/fenac/festivals/festival-1/publish',
      undefined,
      authHeader,
    );
  });

  it('closeFestival POSTs to the close sub-route with no body', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await closeFestival(token, 'festival-1');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/tenants/fenac/festivals/festival-1/close',
      undefined,
      authHeader,
    );
  });

  it('createStage POSTs under the festival', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    const body = { name: 'Classificatória', order: 1 } as never;
    await createStage(token, 'festival-1', body);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/tenants/fenac/festivals/festival-1/stages',
      body,
      authHeader,
    );
  });

  it('listStages GETs under the festival', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await listStages(token, 'festival-1');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/tenants/fenac/festivals/festival-1/stages',
      authHeader,
    );
  });

  it('createGradeCriterion POSTs under stages/:stageId', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    const body = { name: 'Afinação', weight: 2 } as never;
    await createGradeCriterion(token, 'stage-1', body);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/tenants/fenac/festivals/stages/stage-1/grade-criteria',
      body,
      authHeader,
    );
  });

  it('listGradeCriteria GETs under stages/:stageId', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await listGradeCriteria(token, 'stage-1');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/tenants/fenac/festivals/stages/stage-1/grade-criteria',
      authHeader,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm test festivals.spec.ts`
Expected: FAIL — `Cannot find module './festivals'`.

- [ ] **Step 3: Implement**

Create `apps/web/src/lib/api/festivals.ts`:

```typescript
import type {
  CreateFestivalDto,
  UpdateFestivalDto,
  CreateStageDto,
  CreateGradeCriterionDto,
} from '@fenac-platform/contracts';
import { apiClient } from './client';

const tenantSlug = process.env.NEXT_PUBLIC_TENANT_SLUG;

export type FestivalStatus = 'DRAFT' | 'OPEN' | 'CLOSED';

export interface Festival {
  id: string;
  number: number;
  year: number;
  name: string;
  registrationBegin: string;
  registrationEnd: string;
  votingBegin: string | null;
  votingEnd: string | null;
  status: FestivalStatus;
  inscriptionFee: number;
  regulationUrl: string | null;
  allowedStates: string[];
}

export interface Stage {
  id: string;
  festivalId: string;
  name: string;
  order: number;
  advancementQuota: number | null;
}

export interface GradeCriterion {
  id: string;
  stageId: string;
  name: string;
  weight: number;
}

function authHeader(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export async function listFestivals(token: string): Promise<Festival[]> {
  const response = await apiClient.get<Festival[]>(`/tenants/${tenantSlug}/festivals`, authHeader(token));
  return response.data;
}

export async function getFestival(token: string, festivalId: string): Promise<Festival> {
  const response = await apiClient.get<Festival>(
    `/tenants/${tenantSlug}/festivals/${festivalId}`,
    authHeader(token),
  );
  return response.data;
}

export async function createFestival(token: string, body: CreateFestivalDto): Promise<Festival> {
  const response = await apiClient.post<Festival>(`/tenants/${tenantSlug}/festivals`, body, authHeader(token));
  return response.data;
}

export async function updateFestival(
  token: string,
  festivalId: string,
  body: UpdateFestivalDto,
): Promise<Festival> {
  const response = await apiClient.patch<Festival>(
    `/tenants/${tenantSlug}/festivals/${festivalId}`,
    body,
    authHeader(token),
  );
  return response.data;
}

export async function publishFestival(token: string, festivalId: string): Promise<Festival> {
  const response = await apiClient.post<Festival>(
    `/tenants/${tenantSlug}/festivals/${festivalId}/publish`,
    undefined,
    authHeader(token),
  );
  return response.data;
}

export async function closeFestival(token: string, festivalId: string): Promise<Festival> {
  const response = await apiClient.post<Festival>(
    `/tenants/${tenantSlug}/festivals/${festivalId}/close`,
    undefined,
    authHeader(token),
  );
  return response.data;
}

export async function createStage(
  token: string,
  festivalId: string,
  body: CreateStageDto,
): Promise<Stage> {
  const response = await apiClient.post<Stage>(
    `/tenants/${tenantSlug}/festivals/${festivalId}/stages`,
    body,
    authHeader(token),
  );
  return response.data;
}

export async function listStages(token: string, festivalId: string): Promise<Stage[]> {
  const response = await apiClient.get<Stage[]>(
    `/tenants/${tenantSlug}/festivals/${festivalId}/stages`,
    authHeader(token),
  );
  return response.data;
}

export async function createGradeCriterion(
  token: string,
  stageId: string,
  body: CreateGradeCriterionDto,
): Promise<GradeCriterion> {
  const response = await apiClient.post<GradeCriterion>(
    `/tenants/${tenantSlug}/festivals/stages/${stageId}/grade-criteria`,
    body,
    authHeader(token),
  );
  return response.data;
}

export async function listGradeCriteria(token: string, stageId: string): Promise<GradeCriterion[]> {
  const response = await apiClient.get<GradeCriterion[]>(
    `/tenants/${tenantSlug}/festivals/stages/${stageId}/grade-criteria`,
    authHeader(token),
  );
  return response.data;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm test festivals.spec.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Verify build and lint**

```bash
cd apps/web && pnpm run build && pnpm run lint
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api/festivals.ts apps/web/src/lib/api/festivals.spec.ts
git commit -m "feat(web): add festivals API client functions"
```

---

### Task 9: Festival list screen

**Files:**
- Create: `apps/web/src/components/festival-status-badge.tsx`
- Create: `apps/web/app/(admin)/(protected)/festivals/page.tsx`
- Create: `apps/web/app/(admin)/(protected)/festivals/festival-list.tsx`
- Create: `apps/web/app/(admin)/(protected)/festivals/festival-list.spec.tsx`

**Interfaces:**
- Consumes: `listFestivals`, `Festival` (Task 8), `useAuth` (Task 3).
- Produces: `/festivals` route.

- [ ] **Step 1: Write the failing test**

Create `apps/web/app/(admin)/(protected)/festivals/festival-list.spec.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FestivalList } from './festival-list';
import { useAuth } from '../../../../src/lib/auth/auth-context';
import * as festivalsApi from '../../../../src/lib/api/festivals';

vi.mock('../../../../src/lib/auth/auth-context');
vi.mock('../../../../src/lib/api/festivals');

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('FestivalList', () => {
  it('renders each festival with its status badge', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(festivalsApi.listFestivals).mockResolvedValue([
      {
        id: 'f1',
        number: 58,
        year: 2026,
        name: 'FENAC 2026',
        registrationBegin: '2026-01-01T08:00:00.000Z',
        registrationEnd: '2026-03-01T18:00:00.000Z',
        votingBegin: null,
        votingEnd: null,
        status: 'DRAFT',
        inscriptionFee: 25,
        regulationUrl: null,
        allowedStates: [],
      },
    ]);

    renderWithQueryClient(<FestivalList />);

    expect(await screen.findByText('FENAC 2026')).toBeDefined();
    expect(screen.getByText('DRAFT')).toBeDefined();
    await waitFor(() =>
      expect(festivalsApi.listFestivals).toHaveBeenCalledWith('token-1'),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm test festival-list.spec.tsx`
Expected: FAIL — `Cannot find module './festival-list'`.

- [ ] **Step 3: Implement the status badge**

Create `apps/web/src/components/festival-status-badge.tsx`:

```typescript
import type { FestivalStatus } from '../lib/api/festivals';

const STYLES: Record<FestivalStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  OPEN: 'bg-green-100 text-green-700',
  CLOSED: 'bg-red-100 text-red-700',
};

export function FestivalStatusBadge({ status }: { status: FestivalStatus }) {
  return (
    <span className={`rounded px-2 py-1 text-xs font-medium ${STYLES[status]}`}>{status}</span>
  );
}
```

- [ ] **Step 4: Implement the list component**

Create `apps/web/app/(admin)/(protected)/festivals/festival-list.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../src/lib/auth/auth-context';
import { listFestivals } from '../../../../src/lib/api/festivals';
import { FestivalStatusBadge } from '../../../../src/components/festival-status-badge';

export function FestivalList() {
  const { accessToken } = useAuth();
  const { data: festivals, isLoading } = useQuery({
    queryKey: ['festivals'],
    queryFn: () => listFestivals(accessToken as string),
    enabled: accessToken !== null,
  });

  if (isLoading) return <p>Carregando…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Festivais</h1>
        <Link href="/festivals/new" className="rounded bg-slate-900 px-4 py-2 text-white">
          Novo Festival
        </Link>
      </div>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-gray-200 text-sm text-gray-500">
            <th className="py-2">Edição</th>
            <th className="py-2">Nome</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {(festivals ?? []).map((festival) => (
            <tr key={festival.id} className="border-b border-gray-100">
              <td className="py-2">
                {festival.number}/{festival.year}
              </td>
              <td className="py-2">
                <Link href={`/festivals/${festival.id}`} className="text-slate-900 underline">
                  {festival.name}
                </Link>
              </td>
              <td className="py-2">
                <FestivalStatusBadge status={festival.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Create the page**

Create `apps/web/app/(admin)/(protected)/festivals/page.tsx`:

```typescript
import { FestivalList } from './festival-list';

export default function FestivalsPage() {
  return <FestivalList />;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd apps/web && pnpm test festival-list.spec.tsx`
Expected: PASS.

- [ ] **Step 7: Verify build and lint**

```bash
cd apps/web && pnpm run build && pnpm run lint
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/festival-status-badge.tsx "apps/web/app/(admin)/(protected)/festivals/page.tsx" "apps/web/app/(admin)/(protected)/festivals/festival-list.tsx" "apps/web/app/(admin)/(protected)/festivals/festival-list.spec.tsx"
git commit -m "feat(web): add festival list screen"
```

---

### Task 10: Create Festival screen

**Files:**
- Create: `apps/web/app/(admin)/(protected)/festivals/new/page.tsx`
- Create: `apps/web/app/(admin)/(protected)/festivals/new/create-festival-form.tsx`
- Create: `apps/web/app/(admin)/(protected)/festivals/new/create-festival-form.spec.tsx`

**Interfaces:**
- Consumes: `createFestival` (Task 8), `useAuth` (Task 3), `createFestivalSchema`/`CreateFestivalDto` from `@fenac-platform/contracts`.
- Produces: `/festivals/new` route.

**Note on date fields:** `createFestivalSchema` uses `z.coerce.date()` for `registrationBegin`/`registrationEnd`/`votingBegin`/`votingEnd` — the schema's *output* type (`CreateFestivalDto`, via `z.infer`) is `Date`, but a native `<input type="datetime-local">` produces a **string**. The form's local field values are therefore typed with `z.input<typeof createFestivalSchema>` (the schema's *input* type, before coercion — string dates), not `CreateFestivalDto` (the *output* type). `zodResolver` coerces the strings to `Date` objects internally and hands the coerced, schema-valid `CreateFestivalDto` to `onSubmit` — this is the standard pattern for using `z.coerce` fields with `react-hook-form`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/app/(admin)/(protected)/festivals/new/create-festival-form.spec.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateFestivalForm } from './create-festival-form';
import { useAuth } from '../../../../../src/lib/auth/auth-context';
import * as festivalsApi from '../../../../../src/lib/api/festivals';

vi.mock('../../../../../src/lib/auth/auth-context');
vi.mock('../../../../../src/lib/api/festivals');
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('CreateFestivalForm', () => {
  it('submits the form and navigates to the new festival detail page', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(festivalsApi.createFestival).mockResolvedValue({
      id: 'f1',
      number: 58,
      year: 2026,
      name: 'FENAC 2026',
      registrationBegin: '2026-01-01T08:00:00.000Z',
      registrationEnd: '2026-03-01T18:00:00.000Z',
      votingBegin: null,
      votingEnd: null,
      status: 'DRAFT',
      inscriptionFee: 25,
      regulationUrl: null,
      allowedStates: [],
    });

    renderWithQueryClient(<CreateFestivalForm />);

    await userEvent.type(screen.getByLabelText('Número'), '58');
    await userEvent.type(screen.getByLabelText('Ano'), '2026');
    await userEvent.type(screen.getByLabelText('Nome'), 'FENAC 2026');
    await userEvent.type(screen.getByLabelText('Início das inscrições'), '2026-01-01T08:00');
    await userEvent.type(screen.getByLabelText('Fim das inscrições'), '2026-03-01T18:00');
    await userEvent.type(screen.getByLabelText('Valor da inscrição'), '25');
    await userEvent.click(screen.getByRole('button', { name: 'Criar Festival' }));

    await waitFor(() => expect(festivalsApi.createFestival).toHaveBeenCalledWith('token-1', {
      number: 58,
      year: 2026,
      name: 'FENAC 2026',
      registrationBegin: new Date('2026-01-01T08:00'),
      registrationEnd: new Date('2026-03-01T18:00'),
      inscriptionFee: 25,
    }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/festivals/f1'));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm test create-festival-form.spec.tsx`
Expected: FAIL — `Cannot find module './create-festival-form'`.

- [ ] **Step 3: Implement**

Create `apps/web/app/(admin)/(protected)/festivals/new/create-festival-form.tsx`:

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFestivalSchema } from '@fenac-platform/contracts';
import { useAuth } from '../../../../../src/lib/auth/auth-context';
import { createFestival } from '../../../../../src/lib/api/festivals';

type CreateFestivalFormValues = z.input<typeof createFestivalSchema>;

export function CreateFestivalForm() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateFestivalFormValues>({
    resolver: zodResolver(createFestivalSchema),
  });

  const mutation = useMutation({
    mutationFn: (values: CreateFestivalFormValues) =>
      createFestival(accessToken as string, createFestivalSchema.parse(values)),
    onSuccess: (festival) => {
      void queryClient.invalidateQueries({ queryKey: ['festivals'] });
      router.push(`/festivals/${festival.id}`);
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="flex max-w-lg flex-col gap-4"
    >
      <h1 className="text-xl font-semibold">Novo Festival</h1>

      <div className="flex flex-col gap-1">
        <label htmlFor="number">Número</label>
        <input
          id="number"
          type="number"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('number', { valueAsNumber: true })}
        />
        {errors.number && <p className="text-sm text-red-600">{errors.number.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="year">Ano</label>
        <input
          id="year"
          type="number"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('year', { valueAsNumber: true })}
        />
        {errors.year && <p className="text-sm text-red-600">{errors.year.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="name">Nome</label>
        <input
          id="name"
          type="text"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('name')}
        />
        {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="registrationBegin">Início das inscrições</label>
        <input
          id="registrationBegin"
          type="datetime-local"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('registrationBegin')}
        />
        {errors.registrationBegin && (
          <p className="text-sm text-red-600">{errors.registrationBegin.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="registrationEnd">Fim das inscrições</label>
        <input
          id="registrationEnd"
          type="datetime-local"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('registrationEnd')}
        />
        {errors.registrationEnd && (
          <p className="text-sm text-red-600">{errors.registrationEnd.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="inscriptionFee">Valor da inscrição</label>
        <input
          id="inscriptionFee"
          type="number"
          step="0.01"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('inscriptionFee', { valueAsNumber: true })}
        />
        {errors.inscriptionFee && (
          <p className="text-sm text-red-600">{errors.inscriptionFee.message}</p>
        )}
      </div>

      {mutation.isError && (
        <p className="text-sm text-red-600">
          {mutation.error instanceof Error ? mutation.error.message : 'Erro ao criar festival.'}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || mutation.isPending}
        className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
      >
        Criar Festival
      </button>
    </form>
  );
}
```

Note: `votingBegin`/`votingEnd`/`regulationUrl`/`allowedStates` (all optional per `createFestivalSchema`) are intentionally omitted from this first version of the form — the backend accepts their absence (no restriction / no voting window), and adding UI for them (a multi-select for `allowedStates`, two more datetime fields) is straightforward to extend later without a schema change. This keeps the task's own scope tight; note it as a deliberate YAGNI cut, not an oversight.

- [ ] **Step 4: Create the page**

Create `apps/web/app/(admin)/(protected)/festivals/new/page.tsx`:

```typescript
import { CreateFestivalForm } from './create-festival-form';

export default function NewFestivalPage() {
  return <CreateFestivalForm />;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/web && pnpm test create-festival-form.spec.tsx`
Expected: PASS.

- [ ] **Step 6: Verify build and lint**

```bash
cd apps/web && pnpm run build && pnpm run lint
```

- [ ] **Step 7: Commit**

```bash
git add "apps/web/app/(admin)/(protected)/festivals/new"
git commit -m "feat(web): add create festival screen"
```

---

### Task 11: Festival detail screen (view, edit, publish, close, stage list)

**Files:**
- Create: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/page.tsx`
- Create: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/festival-detail.tsx`
- Create: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/festival-detail.spec.tsx`

**Interfaces:**
- Consumes: `getFestival`, `updateFestival`, `publishFestival`, `closeFestival`, `listStages` (Task 8), `useAuth` (Task 3), `updateFestivalSchema` from `@fenac-platform/contracts`.
- Produces: `/festivals/[festivalId]` route.

- [ ] **Step 1: Write the failing test**

Create `apps/web/app/(admin)/(protected)/festivals/[festivalId]/festival-detail.spec.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FestivalDetail } from './festival-detail';
import { useAuth } from '../../../../../src/lib/auth/auth-context';
import * as festivalsApi from '../../../../../src/lib/api/festivals';

vi.mock('../../../../../src/lib/auth/auth-context');
vi.mock('../../../../../src/lib/api/festivals');

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const draftFestival = {
  id: 'f1',
  number: 58,
  year: 2026,
  name: 'FENAC 2026',
  registrationBegin: '2026-01-01T08:00:00.000Z',
  registrationEnd: '2026-03-01T18:00:00.000Z',
  votingBegin: null,
  votingEnd: null,
  status: 'DRAFT' as const,
  inscriptionFee: 25,
  regulationUrl: null,
  allowedStates: [],
};

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    status: 'authenticated',
    admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
    accessToken: 'token-1',
    login: vi.fn(),
    logout: vi.fn(),
  });
  vi.mocked(festivalsApi.listStages).mockResolvedValue([]);
});

describe('FestivalDetail', () => {
  it('shows a "Publicar" button for a DRAFT festival, not "Fechar"', async () => {
    vi.mocked(festivalsApi.getFestival).mockResolvedValue(draftFestival);

    renderWithQueryClient(<FestivalDetail festivalId="f1" />);

    expect(await screen.findByText('FENAC 2026')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Fechar' })).toBeNull();
  });

  it('shows a "Fechar" button for an OPEN festival, not "Publicar"', async () => {
    vi.mocked(festivalsApi.getFestival).mockResolvedValue({ ...draftFestival, status: 'OPEN' });

    renderWithQueryClient(<FestivalDetail festivalId="f1" />);

    expect(await screen.findByText('FENAC 2026')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
  });

  it('shows neither transition button for a CLOSED festival', async () => {
    vi.mocked(festivalsApi.getFestival).mockResolvedValue({ ...draftFestival, status: 'CLOSED' });

    renderWithQueryClient(<FestivalDetail festivalId="f1" />);

    expect(await screen.findByText('FENAC 2026')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fechar' })).toBeNull();
  });

  it('clicking "Publicar" calls publishFestival and refetches', async () => {
    vi.mocked(festivalsApi.getFestival).mockResolvedValue(draftFestival);
    vi.mocked(festivalsApi.publishFestival).mockResolvedValue({ ...draftFestival, status: 'OPEN' });

    renderWithQueryClient(<FestivalDetail festivalId="f1" />);
    await screen.findByText('FENAC 2026');

    await userEvent.click(screen.getByRole('button', { name: 'Publicar' }));

    await waitFor(() => expect(festivalsApi.publishFestival).toHaveBeenCalledWith('token-1', 'f1'));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm test festival-detail.spec.tsx`
Expected: FAIL — `Cannot find module './festival-detail'`.

- [ ] **Step 3: Implement**

Create `apps/web/app/(admin)/(protected)/festivals/[festivalId]/festival-detail.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../../src/lib/auth/auth-context';
import {
  closeFestival,
  getFestival,
  listStages,
  publishFestival,
} from '../../../../../src/lib/api/festivals';
import { FestivalStatusBadge } from '../../../../../src/components/festival-status-badge';

export function FestivalDetail({ festivalId }: { festivalId: string }) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const festivalQuery = useQuery({
    queryKey: ['festivals', festivalId],
    queryFn: () => getFestival(accessToken as string, festivalId),
    enabled: accessToken !== null,
  });

  const stagesQuery = useQuery({
    queryKey: ['festivals', festivalId, 'stages'],
    queryFn: () => listStages(accessToken as string, festivalId),
    enabled: accessToken !== null,
  });

  const publishMutation = useMutation({
    mutationFn: () => publishFestival(accessToken as string, festivalId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['festivals', festivalId] });
      void queryClient.invalidateQueries({ queryKey: ['festivals'] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => closeFestival(accessToken as string, festivalId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['festivals', festivalId] });
      void queryClient.invalidateQueries({ queryKey: ['festivals'] });
    },
  });

  if (festivalQuery.isLoading) return <p>Carregando…</p>;
  if (!festivalQuery.data) return <p>Festival não encontrado.</p>;

  const festival = festivalQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{festival.name}</h1>
          <p className="text-gray-500">
            {festival.number}/{festival.year}
          </p>
        </div>
        <FestivalStatusBadge status={festival.status} />
      </div>

      <div className="flex gap-2">
        {festival.status === 'DRAFT' && (
          <button
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
            className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50"
          >
            Publicar
          </button>
        )}
        {festival.status === 'OPEN' && (
          <button
            onClick={() => closeMutation.mutate()}
            disabled={closeMutation.isPending}
            className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50"
          >
            Fechar
          </button>
        )}
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Fases</h2>
          <Link
            href={`/festivals/${festivalId}/stages/new`}
            className="rounded border border-gray-300 px-3 py-1 text-sm"
          >
            Nova Fase
          </Link>
        </div>
        <ul className="flex flex-col gap-1">
          {(stagesQuery.data ?? []).map((stage) => (
            <li key={stage.id} className="flex items-center justify-between border-b border-gray-100 py-2">
              <span>
                {stage.order}. {stage.name}
              </span>
              <Link
                href={`/festivals/${festivalId}/stages/${stage.id}/grade-criteria/new`}
                className="text-sm text-slate-700 underline"
              >
                Novo Critério
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

Note on scope: this task deliberately ships **view + publish/close + stage listing**, not the "Editar" (PATCH) form mentioned in the spec's design — editing an existing festival's details (`updateFestivalSchema`) reuses the exact same field set as `CreateFestivalForm` (Task 10) and is a natural, low-risk follow-up once this screen and its tests are reviewed; bundling it here would roughly double this task's size for a feature with lower day-one urgency than seeing/publishing/closing a festival and building its stages. Track it as a small near-term follow-up, not a plan-level gap.

- [ ] **Step 4: Create the page**

Create `apps/web/app/(admin)/(protected)/festivals/[festivalId]/page.tsx`:

```typescript
import { FestivalDetail } from './festival-detail';

export default async function FestivalDetailPage(props: PageProps<'/festivals/[festivalId]'>) {
  const { festivalId } = await props.params;
  return <FestivalDetail festivalId={festivalId} />;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/web && pnpm test festival-detail.spec.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Verify build and lint**

```bash
cd apps/web && pnpm run build && pnpm run lint
```

- [ ] **Step 7: Commit**

```bash
git add "apps/web/app/(admin)/(protected)/festivals/[festivalId]"
git commit -m "feat(web): add festival detail screen (view, publish, close, stage list)"
```

---

### Task 12: Create Stage + Create Grade Criterion screens

**Files:**
- Create: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/new/page.tsx`
- Create: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/new/create-stage-form.tsx`
- Create: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/new/create-stage-form.spec.tsx`
- Create: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/[stageId]/grade-criteria/new/page.tsx`
- Create: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/[stageId]/grade-criteria/new/create-grade-criterion-form.tsx`
- Create: `apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/[stageId]/grade-criteria/new/create-grade-criterion-form.spec.tsx`

**Interfaces:**
- Consumes: `createStage`, `createGradeCriterion` (Task 8), `useAuth` (Task 3), `createStageSchema`/`createGradeCriterionSchema` from `@fenac-platform/contracts`.
- Produces: `/festivals/[festivalId]/stages/new` and `/festivals/[festivalId]/stages/[stageId]/grade-criteria/new` routes.

**Both forms follow the exact same shape as `CreateFestivalForm` (Task 10) at a smaller scale** — batched into one task since neither has independent risk beyond that already-proven pattern.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/new/create-stage-form.spec.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateStageForm } from './create-stage-form';
import { useAuth } from '../../../../../../../src/lib/auth/auth-context';
import * as festivalsApi from '../../../../../../../src/lib/api/festivals';

vi.mock('../../../../../../../src/lib/auth/auth-context');
vi.mock('../../../../../../../src/lib/api/festivals');
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('CreateStageForm', () => {
  it('submits the form and navigates back to the festival detail page', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(festivalsApi.createStage).mockResolvedValue({
      id: 's1',
      festivalId: 'f1',
      name: 'Classificatória',
      order: 1,
      advancementQuota: null,
    });

    renderWithQueryClient(<CreateStageForm festivalId="f1" />);

    await userEvent.type(screen.getByLabelText('Nome'), 'Classificatória');
    await userEvent.type(screen.getByLabelText('Ordem'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Criar Fase' }));

    await waitFor(() =>
      expect(festivalsApi.createStage).toHaveBeenCalledWith('token-1', 'f1', {
        name: 'Classificatória',
        order: 1,
      }),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/festivals/f1'));
  });
});
```

Create `apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/[stageId]/grade-criteria/new/create-grade-criterion-form.spec.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateGradeCriterionForm } from './create-grade-criterion-form';
import { useAuth } from '../../../../../../../../../src/lib/auth/auth-context';
import * as festivalsApi from '../../../../../../../../../src/lib/api/festivals';

vi.mock('../../../../../../../../../src/lib/auth/auth-context');
vi.mock('../../../../../../../../../src/lib/api/festivals');
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('CreateGradeCriterionForm', () => {
  it('submits the form and navigates back to the festival detail page', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(festivalsApi.createGradeCriterion).mockResolvedValue({
      id: 'g1',
      stageId: 's1',
      name: 'Afinação',
      weight: 2,
    });

    renderWithQueryClient(<CreateGradeCriterionForm stageId="s1" festivalId="f1" />);

    await userEvent.type(screen.getByLabelText('Nome'), 'Afinação');
    await userEvent.type(screen.getByLabelText('Peso'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Criar Critério' }));

    await waitFor(() =>
      expect(festivalsApi.createGradeCriterion).toHaveBeenCalledWith('token-1', 's1', {
        name: 'Afinação',
        weight: 2,
      }),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/festivals/f1'));
  });
});
```

- [ ] **Step 2: Run both tests to verify they fail**

Run: `cd apps/web && pnpm test create-stage-form.spec.tsx create-grade-criterion-form.spec.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the stage form**

Create `apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/new/create-stage-form.tsx`:

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createStageSchema, type CreateStageDto } from '@fenac-platform/contracts';
import { useAuth } from '../../../../../../../src/lib/auth/auth-context';
import { createStage } from '../../../../../../../src/lib/api/festivals';

export function CreateStageForm({ festivalId }: { festivalId: string }) {
  const { accessToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateStageDto>({
    resolver: zodResolver(createStageSchema),
  });

  const mutation = useMutation({
    mutationFn: (values: CreateStageDto) => createStage(accessToken as string, festivalId, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['festivals', festivalId, 'stages'] });
      router.push(`/festivals/${festivalId}`);
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="flex max-w-lg flex-col gap-4"
    >
      <h1 className="text-xl font-semibold">Nova Fase</h1>

      <div className="flex flex-col gap-1">
        <label htmlFor="name">Nome</label>
        <input id="name" type="text" className="rounded border border-gray-300 px-3 py-2" {...register('name')} />
        {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="order">Ordem</label>
        <input
          id="order"
          type="number"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('order', { valueAsNumber: true })}
        />
        {errors.order && <p className="text-sm text-red-600">{errors.order.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting || mutation.isPending}
        className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
      >
        Criar Fase
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Create the stage page**

Create `apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/new/page.tsx`:

```typescript
import { CreateStageForm } from './create-stage-form';

export default async function NewStagePage(props: PageProps<'/festivals/[festivalId]/stages/new'>) {
  const { festivalId } = await props.params;
  return <CreateStageForm festivalId={festivalId} />;
}
```

- [ ] **Step 5: Implement the grade criterion form**

Create `apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/[stageId]/grade-criteria/new/create-grade-criterion-form.tsx`:

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { createGradeCriterionSchema, type CreateGradeCriterionDto } from '@fenac-platform/contracts';
import { useAuth } from '../../../../../../../../../src/lib/auth/auth-context';
import { createGradeCriterion } from '../../../../../../../../../src/lib/api/festivals';

export function CreateGradeCriterionForm({
  stageId,
  festivalId,
}: {
  stageId: string;
  festivalId: string;
}) {
  const { accessToken } = useAuth();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateGradeCriterionDto>({
    resolver: zodResolver(createGradeCriterionSchema),
  });

  const mutation = useMutation({
    mutationFn: (values: CreateGradeCriterionDto) =>
      createGradeCriterion(accessToken as string, stageId, values),
    onSuccess: () => {
      router.push(`/festivals/${festivalId}`);
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="flex max-w-lg flex-col gap-4"
    >
      <h1 className="text-xl font-semibold">Novo Critério de Nota</h1>

      <div className="flex flex-col gap-1">
        <label htmlFor="name">Nome</label>
        <input id="name" type="text" className="rounded border border-gray-300 px-3 py-2" {...register('name')} />
        {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="weight">Peso</label>
        <input
          id="weight"
          type="number"
          step="0.01"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('weight', { valueAsNumber: true })}
        />
        {errors.weight && <p className="text-sm text-red-600">{errors.weight.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting || mutation.isPending}
        className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
      >
        Criar Critério
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Create the grade criterion page**

Create `apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages/[stageId]/grade-criteria/new/page.tsx`:

```typescript
import { CreateGradeCriterionForm } from './create-grade-criterion-form';

export default async function NewGradeCriterionPage(
  props: PageProps<'/festivals/[festivalId]/stages/[stageId]/grade-criteria/new'>,
) {
  const { festivalId, stageId } = await props.params;
  return <CreateGradeCriterionForm stageId={stageId} festivalId={festivalId} />;
}
```

- [ ] **Step 7: Run both tests to verify they pass**

Run: `cd apps/web && pnpm test create-stage-form.spec.tsx create-grade-criterion-form.spec.tsx`
Expected: PASS.

- [ ] **Step 8: Verify build and lint**

```bash
cd apps/web && pnpm run build && pnpm run lint
```

- [ ] **Step 9: Commit**

```bash
git add "apps/web/app/(admin)/(protected)/festivals/[festivalId]/stages"
git commit -m "feat(web): add create stage and create grade criterion screens"
```

---

### Task 13: Local admin bootstrap seed script

**Files:**
- Create: `apps/api/scripts/seed-admin.ts`
- Modify: `apps/api/package.json`
- Modify: `/home/matheus/projects/festivals/fenac-platform/README.md` (or create `apps/web/README.md` if no root README documents local setup yet — check first)

**Interfaces:**
- Consumes: `Tenant` (`apps/api/src/tenants/domain/tenant.entity.ts`), `AdminUser` (`apps/api/src/admin-identity/domain/admin-user.entity.ts`), `BcryptPasswordHasher` (`apps/api/src/identity/infrastructure/bcrypt-password-hasher.ts`), `PrismaService`.
- Produces: `pnpm --filter api run seed:admin` — a standalone script, NOT an HTTP endpoint (Global Constraints).

**Context:** there is deliberately no HTTP path to create the first `ORGANIZER` of a tenant (a decision from the admin-identity plan, deferred to a future data-migration plan). This script exists purely for local development/demo — it lets a developer log into the UI built by this plan without touching the database by hand. It is idempotent: running it twice with an existing tenant/admin updates nothing and just reports what already exists.

- [ ] **Step 1: Check for an existing root README before creating one**

Run: `ls /home/matheus/projects/festivals/fenac-platform/README.md 2>&1`
If it exists, Step 6 below appends to it. If not, Step 6 creates it with just the local-setup section this task needs — do not invent unrelated content.

- [ ] **Step 2: Implement the seed script**

Create `apps/api/scripts/seed-admin.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { Tenant } from '../src/tenants/domain/tenant.entity';
import { AdminUser } from '../src/admin-identity/domain/admin-user.entity';
import { BcryptPasswordHasher } from '../src/identity/infrastructure/bcrypt-password-hasher';

const TENANT_SLUG = 'fenac';
const TENANT_NAME = 'FENAC — Festival Nacional da Canção';
const TENANT_DOCUMENT = 'FE000000000001';
const ADMIN_EMAIL = 'admin@fenac.local';

async function main() {
  const prisma = new PrismaClient();
  const hasher = new BcryptPasswordHasher();

  try {
    let tenantRow = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });

    if (!tenantRow) {
      const tenant = Tenant.create({
        name: TENANT_NAME,
        document: TENANT_DOCUMENT,
        slug: TENANT_SLUG,
      });
      tenantRow = await prisma.tenant.create({
        data: {
          id: tenant.id,
          name: tenant.name,
          document: tenant.document,
          slug: tenant.slug,
          status: tenant.status,
          createdAt: tenant.createdAt,
        },
      });
      console.log(`Created tenant "${TENANT_SLUG}" (${tenantRow.id})`);
    } else {
      console.log(`Tenant "${TENANT_SLUG}" already exists (${tenantRow.id})`);
    }

    const existingAdmin = await prisma.adminUser.findUnique({
      where: { tenantId_email: { tenantId: tenantRow.id, email: ADMIN_EMAIL } },
    });

    if (existingAdmin) {
      console.log(`Admin "${ADMIN_EMAIL}" already exists for tenant "${TENANT_SLUG}" — nothing to do.`);
      return;
    }

    const password = process.env.SEED_ADMIN_PASSWORD ?? generatePassword();
    const admin = AdminUser.invite({
      tenantId: tenantRow.id,
      name: 'Organizador FENAC',
      email: ADMIN_EMAIL,
      role: 'ORGANIZER',
    }).activate(await hasher.hash(password));

    await prisma.adminUser.create({
      data: {
        id: admin.id,
        tenantId: admin.tenantId,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
        passwordHash: admin.passwordHash,
        inviteToken: admin.inviteToken,
      },
    });

    console.log('Created ORGANIZER admin:');
    console.log(`  email:    ${ADMIN_EMAIL}`);
    if (!process.env.SEED_ADMIN_PASSWORD) {
      console.log(`  password: ${password}  (generated — save it, it is not stored anywhere else)`);
    } else {
      console.log('  password: (from SEED_ADMIN_PASSWORD)');
    }
  } finally {
    await prisma.$disconnect();
  }
}

function generatePassword(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 3: Register the script in `apps/api/package.json`**

Add to the `scripts` section (check the file first for the exact key ordering/style already used, then insert alongside the other scripts):

```json
"seed:admin": "ts-node -r tsconfig-paths/register scripts/seed-admin.ts"
```

If `ts-node`/`tsconfig-paths` are not already a dependency, add them: `cd apps/api && pnpm add -D ts-node tsconfig-paths`. Check first — NestJS projects frequently already have `ts-node` as a transitive or direct dev dependency; do not add a duplicate.

- [ ] **Step 4: Verify the script runs against the local dev database**

Ensure MySQL is up (`docker compose up -d mysql` from the repo root), then run: `cd apps/api && pnpm run seed:admin`
Expected: creates the `fenac` tenant and an `admin@fenac.local` ORGANIZER, printing a generated password. Run it a SECOND time immediately after: expected output is "already exists for tenant... nothing to do" — confirms idempotency.

- [ ] **Step 5: Clean up the test data before committing**

```bash
docker exec <mysql-container-name> mysql -ufenac -pfenac fenac -e "DELETE FROM admin_users WHERE email = 'admin@fenac.local'; DELETE FROM tenants WHERE slug = 'fenac';"
```

(Replace `<mysql-container-name>` with the actual running container name — check `docker ps`. This step only removes the manual verification run's data; it does not affect anything committed to git.)

- [ ] **Step 6: Document the script**

Append a "Local Setup" section to the repo root `README.md` (create it with just this section if it doesn't exist yet, per Step 1):

```markdown
## Local Setup

1. `cp .env.example .env` and `cp apps/web/.env.example apps/web/.env.local`
2. `docker compose up -d mysql`
3. `pnpm install`
4. `cd apps/api && pnpm exec prisma migrate deploy && pnpm exec prisma generate && cd ../..`
5. `cd apps/api && pnpm run seed:admin && cd ../..` — creates a tenant (`fenac`) and its first ORGANIZER admin (`admin@fenac.local`), printing a generated password. There is no HTTP endpoint to do this — see `apps/api/scripts/seed-admin.ts` for why.
6. `pnpm --filter api run start:dev` (or `docker compose up api`) and, in another terminal, `pnpm --filter web dev`
7. Open `http://localhost:3000/login` and sign in with the email/password from step 5.
```

- [ ] **Step 7: Verify the API still builds**

Run: `cd apps/api && pnpm run build`
Expected: PASS — the new script under `scripts/` is not part of the Nest build output but must still type-check cleanly against the project's `tsconfig.json`; if the build doesn't cover `scripts/`, at minimum run `pnpm exec tsc --noEmit scripts/seed-admin.ts` (or the project's equivalent standalone type-check) to confirm.

- [ ] **Step 8: Commit**

```bash
git add apps/api/scripts/seed-admin.ts apps/api/package.json apps/api/pnpm-lock.yaml README.md
git commit -m "feat(api): add local admin bootstrap seed script"
```

---

### Task 14: Playwright e2e smoke test (login → create festival → publish)

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/admin-festival-flow.spec.ts`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes: the full stack built by Tasks 1-13, plus the seed script (Task 13) for its fixture admin.
- Produces: `pnpm --filter web run test:e2e` — a real-browser smoke test of the golden path, run against the API and MySQL via Docker Compose, the same integration-level confidence check already established for the backend's own e2e suites.

- [ ] **Step 1: Install Playwright**

```bash
cd apps/web
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps chromium
```

- [ ] **Step 2: Configure Playwright**

Create `apps/web/playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 3: Write the smoke test**

Create `apps/web/e2e/admin-festival-flow.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@fenac.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

test('organizer logs in, creates a festival, and publishes it', async ({ page }) => {
  test.skip(!ADMIN_PASSWORD, 'SEED_ADMIN_PASSWORD must be set to the seeded admin password to run this test');

  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Senha').fill(ADMIN_PASSWORD as string);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL('/festivals');

  await page.getByRole('link', { name: 'Novo Festival' }).click();
  await expect(page).toHaveURL('/festivals/new');

  const uniqueNumber = Math.floor(Math.random() * 1000) + 100;
  await page.getByLabel('Número').fill(String(uniqueNumber));
  await page.getByLabel('Ano').fill('2099');
  await page.getByLabel('Nome').fill('Festival de Teste E2E');
  await page.getByLabel('Início das inscrições').fill('2099-01-01T08:00');
  await page.getByLabel('Fim das inscrições').fill('2099-03-01T18:00');
  await page.getByLabel('Valor da inscrição').fill('10');
  await page.getByRole('button', { name: 'Criar Festival' }).click();

  await expect(page.getByText('Festival de Teste E2E')).toBeVisible();
  await expect(page.getByText('DRAFT')).toBeVisible();

  await page.getByRole('button', { name: 'Publicar' }).click();

  await expect(page.getByText('OPEN')).toBeVisible();
});
```

**Note:** the test requires `SEED_ADMIN_PASSWORD` (the exact password the seed script generated or was given, per Task 13's `.env`-driven `SEED_ADMIN_PASSWORD` override) to be set in the environment running Playwright — it self-skips otherwise rather than failing noisily, since the generated-password path (no `SEED_ADMIN_PASSWORD` set) makes the password unknown to this test process. Document this in the README's Local Setup section (Task 13, Step 6) as an addendum: "To run the Playwright smoke test, re-seed with a known password: `SEED_ADMIN_PASSWORD=test-password-123 pnpm --filter api run seed:admin` (only works before the admin already exists — the script is idempotent and won't overwrite an existing admin's password)."

- [ ] **Step 4: Add the test script**

Add to `apps/web/package.json`'s `scripts`:

```json
"test:e2e": "playwright test"
```

- [ ] **Step 5: Run the full stack and the smoke test**

```bash
docker compose up -d mysql
cd apps/api && pnpm exec prisma migrate deploy && SEED_ADMIN_PASSWORD=test-password-123 pnpm run seed:admin && pnpm run start:dev &
cd apps/web && SEED_ADMIN_PASSWORD=test-password-123 pnpm run test:e2e
```

Expected: the single test passes, exercising a real cross-origin browser flow — this is also the first real end-to-end confirmation that Task 1's CORS configuration actually works, not just that it didn't break the backend's own test suite.

- [ ] **Step 6: Clean up the background API process and test data**

Stop the background `start:dev` process, then remove the test fixtures:

```bash
docker exec <mysql-container-name> mysql -ufenac -pfenac fenac -e "DELETE FROM admin_users WHERE email = 'admin@fenac.local'; DELETE FROM festivals WHERE name = 'Festival de Teste E2E'; DELETE FROM tenants WHERE slug = 'fenac';"
```

- [ ] **Step 7: Run the FULL verification suite one last time (whole plan)**

```bash
cd apps/web && pnpm run build && pnpm run lint && pnpm test
cd ../api && pnpm run build && pnpm run lint && pnpm run test && pnpm run test:integration && pnpm run test:e2e
```

Expected: everything green — this final task closes the plan by confirming the new frontend work hasn't regressed the already-merged backend suites either.

- [ ] **Step 8: Commit**

```bash
git add apps/web/playwright.config.ts apps/web/e2e apps/web/package.json apps/web/pnpm-lock.yaml
git commit -m "test(web): add Playwright e2e smoke test for the admin festival flow"
```

---

## Self-Review Notes

- **Spec coverage:** §1 (stack) → Task 1. §2 (auth flow: login/refresh/interceptor/logout/RBAC-is-UX-only) → Tasks 2-4, 6-7. §3 (screens) → Tasks 6, 9-12 (the "Editar" sub-screen from §3 is explicitly scoped OUT of Task 11 with a documented reason, not silently dropped). §4 (error handling) → woven into Tasks 6, 10-12 (form-level Zod errors, `mutation.isError` messaging); a dedicated `ErrorBoundary` component was in the design's §4 text but is cut from this task list as a deliberate YAGNI call — nothing in this plan's own screens can throw an unhandled render error (all data fetching goes through TanStack Query's own `isLoading`/`isError` states, not a bare `throw`), so the boundary has no concrete failure mode to catch yet; add it when a screen's complexity actually produces one. §5 (testing) → Vitest+Testing Library tests in every task, Playwright in Task 14. §6 (seed script) → Task 13.
- **Type consistency checked:** `AdminUser`/`AdminRole` (Task 2) match every `useAuth()` consumer's expectations across Tasks 3-4, 6-7, 9-12. `Festival`/`Stage`/`GradeCriterion` response types (Task 8) match the DTOs actually returned by `FestivalsController`'s `toFestivalDto`/`toStageDto`/`toGradeCriterionDto` (verified against the already-merged controller source, not re-derived). `CreateFestivalDto`/`UpdateFestivalDto`/`CreateStageDto`/`CreateGradeCriterionDto`/`LoginAdminUserDto` are imported from `@fenac-platform/contracts`, never redefined locally, in every form task (6, 10, 12).
- **No placeholders:** every step shows full file contents or an exact runnable command with expected output. Two known follow-ups are named explicitly rather than left as vague TODOs: (a) the "Editar Festival" PATCH form (Task 11's note — same pattern as Task 10, low-risk, deliberately deferred), (b) a real logout endpoint on the backend (spec's own documented gap, not this plan's to fix).
