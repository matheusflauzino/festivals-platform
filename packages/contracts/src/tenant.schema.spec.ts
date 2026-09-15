import { describe, expect, it } from 'vitest';
import { createTenantSchema } from './tenant.schema';

describe('createTenantSchema', () => {
  it('accepts a valid payload', () => {
    const result = createTenantSchema.safeParse({
      name: 'FENAC',
      document: 'AB123456789012',
      slug: 'fenac',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a document that is not 14 characters', () => {
    const result = createTenantSchema.safeParse({
      name: 'FENAC',
      document: '123',
      slug: 'fenac',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty name', () => {
    const result = createTenantSchema.safeParse({
      name: '',
      document: 'AB123456789012',
      slug: 'fenac',
    });

    expect(result.success).toBe(false);
  });
});
