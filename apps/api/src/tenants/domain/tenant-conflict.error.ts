export class TenantConflictError extends Error {
  constructor(
    public readonly field: 'slug' | 'document',
    value: string,
  ) {
    super(`Tenant with ${field} "${value}" already exists`);
    this.name = 'TenantConflictError';
  }
}
