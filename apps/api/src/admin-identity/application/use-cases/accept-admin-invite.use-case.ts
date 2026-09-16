import { Inject, Injectable } from '@nestjs/common';
import { AdminUser } from '../../domain/admin-user.entity';
import { InvalidInviteError } from '../../domain/invalid-invite.error';
import { ADMIN_USERS_REPOSITORY } from '../ports/admin-users-repository.port';
import type { AdminUsersRepositoryPort } from '../ports/admin-users-repository.port';
import { PASSWORD_HASHER } from '../../../identity/application/ports/password-hasher.port';
import type { PasswordHasherPort } from '../../../identity/application/ports/password-hasher.port';

export interface AcceptAdminInviteInput {
  token: string;
  password: string;
}

@Injectable()
export class AcceptAdminInviteUseCase {
  constructor(
    @Inject(ADMIN_USERS_REPOSITORY)
    private readonly adminUsersRepository: AdminUsersRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(input: AcceptAdminInviteInput): Promise<AdminUser> {
    const admin = await this.adminUsersRepository.findByInviteToken(
      input.token,
    );
    if (!admin || admin.status !== 'PENDING') {
      throw new InvalidInviteError();
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const activated = admin.activate(passwordHash);
    await this.adminUsersRepository.save(activated);
    return activated;
  }
}
