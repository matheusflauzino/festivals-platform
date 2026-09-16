export class AdminConflictError extends Error {
  constructor() {
    super('An admin with this email is already registered for this tenant');
    this.name = 'AdminConflictError';
  }
}
