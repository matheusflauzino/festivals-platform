import { Stage } from './stage.entity';
import { FestivalValidationError } from './festival-validation.error';

describe('Stage', () => {
  it('creates a stage with a null advancementQuota by default', () => {
    const stage = Stage.create({
      tenantId: 'tenant-1',
      festivalId: 'festival-1',
      name: 'Classificatória',
      order: 1,
    });

    expect(stage.id).toBeDefined();
    expect(stage.advancementQuota).toBeNull();
  });

  it('rejects an empty name', () => {
    expect(() =>
      Stage.create({
        tenantId: 'tenant-1',
        festivalId: 'festival-1',
        name: '  ',
        order: 1,
      }),
    ).toThrow('name must not be empty');
    expect(() =>
      Stage.create({
        tenantId: 'tenant-1',
        festivalId: 'festival-1',
        name: '  ',
        order: 1,
      }),
    ).toThrow(FestivalValidationError);
  });

  it('rejects a non-positive order', () => {
    expect(() =>
      Stage.create({
        tenantId: 'tenant-1',
        festivalId: 'festival-1',
        name: 'Final',
        order: 0,
      }),
    ).toThrow('order must be a positive integer');
    expect(() =>
      Stage.create({
        tenantId: 'tenant-1',
        festivalId: 'festival-1',
        name: 'Final',
        order: 0,
      }),
    ).toThrow(FestivalValidationError);
  });

  it('rejects a non-positive advancementQuota when provided', () => {
    expect(() =>
      Stage.create({
        tenantId: 'tenant-1',
        festivalId: 'festival-1',
        name: 'Semifinal',
        order: 2,
        advancementQuota: 0,
      }),
    ).toThrow('advancementQuota must be a positive integer when set');
    expect(() =>
      Stage.create({
        tenantId: 'tenant-1',
        festivalId: 'festival-1',
        name: 'Semifinal',
        order: 2,
        advancementQuota: 0,
      }),
    ).toThrow(FestivalValidationError);
  });
});
