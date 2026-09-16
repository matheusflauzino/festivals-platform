export class FestivalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FestivalValidationError';
  }
}
