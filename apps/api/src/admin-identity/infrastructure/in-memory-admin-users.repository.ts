import { AdminUser } from '../domain/admin-user.entity';
import { AdminUsersRepositoryPort } from '../application/ports/admin-users-repository.port';

export class InMemoryAdminUsersRepository implements AdminUsersRepositoryPort {
  private readonly admins = new Map<string, AdminUser>();

  save(admin: AdminUser): Promise<void> {
    this.admins.set(admin.id, admin);
    return Promise.resolve();
  }

  findByEmail(tenantId: string, email: string): Promise<AdminUser | null> {
    for (const admin of this.admins.values()) {
      if (admin.tenantId === tenantId && admin.email === email) {
        return Promise.resolve(admin);
      }
    }
    return Promise.resolve(null);
  }

  findByInviteToken(token: string): Promise<AdminUser | null> {
    for (const admin of this.admins.values()) {
      if (admin.inviteToken === token) return Promise.resolve(admin);
    }
    return Promise.resolve(null);
  }

  findById(tenantId: string, id: string): Promise<AdminUser | null> {
    const admin = this.admins.get(id);
    return Promise.resolve(admin && admin.tenantId === tenantId ? admin : null);
  }
}
