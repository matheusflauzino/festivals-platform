import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Tenant } from '../domain/tenant.entity';
import { TenantConflictError } from '../domain/tenant-conflict.error';
import { TenantsRepositoryPort } from '../application/ports/tenants-repository.port';

@Injectable()
export class PrismaTenantsRepository implements TenantsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(tenant: Tenant): Promise<void> {
    try {
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Prisma's `meta.target` shape is datasource-dependent: on
        // Postgres it's an array of column names, but on MySQL it's the
        // constraint/index name as a single string (e.g.
        // "tenants_document_key"). Handle both.
        const target = error.meta?.target;
        const targetMentions = (field: 'document' | 'slug'): boolean =>
          Array.isArray(target)
            ? target.includes(field)
            : typeof target === 'string' && target.includes(field);

        const field: 'document' | 'slug' = targetMentions('document')
          ? 'document'
          : 'slug';
        const value = field === 'document' ? tenant.document : tenant.slug;
        throw new TenantConflictError(field, value);
      }
      throw error;
    }
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

  async findById(id: string): Promise<Tenant | null> {
    const row = await this.prisma.tenant.findUnique({ where: { id } });
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
