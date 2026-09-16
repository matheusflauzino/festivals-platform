import { describe, expect, it } from 'vitest';
import {
  createFestivalSchema,
  updateFestivalSchema,
  createStageSchema,
  createGradeCriterionSchema,
} from './festival.schema';

const validCreate = {
  number: 58,
  year: 2026,
  name: 'FENAC 2026',
  registrationBegin: '2026-01-01T08:00:00.000Z',
  registrationEnd: '2026-03-01T18:00:00.000Z',
  inscriptionFee: 25,
};

describe('createFestivalSchema', () => {
  it('accepts a valid payload', () => {
    expect(createFestivalSchema.safeParse(validCreate).success).toBe(true);
  });

  it('rejects an invalid Brazilian state', () => {
    const result = createFestivalSchema.safeParse({
      ...validCreate,
      allowedStates: ['XX'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative inscriptionFee', () => {
    const result = createFestivalSchema.safeParse({
      ...validCreate,
      inscriptionFee: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe('updateFestivalSchema', () => {
  it('accepts a payload without number/year', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { number, year, ...rest } = validCreate;
    expect(updateFestivalSchema.safeParse(rest).success).toBe(true);
  });
});

describe('createStageSchema', () => {
  it('accepts a valid stage payload', () => {
    expect(
      createStageSchema.safeParse({ name: 'Classificatória', order: 1 })
        .success,
    ).toBe(true);
  });

  it('rejects a non-positive order', () => {
    expect(
      createStageSchema.safeParse({ name: 'Final', order: 0 }).success,
    ).toBe(false);
  });
});

describe('createGradeCriterionSchema', () => {
  it('accepts a valid criterion payload', () => {
    expect(
      createGradeCriterionSchema.safeParse({ name: 'Afinação', weight: 2.5 })
        .success,
    ).toBe(true);
  });

  it('rejects a non-positive weight', () => {
    expect(
      createGradeCriterionSchema.safeParse({ name: 'Afinação', weight: 0 })
        .success,
    ).toBe(false);
  });
});
