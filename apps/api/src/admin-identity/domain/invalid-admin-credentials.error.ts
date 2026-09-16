export class InvalidAdminCredentialsError extends Error {
  constructor() {
    super('invalid credentials');
    this.name = 'InvalidAdminCredentialsError';
  }
}
