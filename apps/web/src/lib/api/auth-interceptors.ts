import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { refreshRequest } from './admin-auth';

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

interface AuthInterceptorHandlers {
  getAccessToken: () => string | null;
  onTokenRefreshed: (token: string) => void;
  onAuthFailure: () => void;
}

// Axios runs request interceptors in reverse registration order by default
// (legacyInterceptorReqResOrdering), so a stale registration left in place
// would win over a fresh one. Track the ids per client instance and eject
// the previous pair before installing a new one, so re-registering (e.g. on
// every effect run, or in tests) always leaves exactly one active pair using
// the latest handlers.
const registeredInterceptors = new WeakMap<AxiosInstance, { request: number; response: number }>();

export function registerAuthInterceptors(
  client: AxiosInstance,
  handlers: AuthInterceptorHandlers,
): void {
  const existing = registeredInterceptors.get(client);
  if (existing) {
    client.interceptors.request.eject(existing.request);
    client.interceptors.response.eject(existing.response);
  }

  const requestInterceptorId = client.interceptors.request.use((config) => {
    const token = handlers.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  const responseInterceptorId = client.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (!axios.isAxiosError(error)) {
        return Promise.reject(error);
      }

      // Adapters/mocks (e.g. axios-mock-adapter) can construct their errors from a
      // different resolved copy of the axios package than the one imported here
      // (Node's CJS "require" vs ESM "import" conditions can point at different
      // files), so `error` may pass the `isAxiosError` duck-typing check above yet
      // fail `instanceof AxiosError` for callers checking against *this* module's
      // import. Normalize to this module's own AxiosError class so identity is
      // consistent regardless of where the error originated. (Cast through
      // `unknown` first: TS otherwise "proves" the `instanceof` check below is
      // always true from the `isAxiosError` narrowing and types the else branch
      // as `never`, even though a cross-realm instance genuinely fails it.)
      const rawError = error as unknown;
      const normalizedError =
        rawError instanceof AxiosError
          ? rawError
          : AxiosError.from(error, error.code, error.config, error.request, error.response);

      const config = normalizedError.config as RetriableRequestConfig | undefined;
      const isUnauthorized = normalizedError.response?.status === 401;
      const alreadyRetried = config?._retried === true;
      // The refresh endpoint itself is called through this same apiClient
      // instance, so it hits this very interceptor. If the failing request
      // IS the refresh request (its URL path ends with /admin/refresh — the
      // backend returns 401 whenever the refresh cookie is missing, invalid,
      // or expired, which is the common case for first-time visitors and
      // anyone whose session lapsed), attempting another refresh-and-retry
      // here would call refreshRequest() again, which 401s again, forever.
      // Bail out immediately instead of recursing. Checking only the path
      // suffix (not an exact URL) keeps this robust to base URL / tenant
      // slug changes.
      const isRefreshRequest = (config?.url ?? '').split('?')[0].endsWith('/admin/refresh');

      if (!isUnauthorized || alreadyRetried || !config || isRefreshRequest) {
        return Promise.reject(normalizedError);
      }

      try {
        const { accessToken } = await refreshRequest();
        handlers.onTokenRefreshed(accessToken);
        config._retried = true;
        config.headers.Authorization = `Bearer ${accessToken}`;
        return client(config);
      } catch {
        // The refresh itself failed — surface the original 401 to the
        // caller (not the internal refresh error) and let onAuthFailure
        // (wired to logout()) handle the session teardown as a side effect.
        handlers.onAuthFailure();
        return Promise.reject(normalizedError);
      }
    },
  );

  registeredInterceptors.set(client, {
    request: requestInterceptorId,
    response: responseInterceptorId,
  });
}
