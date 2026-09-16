import { GradeCriterion } from './grade-criterion.entity';
import { FestivalValidationError } from './festival-validation.error';

describe('GradeCriterion', () => {
  it('creates a grade criterion with a positive weight', () => {
    const criterion = GradeCriterion.create({
      tenantId: 'tenant-1',
      stageId: 'stage-1',
      name: 'Afinação',
      weight: 2.5,
    });

    expect(criterion.id).toBeDefined();
    expect(criterion.weight).toBe(2.5);
  });

  it('rejects an empty name', () => {
    expect(() =>
      GradeCriterion.create({
        tenantId: 'tenant-1',
        stageId: 'stage-1',
        name: '',
        weight: 1,
      }),
    ).toThrow('name must not be empty');
    expect(() =>
      GradeCriterion.create({
        tenantId: 'tenant-1',
        stageId: 'stage-1',
        name: '',
        weight: 1,
      }),
    ).toThrow(FestivalValidationError);
  });

  it('rejects a whitespace-only name', () => {
    expect(() =>
      GradeCriterion.create({
        tenantId: 'tenant-1',
        stageId: 'stage-1',
        name: '   ',
        weight: 1,
      }),
    ).toThrow(FestivalValidationError);
  });

  it('rejects a non-positive weight', () => {
    expect(() =>
      GradeCriterion.create({
        tenantId: 'tenant-1',
        stageId: 'stage-1',
        name: 'Interpretação',
        weight: 0,
      }),
    ).toThrow('weight must be greater than zero');
    expect(() =>
      GradeCriterion.create({
        tenantId: 'tenant-1',
        stageId: 'stage-1',
        name: 'Interpretação',
        weight: 0,
      }),
    ).toThrow(FestivalValidationError);
  });
});
