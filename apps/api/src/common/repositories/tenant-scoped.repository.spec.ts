import { TenantScopedRepository } from './tenant-scoped.repository';

class TestRepository extends TenantScopedRepository {
  buildWhere(tenantId: string, extra?: object) {
    return this.tenantScoped(tenantId, extra);
  }
}

describe('TenantScopedRepository', () => {
  it('injects tenantId into an empty where clause', () => {
    const repo = new TestRepository();
    expect(repo.buildWhere('tenant-1')).toEqual({ tenantId: 'tenant-1' });
  });

  it('merges tenantId alongside other where conditions', () => {
    const repo = new TestRepository();
    expect(repo.buildWhere('tenant-1', { email: 'ana@example.com' })).toEqual({
      email: 'ana@example.com',
      tenantId: 'tenant-1',
    });
  });

  it('does not let a caller-supplied tenantId override the real one', () => {
    const repo = new TestRepository();
    expect(
      repo.buildWhere('tenant-1', { tenantId: 'attacker-tenant' }),
    ).toEqual({
      tenantId: 'tenant-1',
    });
  });
});
