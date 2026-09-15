import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '../domain/user.entity';
import { UsersRepositoryPort } from '../application/ports/users-repository.port';

@Injectable()
export class PrismaUsersRepository implements UsersRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(user: User): Promise<void> {
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

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
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
