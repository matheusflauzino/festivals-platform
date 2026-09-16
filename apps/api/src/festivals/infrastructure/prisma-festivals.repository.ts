import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantScopedRepository } from '../../common/repositories/tenant-scoped.repository';
import { Festival } from '../domain/festival.entity';
import type { FestivalProps, BrazilianState } from '../domain/festival.entity';
import { FestivalConflictError } from '../domain/festival-conflict.error';
import type { FestivalsRepositoryPort } from '../application/ports/festivals-repository.port';

interface FestivalRow {
  id: string;
  tenantId: string;
  number: number;
  year: number;
  name: string;
  registrationBegin: Date;
  registrationEnd: Date;
  votingBegin: Date | null;
  votingEnd: Date | null;
  status: string;
  inscriptionFee: Prisma.Decimal;
  regulationUrl: string | null;
  allowedStates: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PrismaFestivalsRepository
  extends TenantScopedRepository
  implements FestivalsRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async save(festival: Festival): Promise<void> {
    try {
      await this.prisma.festival.upsert({
        where: { id: festival.id },
        create: {
          id: festival.id,
          tenantId: festival.tenantId,
          number: festival.number,
          year: festival.year,
          name: festival.name,
          registrationBegin: festival.registrationBegin,
          registrationEnd: festival.registrationEnd,
          votingBegin: festival.votingBegin,
          votingEnd: festival.votingEnd,
          status: festival.status,
          inscriptionFee: festival.inscriptionFee,
          regulationUrl: festival.regulationUrl,
          allowedStates: festival.allowedStates,
          createdAt: festival.createdAt,
          updatedAt: festival.updatedAt,
        },
        update: {
          name: festival.name,
          registrationBegin: festival.registrationBegin,
          registrationEnd: festival.registrationEnd,
          votingBegin: festival.votingBegin,
          votingEnd: festival.votingEnd,
          status: festival.status,
          inscriptionFee: festival.inscriptionFee,
          regulationUrl: festival.regulationUrl,
          allowedStates: festival.allowedStates,
          updatedAt: festival.updatedAt,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new FestivalConflictError(festival.number, festival.year);
      }
      throw error;
    }
  }

  async findById(tenantId: string, id: string): Promise<Festival | null> {
    const row = await this.prisma.festival.findFirst({
      where: this.tenantScoped(tenantId, { id }),
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async findAllByTenant(tenantId: string): Promise<Festival[]> {
    const rows = await this.prisma.festival.findMany({
      where: this.tenantScoped(tenantId),
      orderBy: [{ year: 'desc' }, { number: 'desc' }],
    });
    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: FestivalRow): Festival {
    const props: FestivalProps = {
      id: row.id,
      tenantId: row.tenantId,
      number: row.number,
      year: row.year,
      name: row.name,
      registrationBegin: row.registrationBegin,
      registrationEnd: row.registrationEnd,
      votingBegin: row.votingBegin,
      votingEnd: row.votingEnd,
      status: row.status as FestivalProps['status'],
      inscriptionFee: Number(row.inscriptionFee),
      regulationUrl: row.regulationUrl,
      allowedStates: (row.allowedStates as BrazilianState[] | null) ?? [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    return Festival.restore(props);
  }
}
