import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../domain/user.entity';
import { UserConflictError } from '../../domain/user-conflict.error';
import { USERS_REPOSITORY } from '../ports/users-repository.port';
import type { UsersRepositoryPort } from '../ports/users-repository.port';
import { PASSWORD_HASHER } from '../ports/password-hasher.port';
import type { PasswordHasherPort } from '../ports/password-hasher.port';

export interface RegisterUserInput {
  tenantId: string;
  name: string;
  email: string;
  cpf: string;
  password: string;
}

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(input: RegisterUserInput): Promise<User> {
    const existingByEmail = await this.usersRepository.findByEmailOrCpf(
      input.tenantId,
      input.email,
    );
    const existingByCpf = await this.usersRepository.findByEmailOrCpf(
      input.tenantId,
      input.cpf,
    );
    if (existingByEmail || existingByCpf) {
      throw new UserConflictError(existingByEmail ? 'email' : 'cpf');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = User.create({
      tenantId: input.tenantId,
      name: input.name,
      email: input.email,
      cpf: input.cpf,
      passwordHash,
    });

    await this.usersRepository.save(user);
    return user;
  }
}
