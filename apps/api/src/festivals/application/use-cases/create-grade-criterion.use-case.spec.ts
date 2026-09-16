import { CreateGradeCriterionUseCase } from './create-grade-criterion.use-case';
import { CreateStageUseCase } from './create-stage.use-case';
import { CreateFestivalUseCase } from './create-festival.use-case';
import { InMemoryFestivalsRepository } from '../../infrastructure/in-memory-festivals.repository';
import { InMemoryStagesRepository } from '../../infrastructure/in-memory-stages.repository';
import { InMemoryGradeCriteriaRepository } from '../../infrastructure/in-memory-grade-criteria.repository';

async function seedStage() {
  const festivalsRepository = new InMemoryFestivalsRepository();
  const stagesRepository = new InMemoryStagesRepository();
  const festival = await new CreateFestivalUseCase(festivalsRepository).execute(
    {
      tenantId: 'tenant-1',
      number: 58,
      year: 2026,
      name: 'FENAC 2026',
      registrationBegin: new Date('2026-01-01'),
      registrationEnd: new Date('2026-03-01'),
      inscriptionFee: 25,
    },
  );
  const stage = await new CreateStageUseCase(
    festivalsRepository,
    stagesRepository,
  ).execute({
    tenantId: 'tenant-1',
    festivalId: festival.id,
    name: 'Classificatória',
    order: 1,
  });
  return { stagesRepository, stage: stage! };
}

describe('CreateGradeCriterionUseCase', () => {
  it('creates a grade criterion under an existing stage', async () => {
    const { stagesRepository, stage } = await seedStage();
    const criteriaRepository = new InMemoryGradeCriteriaRepository();

    const useCase = new CreateGradeCriterionUseCase(
      stagesRepository,
      criteriaRepository,
    );
    const criterion = await useCase.execute({
      tenantId: 'tenant-1',
      stageId: stage.id,
      name: 'Afinação',
      weight: 2,
    });

    expect(criterion?.stageId).toBe(stage.id);
  });

  it('returns null when the stage does not belong to the tenant', async () => {
    const { stagesRepository, stage } = await seedStage();
    const criteriaRepository = new InMemoryGradeCriteriaRepository();

    const useCase = new CreateGradeCriterionUseCase(
      stagesRepository,
      criteriaRepository,
    );
    const criterion = await useCase.execute({
      tenantId: 'tenant-2',
      stageId: stage.id,
      name: 'Afinação',
      weight: 2,
    });

    expect(criterion).toBeNull();
  });
});
