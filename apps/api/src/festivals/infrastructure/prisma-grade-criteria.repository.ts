import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantScopedRepository } from '../../common/repositories/tenant-scoped.repository';
import { GradeCriterion } from '../domain/grade-criterion.entity';
import type { GradeCriterionProps } from '../domain/grade-criterion.entity';
import type { GradeCriteriaRepositoryPort } from '../application/ports/grade-criteria-repository.port';

interface GradeCriterionRow {
  id: string;
  tenantId: string;
  stageId: string;
  name: string;
  weight: Prisma.Decimal;
  createdAt: Date;
}

@Injectable()
export class PrismaGradeCriteriaRepository
  extends TenantScopedRepository
  implements GradeCriteriaRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async save(criterion: GradeCriterion): Promise<void> {
    await this.prisma.gradeCriterion.upsert({
      where: { id: criterion.id },
      create: {
        id: criterion.id,
        tenantId: criterion.tenantId,
        stageId: criterion.stageId,
        name: criterion.name,
        weight: criterion.weight,
        createdAt: criterion.createdAt,
      },
      update: {
        name: criterion.name,
        weight: criterion.weight,
      },
    });
  }

  async findAllByStage(
    tenantId: string,
    stageId: string,
  ): Promise<GradeCriterion[]> {
    const rows = await this.prisma.gradeCriterion.findMany({
      where: this.tenantScoped(tenantId, { stageId }),
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: GradeCriterionRow): GradeCriterion {
    const props: GradeCriterionProps = {
      id: row.id,
      tenantId: row.tenantId,
      stageId: row.stageId,
      name: row.name,
      weight: Number(row.weight),
      createdAt: row.createdAt,
    };
    return GradeCriterion.restore(props);
  }
}
