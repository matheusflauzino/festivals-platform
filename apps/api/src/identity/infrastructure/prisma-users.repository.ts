import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '../domain/user.entity';
import { UserConflictError } from '../domain/user-conflict.error';
import { UsersRepositoryPort } from '../application/ports/users-repository.port';

@Injectable()
export class PrismaUsersRepository implements UsersRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(user: User): Promise<void> {
    try {
      await this.prisma.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          tenantId: user.tenantId,
          name: user.name,
          email: user.email,
          cpf: user.cpf,
          passwordHash: user.passwordHash,
          createdAt: user.createdAt,
        },
        update: {
          name: user.name,
          email: user.email,
          cpf: user.cpf,
          passwordHash: user.passwordHash,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Prisma's `meta.target` shape is datasource-dependent: on
        // Postgres it's an array of column names, but on MySQL it's the
        // constraint/index name as a single string (e.g.
        // "users_tenant_id_email_key"). Handle both.
        const target = error.meta?.target;
        const targetMentions = (field: 'email' | 'cpf'): boolean =>
          Array.isArray(target)
            ? target.includes(field)
            : typeof target === 'string' && target.includes(field);

        const field: 'email' | 'cpf' = targetMentions('email')
          ? 'email'
          : 'cpf';
        throw new UserConflictError(field);
      }
      throw error;
    }
  }

  async findByEmailOrCpf(
    tenantId: string,
    identifier: string,
  ): Promise<User | null> {
    const row = await this.prisma.user.findFirst({
      where: {
        tenantId,
        OR: [{ email: identifier }, { cpf: identifier }],
      },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async findById(tenantId: string, id: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    name: string;
    email: string;
    cpf: string;
    passwordHash: string;
    createdAt: Date;
  }): User {
    return User.restore({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      email: row.email,
      cpf: row.cpf,
      passwordHash: row.passwordHash,
      createdAt: row.createdAt,
    });
  }
}
