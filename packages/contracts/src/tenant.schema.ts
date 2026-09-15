import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().min(1),
  document: z
    .string()
    .regex(/^[A-Za-z0-9]{14}$/, 'document must be 14 alphanumeric characters'),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase letters, numbers and hyphens only'),
});

export type CreateTenantDto = z.infer<typeof createTenantSchema>;
