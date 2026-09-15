import { User } from '../domain/user.entity';
import { UsersRepositoryPort } from '../application/ports/users-repository.port';

export class InMemoryUsersRepository implements UsersRepositoryPort {
  private readonly users = new Map<string, User>();

  save(user: User): Promise<void> {
    this.users.set(user.id, user);
    return Promise.resolve();
  }

  findByEmailOrCpf(tenantId: string, identifier: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (
        user.tenantId === tenantId &&
        (user.email === identifier || user.cpf === identifier)
      ) {
        return Promise.resolve(user);
      }
    }
    return Promise.resolve(null);
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }
}
