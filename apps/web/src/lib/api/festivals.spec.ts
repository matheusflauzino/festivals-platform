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
