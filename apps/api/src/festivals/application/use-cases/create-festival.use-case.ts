import { Inject, Injectable } from '@nestjs/common';
import { Festival } from '../../domain/festival.entity';
import type { BrazilianState } from '../../domain/festival.entity';
import { FESTIVALS_REPOSITORY } from '../ports/festivals-repository.port';
import type { FestivalsRepositoryPort } from '../ports/festivals-repository.port';

export interface CreateFestivalUseCaseInput {
  tenantId: string;
  number: number;
  year: number;
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
export class CreateFestivalUseCase {
  constructor(
    @Inject(FESTIVALS_REPOSITORY)
    private readonly festivalsRepository: FestivalsRepositoryPort,
  ) {}

  async execute(input: CreateFestivalUseCaseInput): Promise<Festival> {
    const festival = Festival.create(input);
    await this.festivalsRepository.save(festival);
    return festival;
  }
}
