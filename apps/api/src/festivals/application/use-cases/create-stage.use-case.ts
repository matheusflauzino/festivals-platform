import { Inject, Injectable } from '@nestjs/common';
import { Stage } from '../../domain/stage.entity';
import { FESTIVALS_REPOSITORY } from '../ports/festivals-repository.port';
import type { FestivalsRepositoryPort } from '../ports/festivals-repository.port';
import { STAGES_REPOSITORY } from '../ports/stages-repository.port';
import type { StagesRepositoryPort } from '../ports/stages-repository.port';

export interface CreateStageUseCaseInput {
  tenantId: string;
  festivalId: string;
  name: string;
  order: number;
  advancementQuota?: number | null;
}

@Injectable()
export class CreateStageUseCase {
  constructor(
    @Inject(FESTIVALS_REPOSITORY)
    private readonly festivalsRepository: FestivalsRepositoryPort,
    @Inject(STAGES_REPOSITORY)
    private readonly stagesRepository: StagesRepositoryPort,
  ) {}

  async execute(input: CreateStageUseCaseInput): Promise<Stage | null> {
    const festival = await this.festivalsRepository.findById(
      input.tenantId,
      input.festivalId,
    );
    if (!festival) return null;

    const stage = Stage.create(input);
    await this.stagesRepository.save(stage);
    return stage;
  }
}
