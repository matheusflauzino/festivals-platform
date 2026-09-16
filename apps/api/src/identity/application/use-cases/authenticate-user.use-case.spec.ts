import { AuthenticateUserUseCase } from './authenticate-user.use-case';
import { RegisterUserUseCase } from './register-user.use-case';
import { InMemoryUsersRepository } from '../../infrastructure/in-memory-users.repository';
import { PasswordHasherPort } from '../ports/password-hasher.port';
import { InvalidCredentialsError } from '../../domain/invalid-credentials.error';

class FakePasswordHasher implements PasswordHasherPort {
  hash(plain: string): Promise<string> {
    return Promise.resolve(`hashed:${plain}`);
  }
  compare(plain: string, hash: string): Promise<boolean> {
    return Promise.resolve(hash === `hashed:${plain}`);
  }
}

describe('AuthenticateUserUseCase', () => {
  it('authenticates by email with the correct password', async () => {
    const repository = new InMemoryUsersRepository();
    const hasher = new FakePasswordHasher();
    await new RegisterUserUseCase(repository, hasher).execute({
      tenantId: 'tenant-1',
      name: 'Ana Silva',
      email: 'ana@example.com',
      cpf: '12345678901',
      password: 'correct-password',
    });

    const useCase = new AuthenticateUserUseCase(repository, hasher);
    const user = await useCase.execute({
      tenantId: 'tenant-1',
      identifier: 'ana@example.com',
      password: 'correct-password',
    });

    expect(user.email).toBe('ana@example.com');
  });

  it('authenticates by cpf with the correct password', async () => {
    const repository = new InMemoryUsersRepository();
    const hasher = new FakePasswordHasher();
    await new RegisterUserUseCase(repository, hasher).execute({
      tenantId: 'tenant-1',
      name: 'Ana Silva',
      email: 'ana@example.com',
      cpf: '12345678901',
      password: 'correct-password',
    });

    const useCase = new AuthenticateUserUseCase(repository, hasher);
    const user = await useCase.execute({
      tenantId: 'tenant-1',
      identifier: '12345678901',
      password: 'correct-password',
    });

    expect(user.cpf).toBe('12345678901');
  });

  it('rejects the wrong password', async () => {
    const repository = new InMemoryUsersRepository();
    const hasher = new FakePasswordHasher();
    await new RegisterUserUseCase(repository, hasher).execute({
      tenantId: 'tenant-1',
      name: 'Ana Silva',
      email: 'ana@example.com',
      cpf: '12345678901',
      password: 'correct-password',
    });

    const useCase = new AuthenticateUserUseCase(repository, hasher);
    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        identifier: 'ana@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrow('invalid credentials');
    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        identifier: 'ana@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('rejects an unknown identifier', async () => {
    const repository = new InMemoryUsersRepository();
    const hasher = new FakePasswordHasher();
    const useCase = new AuthenticateUserUseCase(repository, hasher);

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        identifier: 'nobody@example.com',
        password: 'anything',
      }),
    ).rejects.toThrow('invalid credentials');
    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        identifier: 'nobody@example.com',
        password: 'anything',
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });
});
