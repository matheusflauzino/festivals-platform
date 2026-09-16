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
