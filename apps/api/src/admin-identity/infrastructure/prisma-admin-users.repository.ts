import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantScopedRepository } from '../../common/repositories/tenant-scoped.repository';
import { AdminUser, AdminUserProps } from '../domain/admin-user.entity';
import { AdminUsersRepositoryPort } from '../application/ports/admin-users-repository.port';

@Injectable()
export class PrismaAdminUsersRepository
  extends TenantScopedRepository
  implements AdminUsersRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async save(admin: AdminUser): Promise<void> {
    await this.prisma.adminUser.upsert({
      where: { id: admin.id },
      create: {
        id: admin.id,
        tenantId: admin.tenantId,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
        passwordHash: admin.passwordHash,
        inviteToken: admin.inviteToken,
        createdAt: admin.createdAt,
      },
      update: {
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
        passwordHash: admin.passwordHash,
        inviteToken: admin.inviteToken,
      },
    });
  }

  async findByEmail(
    tenantId: string,
    email: string,
  ): Promise<AdminUser | null> {
    const row = await this.prisma.adminUser.findFirst({
      where: this.tenantScoped(tenantId, { email }),
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async findByInviteToken(token: string): Promise<AdminUser | null> {
    const row = await this.prisma.adminUser.findUnique({
      where: { inviteToken: token },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async findById(tenantId: string, id: string): Promise<AdminUser | null> {
    const row = await this.prisma.adminUser.findFirst({
      where: this.tenantScoped(tenantId, { id }),
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    name: string;
    email: string;
    role: string;
    status: string;
    passwordHash: string | null;
    inviteToken: string | null;
    createdAt: Date;
  }): AdminUser {
    return AdminUser.restore({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      email: row.email,
      role: row.role as AdminUserProps['role'],
      status: row.status as AdminUserProps['status'],
      passwordHash: row.passwordHash,
      inviteToken: row.inviteToken,
      createdAt: row.createdAt,
    });
  }
}
