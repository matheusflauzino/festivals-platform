import { Inject, Injectable } from '@nestjs/common';
import { Registration } from '../../domain/registration.entity';
import { FESTIVALS_REPOSITORY } from '../../../festivals/application/ports/festivals-repository.port';
import type { FestivalsRepositoryPort } from '../../../festivals/application/ports/festivals-repository.port';
import { REGISTRATIONS_REPOSITORY } from '../ports/registrations-repository.port';
import type { RegistrationsRepositoryPort } from '../ports/registrations-repository.port';

@Injectable()
export class ListFestivalRegistrationsUseCase {
  constructor(
    @Inject(FESTIVALS_REPOSITORY)
    private readonly festivalsRepository: FestivalsRepositoryPort,
    @Inject(REGISTRATIONS_REPOSITORY)
    private readonly registrationsRepository: RegistrationsRepositoryPort,
  ) {}

  async execute(tenantId: string, festivalId: string): Promise<Registration[] | null> {
    const festival = await this.festivalsRepository.findById(tenantId, festivalId);
    if (!festival) return null;

    return this.registrationsRepository.findAllByFestival(tenantId, festivalId);
  }
}
