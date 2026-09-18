import { Registration } from '../domain/registration.entity';
import type { RegistrationsRepositoryPort } from '../application/ports/registrations-repository.port';

export class InMemoryRegistrationsRepository implements RegistrationsRepositoryPort {
  private readonly registrations = new Map<string, Registration>();

  save(registration: Registration): Promise<void> {
    this.registrations.set(registration.id, registration);
    return Promise.resolve();
  }

  findAllByTenant(tenantId: string): Promise<Registration[]> {
    return Promise.resolve(
      [...this.registrations.values()].filter((r) => r.tenantId === tenantId),
    );
  }

  findAllByFestival(
    tenantId: string,
    festivalId: string,
  ): Promise<Registration[]> {
    return Promise.resolve(
      [...this.registrations.values()].filter(
        (r) => r.tenantId === tenantId && r.festivalId === festivalId,
      ),
    );
  }
}
