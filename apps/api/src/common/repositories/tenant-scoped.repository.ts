export abstract class TenantScopedRepository {
  protected tenantScoped(tenantId: string, where: object = {}): object {
    return { ...where, tenantId };
  }
}
