import { Tenant } from './tenant.entity';

describe('Tenant', () => {
  it('creates a tenant with a normalized uppercase document and default ACTIVE status', () => {
    const tenant = Tenant.create({
      name: 'Festival Exemplo Ltda',
      document: 'ab123456789012',
      slug: 'festival-exemplo',
    });

    expect(tenant.id).toBeDefined();
    expect(tenant.document).toBe('AB123456789012');
    expect(tenant.status).toBe('ACTIVE');
  });

  it('rejects a document that is not exactly 14 alphanumeric characters', () => {
    expect(() =>
      Tenant.create({ name: 'X', document: '123', slug: 'x' }),
    ).toThrow('document must be 14 alphanumeric characters');
  });

  it('rejects a slug with uppercase letters or invalid characters', () => {
    expect(() =>
      Tenant.create({
        name: 'X',
        document: 'AB123456789012',
        slug: 'Festival Exemplo',
      }),
    ).toThrow('slug must be lowercase letters, numbers and hyphens only');
  });
});
