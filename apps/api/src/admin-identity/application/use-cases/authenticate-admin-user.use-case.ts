import { Inject, Injectable } from '@nestjs/common';
import { AdminUser } from '../../domain/admin-user.entity';
import { InvalidAdminCredentialsError } from '../../domain/invalid-admin-credentials.error';
import { ADMIN_USERS_REPOSITORY } from '../ports/admin-users-repository.port';
import type { AdminUsersRepositoryPort } from '../ports/admin-users-repository.port';
import { PASSWORD_HASHER } from '../../../identity/application/ports/password-hasher.port';
import type { PasswordHasherPort } from '../../../identity/application/ports/password-hasher.port';

export interface AuthenticateAdminUserInput {
  tenantId: string;
  email: string;
  password: string;
}

@Injectable()
export class AuthenticateAdminUserUseCase {
  constructor(
    @Inject(ADMIN_USERS_REPOSITORY)
    private readonly adminUsersRepository: AdminUsersRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(input: AuthenticateAdminUserInput): Promise<AdminUser> {
    const admin = await this.adminUsersRepository.findByEmail(
      input.tenantId,
      input.email,
    );
    if (!admin || admin.status !== 'ACTIVE' || !admin.passwordHash) {
      throw new InvalidAdminCredentialsError();
    }

    const passwordMatches = await this.passwordHasher.compare(
      input.password,
      admin.passwordHash,
    );
    if (!passwordMatches) {
      throw new InvalidAdminCredentialsError();
    }

    return admin;
  }
}
