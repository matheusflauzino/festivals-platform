import { CreateStageUseCase } from './create-stage.use-case';
import { CreateFestivalUseCase } from './create-festival.use-case';
import { InMemoryFestivalsRepository } from '../../infrastructure/in-memory-festivals.repository';
import { InMemoryStagesRepository } from '../../infrastructure/in-memory-stages.repository';

describe('CreateStageUseCase', () => {
  it('creates a stage under an existing festival', async () => {
    const festivalsRepository = new InMemoryFestivalsRepository();
    const stagesRepository = new InMemoryStagesRepository();
    const festival = await new CreateFestivalUseCase(
      festivalsRepository,
    ).execute({
      tenantId: 'tenant-1',
      number: 58,
      year: 2026,
      name: 'FENAC 2026',
      registrationBegin: new Date('2026-01-01'),
      registrationEnd: new Date('2026-03-01'),
      inscriptionFee: 25,
    });

    const useCase = new CreateStageUseCase(
      festivalsRepository,
      stagesRepository,
    );
    const stage = await useCase.execute({
      tenantId: 'tenant-1',
      festivalId: festival.id,
      name: 'Classificatória',
      order: 1,
    });

    expect(stage?.festivalId).toBe(festival.id);
  });

  it('returns null when the festival does not belong to the tenant', async () => {
    const festivalsRepository = new InMemoryFestivalsRepository();
    const stagesRepository = new InMemoryStagesRepository();
    const festival = await new CreateFestivalUseCase(
      festivalsRepository,
    ).execute({
      tenantId: 'tenant-1',
      number: 58,
      year: 2026,
      name: 'FENAC 2026',
      registrationBegin: new Date('2026-01-01'),
      registrationEnd: new Date('2026-03-01'),
      inscriptionFee: 25,
    });

    const useCase = new CreateStageUseCase(
      festivalsRepository,
      stagesRepository,
    );
    const stage = await useCase.execute({
      tenantId: 'tenant-2',
      festivalId: festival.id,
      name: 'Classificatória',
      order: 1,
    });

    expect(stage).toBeNull();
  });
});
