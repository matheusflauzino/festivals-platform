export class FestivalConflictError extends Error {
  constructor(
    public readonly number: number,
    public readonly year: number,
  ) {
    super(`Festival ${number}/${year} already exists for this tenant`);
    this.name = 'FestivalConflictError';
  }
}
