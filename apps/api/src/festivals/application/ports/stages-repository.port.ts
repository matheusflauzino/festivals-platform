import { Stage } from '../../domain/stage.entity';

export interface StagesRepositoryPort {
  save(stage: Stage): Promise<void>;
  findById(tenantId: string, id: string): Promise<Stage | null>;
  findAllByFestival(tenantId: string, festivalId: string): Promise<Stage[]>;
}

export const STAGES_REPOSITORY = Symbol('STAGES_REPOSITORY');
