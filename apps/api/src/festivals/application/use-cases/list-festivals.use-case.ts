import { Inject, Injectable } from '@nestjs/common';
import { Festival } from '../../domain/festival.entity';
import { FESTIVALS_REPOSITORY } from '../ports/festivals-repository.port';
import type { FestivalsRepositoryPort } from '../ports/festivals-repository.port';

@Injectable()
export class ListFestivalsUseCase {
  constructor(
    @Inject(FESTIVALS_REPOSITORY)
    private readonly festivalsRepository: FestivalsRepositoryPort,
  ) {}

  async execute(tenantId: string): Promise<Festival[]> {
    return this.festivalsRepository.findAllByTenant(tenantId);
  }
}
