import { Festival } from './festival.entity';

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
  });

  it('rejects an invalid Brazilian state code', () => {
    expect(() =>
      Festival.create({ ...baseInput, allowedStates: ['XX'] as never }),
    ).toThrow('invalid state: XX');
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
});
