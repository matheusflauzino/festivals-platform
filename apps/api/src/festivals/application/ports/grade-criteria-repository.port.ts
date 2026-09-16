import { GradeCriterion } from '../../domain/grade-criterion.entity';

export interface GradeCriteriaRepositoryPort {
  save(criterion: GradeCriterion): Promise<void>;
  findAllByStage(tenantId: string, stageId: string): Promise<GradeCriterion[]>;
}

export const GRADE_CRITERIA_REPOSITORY = Symbol('GRADE_CRITERIA_REPOSITORY');
