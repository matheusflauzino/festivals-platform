import { Festival } from './festival.entity';
import { FestivalValidationError } from './festival-validation.error';
import { InvalidFestivalStateError } from './invalid-festival-state.error';

const baseInput = {
  tenantId: 'tenant-1',
  number: 58,
  year: 2026,
  name: 'FENAC 2026',
  registrationBegin: new Date('2026-01-01T08:00:00Z'),
  registrationEnd: new Date('2026-03-01T18:00:00Z'),
  inscriptionFee: 25,
};

describe('Festival', () => {
  it('creates a DRAFT festival with no state restriction by default', () => {
    const festival = Festival.create(baseInput);

    expect(festival.id).toBeDefined();
    expect(festival.status).toBe('DRAFT');
    expect(festival.allowedStates).toEqual([]);
    expect(festival.votingBegin).toBeNull();
  });

  it('rejects a registrationBegin that is not before registrationEnd', () => {
    expect(() =>
      Festival.create({
        ...baseInput,
        registrationBegin: new Date('2026-03-01T18:00:00Z'),
        registrationEnd: new Date('2026-01-01T08:00:00Z'),
      }),
    ).toThrow('registrationBegin must be before registrationEnd');
    expect(() =>
      Festival.create({
        ...baseInput,
        registrationBegin: new Date('2026-03-01T18:00:00Z'),
        registrationEnd: new Date('2026-01-01T08:00:00Z'),
      }),
    ).toThrow(FestivalValidationError);
  });

  it('rejects an invalid Brazilian state code', () => {
    expect(() =>
      Festival.create({ ...baseInput, allowedStates: ['XX'] as never }),
    ).toThrow('invalid state: XX');
    expect(() =>
      Festival.create({ ...baseInput, allowedStates: ['XX'] as never }),
    ).toThrow(FestivalValidationError);
  });

  it('rejects votingBegin set without votingEnd', () => {
    expect(() =>
      Festival.create({
        ...baseInput,
        votingBegin: new Date('2026-02-01T08:00:00Z'),
      }),
    ).toThrow(FestivalValidationError);
  });

  it('rejects a whitespace-only name', () => {
    expect(() => Festival.create({ ...baseInput, name: '   ' })).toThrow(
      FestivalValidationError,
    );
  });

  it('rejects a negative inscriptionFee', () => {
    expect(() => Festival.create({ ...baseInput, inscriptionFee: -1 })).toThrow(
      FestivalValidationError,
    );
  });

  it('rejects a non-positive integer number', () => {
    expect(() => Festival.create({ ...baseInput, number: 0 })).toThrow(
      FestivalValidationError,
    );
  });

  it('rejects an invalid year', () => {
    expect(() => Festival.create({ ...baseInput, year: 1899 })).toThrow(
      FestivalValidationError,
    );
  });

  it('publish() moves a DRAFT festival to OPEN', () => {
    const festival = Festival.create(baseInput);
    const published = festival.publish();

    expect(published.status).toBe('OPEN');
    expect(festival.status).toBe('DRAFT'); // original instance untouched
  });

  it('publish() rejects a festival that is not DRAFT', () => {
    const festival = Festival.create(baseInput).publish();
    expect(() => festival.publish()).toThrow(
      'only a DRAFT festival can be published',
    );
  });

  it('close() moves an OPEN festival to CLOSED, and rejects a non-OPEN one', () => {
    const draft = Festival.create(baseInput);
    expect(() => draft.close()).toThrow('only an OPEN festival can be closed');

    const closed = draft.publish().close();
    expect(closed.status).toBe('CLOSED');
  });

  it('updateDetails() returns a new instance with updated fields, preserving id/status', () => {
    const festival = Festival.create(baseInput);
    const updated = festival.updateDetails({
      ...baseInput,
      name: 'FENAC 2026 — Edição Revisada',
      inscriptionFee: 30,
    });

    expect(updated.id).toBe(festival.id);
    expect(updated.status).toBe('DRAFT');
    expect(updated.name).toBe('FENAC 2026 — Edição Revisada');
    expect(updated.inscriptionFee).toBe(30);
  });

  it('updateDetails() preserves votingBegin/votingEnd/regulationUrl/allowedStates when omitted from the input', () => {
    const festival = Festival.create({
      ...baseInput,
      votingBegin: new Date('2026-02-01T08:00:00Z'),
      votingEnd: new Date('2026-02-15T08:00:00Z'),
      regulationUrl: 'https://example.com/regulation.pdf',
      allowedStates: ['MG', 'SP'],
    });

    // Simulate a PATCH body that omits the four optional keys entirely
    // (as parsed by Zod, the keys are genuinely absent -> undefined).
    const patchInput: Parameters<typeof festival.updateDetails>[0] = {
      name: festival.name,
      registrationBegin: festival.registrationBegin,
      registrationEnd: festival.registrationEnd,
      inscriptionFee: 30,
    };

    const updated = festival.updateDetails(patchInput);

    expect(updated.inscriptionFee).toBe(30);
    expect(updated.votingBegin).toEqual(new Date('2026-02-01T08:00:00Z'));
    expect(updated.votingEnd).toEqual(new Date('2026-02-15T08:00:00Z'));
    expect(updated.regulationUrl).toBe('https://example.com/regulation.pdf');
    expect(updated.allowedStates).toEqual(['MG', 'SP']);
  });

  it('updateDetails() clears votingBegin/votingEnd/regulationUrl when explicitly set to null', () => {
    const festival = Festival.create({
      ...baseInput,
      votingBegin: new Date('2026-02-01T08:00:00Z'),
      votingEnd: new Date('2026-02-15T08:00:00Z'),
      regulationUrl: 'https://example.com/regulation.pdf',
      allowedStates: ['MG'],
    });

    const updated = festival.updateDetails({
      ...baseInput,
      votingBegin: null,
      votingEnd: null,
      regulationUrl: null,
      allowedStates: [],
    });

    expect(updated.votingBegin).toBeNull();
    expect(updated.votingEnd).toBeNull();
    expect(updated.regulationUrl).toBeNull();
    expect(updated.allowedStates).toEqual([]);
  });

  it('updateDetails() rejects editing a CLOSED festival', () => {
    const festival = Festival.create(baseInput).publish().close();

    expect(() => festival.updateDetails(baseInput)).toThrow(
      InvalidFestivalStateError,
    );
    expect(() => festival.updateDetails(baseInput)).toThrow(
      'a CLOSED festival cannot be edited',
    );
  });

  it('updateDetails() allows editing a DRAFT or OPEN festival', () => {
    const draft = Festival.create(baseInput);
    expect(() => draft.updateDetails(baseInput)).not.toThrow();

    const open = draft.publish();
    expect(() => open.updateDetails(baseInput)).not.toThrow();
  });

  it('accepts registrations when OPEN and within the registration window', () => {
    const festival = Festival.create(baseInput).publish();
    const now = new Date('2026-02-01T00:00:00Z');
    expect(festival.isAcceptingRegistrations(now)).toBe(true);
  });

  it('does not accept registrations when still DRAFT', () => {
    const festival = Festival.create(baseInput);
    const now = new Date('2026-02-01T00:00:00Z');
    expect(festival.isAcceptingRegistrations(now)).toBe(false);
  });

  it('does not accept registrations when CLOSED', () => {
    const festival = Festival.create(baseInput).publish().close();
    const now = new Date('2026-02-01T00:00:00Z');
    expect(festival.isAcceptingRegistrations(now)).toBe(false);
  });

  it('does not accept registrations before registrationBegin', () => {
    const festival = Festival.create(baseInput).publish();
    const now = new Date('2025-12-31T00:00:00Z');
    expect(festival.isAcceptingRegistrations(now)).toBe(false);
  });

  it('does not accept registrations after registrationEnd', () => {
    const festival = Festival.create(baseInput).publish();
    const now = new Date('2026-03-02T00:00:00Z');
    expect(festival.isAcceptingRegistrations(now)).toBe(false);
  });
});
