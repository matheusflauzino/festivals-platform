import { Inject, Injectable } from '@nestjs/common';
import { GradeCriterion } from '../../domain/grade-criterion.entity';
import { STAGES_REPOSITORY } from '../ports/stages-repository.port';
import type { StagesRepositoryPort } from '../ports/stages-repository.port';
import { GRADE_CRITERIA_REPOSITORY } from '../ports/grade-criteria-repository.port';
import type { GradeCriteriaRepositoryPort } from '../ports/grade-criteria-repository.port';

export interface CreateGradeCriterionUseCaseInput {
  tenantId: string;
  stageId: string;
  name: string;
  weight: number;
}

@Injectable()
export class CreateGradeCriterionUseCase {
  constructor(
    @Inject(STAGES_REPOSITORY)
    private readonly stagesRepository: StagesRepositoryPort,
    @Inject(GRADE_CRITERIA_REPOSITORY)
    private readonly gradeCriteriaRepository: GradeCriteriaRepositoryPort,
  ) {}

  async execute(
    input: CreateGradeCriterionUseCaseInput,
  ): Promise<GradeCriterion | null> {
    const stage = await this.stagesRepository.findById(
      input.tenantId,
      input.stageId,
    );
    if (!stage) return null;

    const criterion = GradeCriterion.create(input);
    await this.gradeCriteriaRepository.save(criterion);
    return criterion;
  }
}
