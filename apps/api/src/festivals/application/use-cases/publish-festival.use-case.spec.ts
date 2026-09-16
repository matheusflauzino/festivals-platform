import { PublishFestivalUseCase } from './publish-festival.use-case';
import { CreateFestivalUseCase } from './create-festival.use-case';
import { InMemoryFestivalsRepository } from '../../infrastructure/in-memory-festivals.repository';
import { InvalidFestivalStateError } from '../../domain/invalid-festival-state.error';

describe('PublishFestivalUseCase', () => {
  it('publishes a DRAFT festival', async () => {
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

    const useCase = new PublishFestivalUseCase(repository);
    const published = await useCase.execute('tenant-1', festival.id);

    expect(published?.status).toBe('OPEN');
  });

  it('returns null for a festival that does not belong to the tenant', async () => {
    const repository = new InMemoryFestivalsRepository();
    const useCase = new PublishFestivalUseCase(repository);
    expect(await useCase.execute('tenant-1', 'nonexistent-id')).toBeNull();
  });

  it('rethrows InvalidFestivalStateError for a festival that is already OPEN', async () => {
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
    const useCase = new PublishFestivalUseCase(repository);
    await useCase.execute('tenant-1', festival.id);

    await expect(useCase.execute('tenant-1', festival.id)).rejects.toThrow(
      InvalidFestivalStateError,
    );
  });
});
