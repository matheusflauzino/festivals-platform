import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../domain/user.entity';
import { InvalidCredentialsError } from '../../domain/invalid-credentials.error';
import { USERS_REPOSITORY } from '../ports/users-repository.port';
import type { UsersRepositoryPort } from '../ports/users-repository.port';
import { PASSWORD_HASHER } from '../ports/password-hasher.port';
import type { PasswordHasherPort } from '../ports/password-hasher.port';

export interface AuthenticateUserInput {
  tenantId: string;
  identifier: string;
  password: string;
}

@Injectable()
export class AuthenticateUserUseCase {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(input: AuthenticateUserInput): Promise<User> {
    const user = await this.usersRepository.findByEmailOrCpf(
      input.tenantId,
      input.identifier,
    );
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await this.passwordHasher.compare(
      input.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    return user;
  }
}
