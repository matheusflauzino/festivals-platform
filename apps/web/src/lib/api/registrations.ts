import type { CreateRegistrationDto } from '@fenac-platform/contracts';
import { apiClient } from './client';

const tenantSlug = process.env.NEXT_PUBLIC_TENANT_SLUG;

export interface Registration {
  id: string;
  festivalId: string;
  festivalNumber: number | null;
  festivalYear: number | null;
  festivalName: string | null;
  participantName: string;
  participantEmail: string;
  participantCpf: string;
  songName: string;
  performers: string;
  musicComposer: string | null;
  lyricsComposer: string | null;
  videoUrl: string | null;
  createdAt: string;
}

function authHeader(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export async function listRegistrations(token: string): Promise<Registration[]> {
  const response = await apiClient.get<Registration[]>(
    `/tenants/${tenantSlug}/registrations`,
    authHeader(token),
  );
  return response.data;
}

export async function createRegistration(
  token: string,
  festivalId: string,
  body: CreateRegistrationDto,
): Promise<Registration> {
  const response = await apiClient.post<Registration>(
    `/tenants/${tenantSlug}/festivals/${festivalId}/registrations`,
    body,
    authHeader(token),
  );
  return response.data;
}
