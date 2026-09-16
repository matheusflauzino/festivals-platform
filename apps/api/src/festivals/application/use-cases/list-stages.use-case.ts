import { Inject, Injectable } from '@nestjs/common';
import { Stage } from '../../domain/stage.entity';
import { FESTIVALS_REPOSITORY } from '../ports/festivals-repository.port';
import type { FestivalsRepositoryPort } from '../ports/festivals-repository.port';
import { STAGES_REPOSITORY } from '../ports/stages-repository.port';
import type { StagesRepositoryPort } from '../ports/stages-repository.port';

@Injectable()
export class ListStagesUseCase {
  constructor(
    @Inject(FESTIVALS_REPOSITORY)
    private readonly festivalsRepository: FestivalsRepositoryPort,
    @Inject(STAGES_REPOSITORY)
    private readonly stagesRepository: StagesRepositoryPort,
  ) {}

  async execute(tenantId: string, festivalId: string): Promise<Stage[] | null> {
    const festival = await this.festivalsRepository.findById(
      tenantId,
      festivalId,
    );
    if (!festival) return null;

    return this.stagesRepository.findAllByFestival(tenantId, festivalId);
  }
}
