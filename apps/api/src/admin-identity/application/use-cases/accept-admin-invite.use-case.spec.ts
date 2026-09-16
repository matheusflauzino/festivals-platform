import { AcceptAdminInviteUseCase } from './accept-admin-invite.use-case';
import { InviteAdminUserUseCase } from './invite-admin-user.use-case';
import { InMemoryAdminUsersRepository } from '../../infrastructure/in-memory-admin-users.repository';
import { InvalidInviteError } from '../../domain/invalid-invite.error';
import { PasswordHasherPort } from '../../../identity/application/ports/password-hasher.port';

class FakePasswordHasher implements PasswordHasherPort {
  hash(plain: string): Promise<string> {
    return Promise.resolve(`hashed:${plain}`);
  }
  compare(plain: string, hash: string): Promise<boolean> {
    return Promise.resolve(hash === `hashed:${plain}`);
  }
}

describe('AcceptAdminInviteUseCase', () => {
  it('activates the admin for a valid invite token', async () => {
    const repository = new InMemoryAdminUsersRepository();
    const hasher = new FakePasswordHasher();
    const invited = await new InviteAdminUserUseCase(repository).execute({
      tenantId: 'tenant-1',
      name: 'Carlos Souza',
      email: 'carlos@example.com',
      role: 'JUDGE',
    });

    const useCase = new AcceptAdminInviteUseCase(repository, hasher);
    const activated = await useCase.execute({
      token: invited.inviteToken as string,
      password: 'a-strong-password',
    });

    expect(activated.status).toBe('ACTIVE');
    expect(activated.passwordHash).toBe('hashed:a-strong-password');
  });

  it('rejects an unknown token', async () => {
    const repository = new InMemoryAdminUsersRepository();
    const useCase = new AcceptAdminInviteUseCase(
      repository,
      new FakePasswordHasher(),
    );

    await expect(
      useCase.execute({
        token: 'does-not-exist',
        password: 'a-strong-password',
      }),
    ).rejects.toThrow(InvalidInviteError);
  });

  it('rejects reusing an already-accepted token', async () => {
    const repository = new InMemoryAdminUsersRepository();
    const hasher = new FakePasswordHasher();
    const invited = await new InviteAdminUserUseCase(repository).execute({
      tenantId: 'tenant-1',
      name: 'Carlos Souza',
      email: 'carlos@example.com',
      role: 'JUDGE',
    });

    const useCase = new AcceptAdminInviteUseCase(repository, hasher);
    const token = invited.inviteToken as string;
    await useCase.execute({ token, password: 'first-password' });

    await expect(
      useCase.execute({ token, password: 'second-password' }),
    ).rejects.toThrow(InvalidInviteError);
  });
});
