import { Registration } from '../../domain/registration.entity';

export interface RegistrationsRepositoryPort {
  save(registration: Registration): Promise<void>;
  findAllByTenant(tenantId: string): Promise<Registration[]>;
  findAllByFestival(tenantId: string, festivalId: string): Promise<Registration[]>;
}

export const REGISTRATIONS_REPOSITORY = Symbol('REGISTRATIONS_REPOSITORY');
