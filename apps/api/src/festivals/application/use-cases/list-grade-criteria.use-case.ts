import { Inject, Injectable } from '@nestjs/common';
import { GradeCriterion } from '../../domain/grade-criterion.entity';
import { STAGES_REPOSITORY } from '../ports/stages-repository.port';
import type { StagesRepositoryPort } from '../ports/stages-repository.port';
import { GRADE_CRITERIA_REPOSITORY } from '../ports/grade-criteria-repository.port';
import type { GradeCriteriaRepositoryPort } from '../ports/grade-criteria-repository.port';

@Injectable()
export class ListGradeCriteriaUseCase {
  constructor(
    @Inject(STAGES_REPOSITORY)
    private readonly stagesRepository: StagesRepositoryPort,
    @Inject(GRADE_CRITERIA_REPOSITORY)
    private readonly gradeCriteriaRepository: GradeCriteriaRepositoryPort,
  ) {}

  async execute(
    tenantId: string,
    stageId: string,
  ): Promise<GradeCriterion[] | null> {
    const stage = await this.stagesRepository.findById(tenantId, stageId);
    if (!stage) return null;

    return this.gradeCriteriaRepository.findAllByStage(tenantId, stageId);
  }
}
