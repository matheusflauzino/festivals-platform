import { GetFestivalUseCase } from './get-festival.use-case';
import { CreateFestivalUseCase } from './create-festival.use-case';
import { InMemoryFestivalsRepository } from '../../infrastructure/in-memory-festivals.repository';

describe('GetFestivalUseCase', () => {
  it('returns null for a festival that does not belong to the given tenant', async () => {
    const repository = new InMemoryFestivalsRepository();
    const festival = await new CreateFestivalUseCase(repository).execute({
      tenantId: 'tenant-1',
      number: 58,
      year: 2026,
      name: 'FENAC 2026',
      registrationBegin: new Date('2026-01-01'),
      registrationEnd: new Date('2026-03-01'),
      inscriptionFee: 25,
    });

    const useCase = new GetFestivalUseCase(repository);
    expect(await useCase.execute('tenant-1', festival.id)).not.toBeNull();
    expect(await useCase.execute('tenant-2', festival.id)).toBeNull();
  });
});
