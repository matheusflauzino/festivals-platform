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
