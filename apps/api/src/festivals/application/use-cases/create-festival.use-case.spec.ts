import { CreateFestivalUseCase } from './create-festival.use-case';
import { InMemoryFestivalsRepository } from '../../infrastructure/in-memory-festivals.repository';
import { FestivalConflictError } from '../../domain/festival-conflict.error';

const input = {
  tenantId: 'tenant-1',
  number: 58,
  year: 2026,
  name: 'FENAC 2026',
  registrationBegin: new Date('2026-01-01'),
  registrationEnd: new Date('2026-03-01'),
  inscriptionFee: 25,
};

describe('CreateFestivalUseCase', () => {
  it('creates and persists a festival', async () => {
    const repository = new InMemoryFestivalsRepository();
    const useCase = new CreateFestivalUseCase(repository);

    const festival = await useCase.execute(input);

    expect(festival.status).toBe('DRAFT');
    expect(await repository.findById('tenant-1', festival.id)).not.toBeNull();
  });

  it('rejects a duplicate number/year for the same tenant', async () => {
    const repository = new InMemoryFestivalsRepository();
    const useCase = new CreateFestivalUseCase(repository);
    await useCase.execute(input);

    await expect(useCase.execute(input)).rejects.toThrow(FestivalConflictError);
  });
});
