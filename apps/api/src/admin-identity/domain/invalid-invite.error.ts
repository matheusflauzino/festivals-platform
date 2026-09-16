export class InvalidInviteError extends Error {
  constructor() {
    super('invalid or already-used invite token');
    this.name = 'InvalidInviteError';
  }
}
