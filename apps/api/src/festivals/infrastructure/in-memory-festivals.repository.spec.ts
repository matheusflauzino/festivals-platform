import { InMemoryFestivalsRepository } from './in-memory-festivals.repository';
import { Festival } from '../domain/festival.entity';
import { FestivalConflictError } from '../domain/festival-conflict.error';

const input = {
  tenantId: 'tenant-1',
  number: 58,
  year: 2026,
  name: 'FENAC 2026',
  registrationBegin: new Date('2026-01-01'),
  registrationEnd: new Date('2026-03-01'),
  inscriptionFee: 25,
};

describe('InMemoryFestivalsRepository', () => {
  it('saves and finds a festival by id, tenant-scoped', async () => {
    const repository = new InMemoryFestivalsRepository();
    const festival = Festival.create(input);
    await repository.save(festival);

    expect(await repository.findById('tenant-1', festival.id)).not.toBeNull();
    expect(await repository.findById('tenant-2', festival.id)).toBeNull();
  });

  it('rejects saving a second festival with the same tenant/number/year', async () => {
    const repository = new InMemoryFestivalsRepository();
    await repository.save(Festival.create(input));

    await expect(repository.save(Festival.create(input))).rejects.toThrow(
      FestivalConflictError,
    );
  });

  it('allows the same number/year for a different tenant', async () => {
    const repository = new InMemoryFestivalsRepository();
    await repository.save(Festival.create(input));

    await expect(
      repository.save(Festival.create({ ...input, tenantId: 'tenant-2' })),
    ).resolves.not.toThrow();
  });

  it("findAllByTenant only returns that tenant's festivals", async () => {
    const repository = new InMemoryFestivalsRepository();
    await repository.save(Festival.create(input));
    await repository.save(Festival.create({ ...input, tenantId: 'tenant-2' }));

    const results = await repository.findAllByTenant('tenant-1');
    expect(results).toHaveLength(1);
    expect(results[0].tenantId).toBe('tenant-1');
  });
});
