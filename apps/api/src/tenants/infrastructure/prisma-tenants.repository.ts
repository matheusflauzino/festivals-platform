import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Tenant } from '../domain/tenant.entity';
import { TenantsRepositoryPort } from '../application/ports/tenants-repository.port';

@Injectable()
export class PrismaTenantsRepository implements TenantsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(tenant: Tenant): Promise<void> {
    await this.prisma.tenant.upsert({
      where: { id: tenant.id },
      create: {
        id: tenant.id,
        name: tenant.name,
        document: tenant.document,
        slug: tenant.slug,
        status: tenant.status,
        createdAt: tenant.createdAt,
      },
      update: {
        name: tenant.name,
        document: tenant.document,
        slug: tenant.slug,
        status: tenant.status,
      },
    });
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const row = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!row) return null;

    return Tenant.restore({
      id: row.id,
      name: row.name,
      document: row.document,
      slug: row.slug,
      status: row.status,
      createdAt: row.createdAt,
    });
  }
}
