import { Festival } from '../../domain/festival.entity';

export interface FestivalsRepositoryPort {
  save(festival: Festival): Promise<void>;
  findById(tenantId: string, id: string): Promise<Festival | null>;
  findAllByTenant(tenantId: string): Promise<Festival[]>;
}

export const FESTIVALS_REPOSITORY = Symbol('FESTIVALS_REPOSITORY');
