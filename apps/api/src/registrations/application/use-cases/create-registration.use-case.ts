import { Inject, Injectable } from '@nestjs/common';
import { Registration } from '../../domain/registration.entity';
import { InvalidFestivalStateError } from '../../../festivals/domain/invalid-festival-state.error';
import { FESTIVALS_REPOSITORY } from '../../../festivals/application/ports/festivals-repository.port';
import type { FestivalsRepositoryPort } from '../../../festivals/application/ports/festivals-repository.port';
import { REGISTRATIONS_REPOSITORY } from '../ports/registrations-repository.port';
import type { RegistrationsRepositoryPort } from '../ports/registrations-repository.port';

export interface CreateRegistrationUseCaseInput {
  tenantId: string;
  festivalId: string;
  participantName: string;
  participantEmail: string;
  participantCpf: string;
  songName: string;
  performers: string;
  musicComposer?: string | null;
  lyricsComposer?: string | null;
  videoUrl?: string | null;
}

@Injectable()
export class CreateRegistrationUseCase {
  constructor(
    @Inject(FESTIVALS_REPOSITORY)
    private readonly festivalsRepository: FestivalsRepositoryPort,
    @Inject(REGISTRATIONS_REPOSITORY)
    private readonly registrationsRepository: RegistrationsRepositoryPort,
  ) {}

  async execute(
    input: CreateRegistrationUseCaseInput,
  ): Promise<Registration | null> {
    const festival = await this.festivalsRepository.findById(
      input.tenantId,
      input.festivalId,
    );
    if (!festival) return null;

    if (!festival.isAcceptingRegistrations(new Date())) {
      throw new InvalidFestivalStateError(
        'festival is not currently accepting registrations',
      );
    }

    const registration = Registration.create(input);
    await this.registrationsRepository.save(registration);
    return registration;
  }
}
