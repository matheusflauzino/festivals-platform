import { Festival } from '../domain/festival.entity';
import { FestivalConflictError } from '../domain/festival-conflict.error';
import type { FestivalsRepositoryPort } from '../application/ports/festivals-repository.port';

export class InMemoryFestivalsRepository implements FestivalsRepositoryPort {
  private readonly festivals = new Map<string, Festival>();

  save(festival: Festival): Promise<void> {
    const conflict = [...this.festivals.values()].find(
      (existing) =>
        existing.id !== festival.id &&
        existing.tenantId === festival.tenantId &&
        existing.number === festival.number &&
        existing.year === festival.year,
    );
    if (conflict) {
      return Promise.reject(
        new FestivalConflictError(festival.number, festival.year),
      );
    }
    this.festivals.set(festival.id, festival);
    return Promise.resolve();
  }

  findById(tenantId: string, id: string): Promise<Festival | null> {
    const festival = this.festivals.get(id);
    return Promise.resolve(
      festival && festival.tenantId === tenantId ? festival : null,
    );
  }

  findAllByTenant(tenantId: string): Promise<Festival[]> {
    return Promise.resolve(
      [...this.festivals.values()].filter((f) => f.tenantId === tenantId),
    );
  }
}
