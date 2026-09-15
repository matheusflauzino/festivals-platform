import { User } from '../../domain/user.entity';

export interface UsersRepositoryPort {
  save(user: User): Promise<void>;
  findByEmailOrCpf(tenantId: string, identifier: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');
