export class UserConflictError extends Error {
  constructor(public readonly field: 'email' | 'cpf') {
    super(`A user with this ${field} is already registered`);
    this.name = 'UserConflictError';
  }
}
