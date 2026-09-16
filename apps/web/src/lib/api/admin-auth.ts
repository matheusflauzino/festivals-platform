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
