import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantScopedRepository } from '../../common/repositories/tenant-scoped.repository';
import { Stage } from '../domain/stage.entity';
import type { StageProps } from '../domain/stage.entity';
import type { StagesRepositoryPort } from '../application/ports/stages-repository.port';

interface StageRow {
  id: string;
  tenantId: string;
  festivalId: string;
  name: string;
  order: number;
  advancementQuota: number | null;
  createdAt: Date;
}

@Injectable()
export class PrismaStagesRepository
  extends TenantScopedRepository
  implements StagesRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async save(stage: Stage): Promise<void> {
    await this.prisma.stage.upsert({
      where: { id: stage.id },
      create: {
        id: stage.id,
        tenantId: stage.tenantId,
        festivalId: stage.festivalId,
        name: stage.name,
        order: stage.order,
        advancementQuota: stage.advancementQuota,
        createdAt: stage.createdAt,
      },
      update: {
        name: stage.name,
        order: stage.order,
        advancementQuota: stage.advancementQuota,
      },
    });
  }

  async findById(tenantId: string, id: string): Promise<Stage | null> {
    const row = await this.prisma.stage.findFirst({
      where: this.tenantScoped(tenantId, { id }),
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async findAllByFestival(
    tenantId: string,
    festivalId: string,
  ): Promise<Stage[]> {
    const rows = await this.prisma.stage.findMany({
      where: this.tenantScoped(tenantId, { festivalId }),
      orderBy: { order: 'asc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: StageRow): Stage {
    const props: StageProps = {
      id: row.id,
      tenantId: row.tenantId,
      festivalId: row.festivalId,
      name: row.name,
      order: row.order,
      advancementQuota: row.advancementQuota,
      createdAt: row.createdAt,
    };
    return Stage.restore(props);
  }
}
