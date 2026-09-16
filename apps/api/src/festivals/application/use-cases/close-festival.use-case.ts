import { Inject, Injectable } from '@nestjs/common';
import { Festival } from '../../domain/festival.entity';
import { FESTIVALS_REPOSITORY } from '../ports/festivals-repository.port';
import type { FestivalsRepositoryPort } from '../ports/festivals-repository.port';

@Injectable()
export class CloseFestivalUseCase {
  constructor(
    @Inject(FESTIVALS_REPOSITORY)
    private readonly festivalsRepository: FestivalsRepositoryPort,
  ) {}

  async execute(
    tenantId: string,
    festivalId: string,
  ): Promise<Festival | null> {
    const existing = await this.festivalsRepository.findById(
      tenantId,
      festivalId,
    );
    if (!existing) return null;

    const closed = existing.close();
    await this.festivalsRepository.save(closed);
    return closed;
  }
}
