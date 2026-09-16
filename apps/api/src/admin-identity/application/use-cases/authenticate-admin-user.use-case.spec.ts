import { AuthenticateAdminUserUseCase } from './authenticate-admin-user.use-case';
import { InviteAdminUserUseCase } from './invite-admin-user.use-case';
import { AcceptAdminInviteUseCase } from './accept-admin-invite.use-case';
import { InMemoryAdminUsersRepository } from '../../infrastructure/in-memory-admin-users.repository';
import { InvalidAdminCredentialsError } from '../../domain/invalid-admin-credentials.error';
import { PasswordHasherPort } from '../../../identity/application/ports/password-hasher.port';

class FakePasswordHasher implements PasswordHasherPort {
  hash(plain: string): Promise<string> {
    return Promise.resolve(`hashed:${plain}`);
  }
  compare(plain: string, hash: string): Promise<boolean> {
    return Promise.resolve(hash === `hashed:${plain}`);
  }
}

async function inviteAndActivate(
  repository: InMemoryAdminUsersRepository,
  hasher: PasswordHasherPort,
) {
  const invited = await new InviteAdminUserUseCase(repository).execute({
    tenantId: 'tenant-1',
    name: 'Carlos Souza',
    email: 'carlos@example.com',
    role: 'ORGANIZER',
  });
  await new AcceptAdminInviteUseCase(repository, hasher).execute({
    token: invited.inviteToken as string,
    password: 'correct-password',
  });
}

describe('AuthenticateAdminUserUseCase', () => {
  it('authenticates an active admin with the correct password', async () => {
    const repository = new InMemoryAdminUsersRepository();
    const hasher = new FakePasswordHasher();
    await inviteAndActivate(repository, hasher);

    const useCase = new AuthenticateAdminUserUseCase(repository, hasher);
    const admin = await useCase.execute({
      tenantId: 'tenant-1',
      email: 'carlos@example.com',
      password: 'correct-password',
    });

    expect(admin.email).toBe('carlos@example.com');
  });

  it('rejects the wrong password', async () => {
    const repository = new InMemoryAdminUsersRepository();
    const hasher = new FakePasswordHasher();
    await inviteAndActivate(repository, hasher);

    const useCase = new AuthenticateAdminUserUseCase(repository, hasher);
    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        email: 'carlos@example.com',
        password: 'wrong',
      }),
    ).rejects.toThrow(InvalidAdminCredentialsError);
  });

  it('rejects an unknown email', async () => {
    const repository = new InMemoryAdminUsersRepository();
    const useCase = new AuthenticateAdminUserUseCase(
      repository,
      new FakePasswordHasher(),
    );

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        email: 'nobody@example.com',
        password: 'x',
      }),
    ).rejects.toThrow(InvalidAdminCredentialsError);
  });

  it('rejects a still-pending admin (has not accepted the invite yet)', async () => {
    const repository = new InMemoryAdminUsersRepository();
    await new InviteAdminUserUseCase(repository).execute({
      tenantId: 'tenant-1',
      name: 'Carlos Souza',
      email: 'carlos@example.com',
      role: 'ORGANIZER',
    });

    const useCase = new AuthenticateAdminUserUseCase(
      repository,
      new FakePasswordHasher(),
    );
    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        email: 'carlos@example.com',
        password: 'anything',
      }),
    ).rejects.toThrow(InvalidAdminCredentialsError);
  });
});
