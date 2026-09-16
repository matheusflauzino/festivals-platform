import { Inject, Injectable } from '@nestjs/common';
import { Festival } from '../../domain/festival.entity';
import type { BrazilianState } from '../../domain/festival.entity';
import { FESTIVALS_REPOSITORY } from '../ports/festivals-repository.port';
import type { FestivalsRepositoryPort } from '../ports/festivals-repository.port';

export interface UpdateFestivalDetailsUseCaseInput {
  tenantId: string;
  festivalId: string;
  name: string;
  registrationBegin: Date;
  registrationEnd: Date;
  votingBegin?: Date | null;
  votingEnd?: Date | null;
  inscriptionFee: number;
  regulationUrl?: string | null;
  allowedStates?: BrazilianState[];
}

@Injectable()
export class UpdateFestivalDetailsUseCase {
  constructor(
    @Inject(FESTIVALS_REPOSITORY)
    private readonly festivalsRepository: FestivalsRepositoryPort,
  ) {}

  async execute(
    input: UpdateFestivalDetailsUseCaseInput,
  ): Promise<Festival | null> {
    const existing = await this.festivalsRepository.findById(
      input.tenantId,
      input.festivalId,
    );
    if (!existing) return null;

    const updated = existing.updateDetails(input);
    await this.festivalsRepository.save(updated);
    return updated;
  }
}
