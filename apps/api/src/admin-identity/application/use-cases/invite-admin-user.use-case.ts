import { Inject, Injectable } from '@nestjs/common';
import {
  AdminUser,
  InviteAdminUserInput,
} from '../../domain/admin-user.entity';
import { AdminConflictError } from '../../domain/admin-conflict.error';
import { ADMIN_USERS_REPOSITORY } from '../ports/admin-users-repository.port';
import type { AdminUsersRepositoryPort } from '../ports/admin-users-repository.port';

@Injectable()
export class InviteAdminUserUseCase {
  constructor(
    @Inject(ADMIN_USERS_REPOSITORY)
    private readonly adminUsersRepository: AdminUsersRepositoryPort,
  ) {}

  async execute(input: InviteAdminUserInput): Promise<AdminUser> {
    const existing = await this.adminUsersRepository.findByEmail(
      input.tenantId,
      input.email,
    );
    if (existing) {
      throw new AdminConflictError();
    }

    const admin = AdminUser.invite(input);
    await this.adminUsersRepository.save(admin);
    return admin;
  }
}
