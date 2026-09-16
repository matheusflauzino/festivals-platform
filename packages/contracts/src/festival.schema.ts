import { z } from 'zod';

export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
] as const;

const festivalDetailsShape = {
  name: z.string().min(1).max(255),
  registrationBegin: z.coerce.date(),
  registrationEnd: z.coerce.date(),
  votingBegin: z.coerce.date().nullable().optional(),
  votingEnd: z.coerce.date().nullable().optional(),
  inscriptionFee: z.number().min(0),
  regulationUrl: z.string().url().nullable().optional(),
  allowedStates: z.array(z.enum(BRAZILIAN_STATES)).optional(),
};

export const createFestivalSchema = z.object({
  number: z.number().int().positive(),
  year: z.number().int().min(1900).max(2200),
  ...festivalDetailsShape,
});

export type CreateFestivalDto = z.infer<typeof createFestivalSchema>;

export const updateFestivalSchema = z.object(festivalDetailsShape);

export type UpdateFestivalDto = z.infer<typeof updateFestivalSchema>;

export const createStageSchema = z.object({
  name: z.string().min(1).max(255),
  order: z.number().int().positive(),
  advancementQuota: z.number().int().positive().nullable().optional(),
});

export type CreateStageDto = z.infer<typeof createStageSchema>;

export const createGradeCriterionSchema = z.object({
  name: z.string().min(1).max(255),
  weight: z.number().positive(),
});

export type CreateGradeCriterionDto = z.infer<typeof createGradeCriterionSchema>;
