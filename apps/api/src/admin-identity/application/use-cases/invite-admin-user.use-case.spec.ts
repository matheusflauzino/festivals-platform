import { InviteAdminUserUseCase } from './invite-admin-user.use-case';
import { InMemoryAdminUsersRepository } from '../../infrastructure/in-memory-admin-users.repository';
import { AdminConflictError } from '../../domain/admin-conflict.error';

describe('InviteAdminUserUseCase', () => {
  it('invites a new admin', async () => {
    const repository = new InMemoryAdminUsersRepository();
    const useCase = new InviteAdminUserUseCase(repository);

    const admin = await useCase.execute({
      tenantId: 'tenant-1',
      name: 'Carlos Souza',
      email: 'carlos@example.com',
      role: 'JUDGE',
    });

    expect(admin.status).toBe('PENDING');
    await expect(
      repository.findByEmail('tenant-1', 'carlos@example.com'),
    ).resolves.toEqual(admin);
  });

  it('rejects inviting a duplicate email within the same tenant', async () => {
    const repository = new InMemoryAdminUsersRepository();
    const useCase = new InviteAdminUserUseCase(repository);

    await useCase.execute({
      tenantId: 'tenant-1',
      name: 'Carlos Souza',
      email: 'carlos@example.com',
      role: 'JUDGE',
    });

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        name: 'Outro Nome',
        email: 'carlos@example.com',
        role: 'COMMITTEE',
      }),
    ).rejects.toThrow(AdminConflictError);
  });

  it('allows the same email to be invited in a different tenant', async () => {
    const repository = new InMemoryAdminUsersRepository();
    const useCase = new InviteAdminUserUseCase(repository);

    await useCase.execute({
      tenantId: 'tenant-1',
      name: 'Carlos Souza',
      email: 'carlos@example.com',
      role: 'JUDGE',
    });

    await expect(
      useCase.execute({
        tenantId: 'tenant-2',
        name: 'Carlos Souza',
        email: 'carlos@example.com',
        role: 'JUDGE',
      }),
    ).resolves.toBeDefined();
  });
});
