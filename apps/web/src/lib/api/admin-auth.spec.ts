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
