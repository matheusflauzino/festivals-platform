import { Stage } from '../domain/stage.entity';
import type { StagesRepositoryPort } from '../application/ports/stages-repository.port';

export class InMemoryStagesRepository implements StagesRepositoryPort {
  private readonly stages = new Map<string, Stage>();

  save(stage: Stage): Promise<void> {
    this.stages.set(stage.id, stage);
    return Promise.resolve();
  }

  findById(tenantId: string, id: string): Promise<Stage | null> {
    const stage = this.stages.get(id);
    return Promise.resolve(stage && stage.tenantId === tenantId ? stage : null);
  }

  findAllByFestival(tenantId: string, festivalId: string): Promise<Stage[]> {
    return Promise.resolve(
      [...this.stages.values()].filter(
        (s) => s.tenantId === tenantId && s.festivalId === festivalId,
      ),
    );
  }
}
