import { Inject, Injectable } from '@nestjs/common';
import { Registration } from '../../domain/registration.entity';
import { REGISTRATIONS_REPOSITORY } from '../ports/registrations-repository.port';
import type { RegistrationsRepositoryPort } from '../ports/registrations-repository.port';

@Injectable()
export class ListRegistrationsUseCase {
  constructor(
    @Inject(REGISTRATIONS_REPOSITORY)
    private readonly registrationsRepository: RegistrationsRepositoryPort,
  ) {}

  async execute(tenantId: string): Promise<Registration[]> {
    return this.registrationsRepository.findAllByTenant(tenantId);
  }
}
