import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../domain/user.entity';
import { USERS_REPOSITORY, UsersRepositoryPort } from '../ports/users-repository.port';
import { PASSWORD_HASHER, PasswordHasherPort } from '../ports/password-hasher.port';

export interface AuthenticateUserInput {
  tenantId: string;
  identifier: string;
  password: string;
}

@Injectable()
export class AuthenticateUserUseCase {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(input: AuthenticateUserInput): Promise<User> {
    const user = await this.usersRepository.findByEmailOrCpf(
      input.tenantId,
      input.identifier,
    );
    if (!user) {
      throw new Error('invalid credentials');
    }

    const passwordMatches = await this.passwordHasher.compare(
      input.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new Error('invalid credentials');
    }

    return user;
  }
}
