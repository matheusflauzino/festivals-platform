export class InvalidFestivalStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFestivalStateError';
  }
}
