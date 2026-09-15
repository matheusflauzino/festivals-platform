import { RegisterUserUseCase } from './register-user.use-case';
import { InMemoryUsersRepository } from '../../infrastructure/in-memory-users.repository';
import { PasswordHasherPort } from '../ports/password-hasher.port';

class FakePasswordHasher implements PasswordHasherPort {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }
  async compare(plain: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plain}`;
  }
}

describe('RegisterUserUseCase', () => {
  it('registers a user with a hashed password', async () => {
    const repository = new InMemoryUsersRepository();
    const useCase = new RegisterUserUseCase(repository, new FakePasswordHasher());

    const user = await useCase.execute({
      tenantId: 'tenant-1',
      name: 'Ana Silva',
      email: 'ana@example.com',
      cpf: '12345678901',
      password: 'plaintext-password',
    });

    expect(user.email).toBe('ana@example.com');
    expect(user.passwordHash).toBe('hashed:plaintext-password');
    await expect(
      repository.findByEmailOrCpf('tenant-1', 'ana@example.com'),
    ).resolves.toEqual(user);
  });

  it('rejects a duplicate email within the same tenant', async () => {
    const repository = new InMemoryUsersRepository();
    const useCase = new RegisterUserUseCase(repository, new FakePasswordHasher());

    await useCase.execute({
      tenantId: 'tenant-1',
      name: 'Ana Silva',
      email: 'ana@example.com',
      cpf: '12345678901',
      password: 'pw',
    });

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        name: 'Outra Pessoa',
        email: 'ana@example.com',
        cpf: '10987654321',
        password: 'pw2',
      }),
    ).rejects.toThrow('email or cpf already registered');
  });

  it('allows the same email in a different tenant', async () => {
    const repository = new InMemoryUsersRepository();
    const useCase = new RegisterUserUseCase(repository, new FakePasswordHasher());

    await useCase.execute({
      tenantId: 'tenant-1',
      name: 'Ana Silva',
      email: 'ana@example.com',
      cpf: '12345678901',
      password: 'pw',
    });

    await expect(
      useCase.execute({
        tenantId: 'tenant-2',
        name: 'Ana Silva',
        email: 'ana@example.com',
        cpf: '12345678901',
        password: 'pw',
      }),
    ).resolves.toBeDefined();
  });
});
