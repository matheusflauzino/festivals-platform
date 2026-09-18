import { Registration } from './registration.entity';
import { RegistrationValidationError } from './registration-validation.error';

const baseInput = {
  tenantId: 'tenant-1',
  festivalId: 'festival-1',
  participantName: 'Mai Sato',
  participantEmail: 'mai.sato@example.com',
  participantCpf: '86359899531',
  songName: 'Chora Menino',
  performers: 'Mai Sato: Canto e Harpa',
};

describe('Registration', () => {
  it('creates a registration with the given props', () => {
    const registration = Registration.create(baseInput);

    expect(registration.id).toBeDefined();
    expect(registration.tenantId).toBe('tenant-1');
    expect(registration.festivalId).toBe('festival-1');
    expect(registration.participantName).toBe('Mai Sato');
    expect(registration.songName).toBe('Chora Menino');
    expect(registration.musicComposer).toBeNull();
    expect(registration.lyricsComposer).toBeNull();
    expect(registration.videoUrl).toBeNull();
    expect(registration.createdAt).toBeInstanceOf(Date);
  });

  it('accepts the optional fields when provided', () => {
    const registration = Registration.create({
      ...baseInput,
      musicComposer: 'Mai Sato',
      lyricsComposer: 'Mai Sato',
      videoUrl: 'https://youtube.com/watch?v=abc123',
    });

    expect(registration.musicComposer).toBe('Mai Sato');
    expect(registration.lyricsComposer).toBe('Mai Sato');
    expect(registration.videoUrl).toBe('https://youtube.com/watch?v=abc123');
  });

  it('rejects a whitespace-only participantName', () => {
    expect(() =>
      Registration.create({ ...baseInput, participantName: '   ' }),
    ).toThrow(RegistrationValidationError);
  });

  it('rejects a whitespace-only songName', () => {
    expect(() =>
      Registration.create({ ...baseInput, songName: '   ' }),
    ).toThrow(RegistrationValidationError);
  });

  it('rejects a whitespace-only performers', () => {
    expect(() =>
      Registration.create({ ...baseInput, performers: '   ' }),
    ).toThrow(RegistrationValidationError);
  });

  it('rejects a participantCpf that is not exactly 11 digits', () => {
    expect(() =>
      Registration.create({ ...baseInput, participantCpf: '123' }),
    ).toThrow('participantCpf must be exactly 11 digits');
  });

  it('restores a registration from persisted props without re-validating', () => {
    const restored = Registration.restore({
      id: 'reg-1',
      tenantId: 'tenant-1',
      festivalId: 'festival-1',
      participantName: 'Mai Sato',
      participantEmail: 'mai.sato@example.com',
      participantCpf: '86359899531',
      songName: 'Chora Menino',
      performers: 'Mai Sato: Canto e Harpa',
      musicComposer: null,
      lyricsComposer: null,
      videoUrl: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });

    expect(restored.id).toBe('reg-1');
  });
});
