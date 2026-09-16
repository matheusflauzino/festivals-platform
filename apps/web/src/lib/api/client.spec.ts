import { describe, expect, it } from 'vitest';
import { apiClient } from './client';

describe('apiClient', () => {
  it('is configured with the API base URL and credentials enabled', () => {
    expect(apiClient.defaults.baseURL).toBe('http://localhost:3001');
    expect(apiClient.defaults.withCredentials).toBe(true);
  });
});
