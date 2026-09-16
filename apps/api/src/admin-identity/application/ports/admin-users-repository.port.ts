import { AdminUser } from '../../domain/admin-user.entity';

export interface AdminUsersRepositoryPort {
  save(admin: AdminUser): Promise<void>;
  findByEmail(tenantId: string, email: string): Promise<AdminUser | null>;
  findByInviteToken(token: string): Promise<AdminUser | null>;
  findById(tenantId: string, id: string): Promise<AdminUser | null>;
}

export const ADMIN_USERS_REPOSITORY = Symbol('ADMIN_USERS_REPOSITORY');
