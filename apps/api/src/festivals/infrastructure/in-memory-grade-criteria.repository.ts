import { GradeCriterion } from '../domain/grade-criterion.entity';
import type { GradeCriteriaRepositoryPort } from '../application/ports/grade-criteria-repository.port';

export class InMemoryGradeCriteriaRepository implements GradeCriteriaRepositoryPort {
  private readonly criteria = new Map<string, GradeCriterion>();

  save(criterion: GradeCriterion): Promise<void> {
    this.criteria.set(criterion.id, criterion);
    return Promise.resolve();
  }

  findAllByStage(tenantId: string, stageId: string): Promise<GradeCriterion[]> {
    return Promise.resolve(
      [...this.criteria.values()].filter(
        (c) => c.tenantId === tenantId && c.stageId === stageId,
      ),
    );
  }
}
