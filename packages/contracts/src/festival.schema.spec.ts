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

  it('rejects a registrationBegin that is not before registrationEnd', () => {
    const result = createFestivalSchema.safeParse({
      ...validCreate,
      registrationBegin: '2026-03-01T18:00:00.000Z',
      registrationEnd: '2026-01-01T08:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a registrationBegin strictly before registrationEnd', () => {
    const result = createFestivalSchema.safeParse({
      ...validCreate,
      registrationBegin: '2026-01-01T08:00:00.000Z',
      registrationEnd: '2026-01-02T08:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects votingBegin set without votingEnd', () => {
    const result = createFestivalSchema.safeParse({
      ...validCreate,
      votingBegin: '2026-02-01T08:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects votingEnd set without votingBegin', () => {
    const result = createFestivalSchema.safeParse({
      ...validCreate,
      votingEnd: '2026-02-15T08:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('accepts votingBegin and votingEnd both set', () => {
    const result = createFestivalSchema.safeParse({
      ...validCreate,
      votingBegin: '2026-02-01T08:00:00.000Z',
      votingEnd: '2026-02-15T08:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('accepts votingBegin and votingEnd both absent', () => {
    expect(createFestivalSchema.safeParse(validCreate).success).toBe(true);
  });

  it('rejects a whitespace-only name', () => {
    const result = createFestivalSchema.safeParse({
      ...validCreate,
      name: '   ',
    });
    expect(result.success).toBe(false);
  });

  it('trims a name with surrounding whitespace', () => {
    const result = createFestivalSchema.safeParse({
      ...validCreate,
      name: '  FENAC 2026  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('FENAC 2026');
    }
  });

  it('rejects an inscriptionFee above the DECIMAL(8,2) bound', () => {
    const result = createFestivalSchema.safeParse({
      ...validCreate,
      inscriptionFee: 1000000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an inscriptionFee that is not a multiple of 0.01', () => {
    const result = createFestivalSchema.safeParse({
      ...validCreate,
      inscriptionFee: 25.999,
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

  it('rejects a registrationBegin that is not before registrationEnd', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { number, year, ...rest } = validCreate;
    const result = updateFestivalSchema.safeParse({
      ...rest,
      registrationBegin: '2026-03-01T18:00:00.000Z',
      registrationEnd: '2026-01-01T08:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects votingBegin set without votingEnd', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { number, year, ...rest } = validCreate;
    const result = updateFestivalSchema.safeParse({
      ...rest,
      votingBegin: '2026-02-01T08:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('accepts an explicit null for both votingBegin and votingEnd', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { number, year, ...rest } = validCreate;
    const result = updateFestivalSchema.safeParse({
      ...rest,
      votingBegin: null,
      votingEnd: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a whitespace-only name', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { number, year, ...rest } = validCreate;
    const result = updateFestivalSchema.safeParse({ ...rest, name: '   ' });
    expect(result.success).toBe(false);
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

  it('rejects a whitespace-only name', () => {
    expect(
      createStageSchema.safeParse({ name: '   ', order: 1 }).success,
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

  it('rejects a whitespace-only name', () => {
    expect(
      createGradeCriterionSchema.safeParse({ name: '   ', weight: 1 })
        .success,
    ).toBe(false);
  });

  it('rejects a weight above the DECIMAL(5,2) bound', () => {
    expect(
      createGradeCriterionSchema.safeParse({ name: 'Afinação', weight: 1000 })
        .success,
    ).toBe(false);
  });

  it('rejects a weight that is not a multiple of 0.01', () => {
    expect(
      createGradeCriterionSchema.safeParse({
        name: 'Afinação',
        weight: 2.999,
      }).success,
    ).toBe(false);
  });
});
