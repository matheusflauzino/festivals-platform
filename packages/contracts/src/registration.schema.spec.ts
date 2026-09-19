import { describe, expect, it } from 'vitest';
import { createRegistrationSchema } from './registration.schema';

const validPayload = {
  participantName: 'Mai Sato',
  participantEmail: 'mai.sato@example.com',
  participantCpf: '86359899531',
  songName: 'Chora Menino',
  performers: 'Mai Sato: Canto e Harpa',
};

describe('createRegistrationSchema', () => {
  it('accepts a valid minimal payload', () => {
    expect(createRegistrationSchema.safeParse(validPayload).success).toBe(true);
  });

  it('accepts optional fields when present', () => {
    const result = createRegistrationSchema.safeParse({
      ...validPayload,
      musicComposer: 'Mai Sato',
      lyricsComposer: 'Mai Sato',
      videoUrl: 'https://youtube.com/watch?v=abc123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a CPF that is not exactly 11 digits', () => {
    expect(
      createRegistrationSchema.safeParse({ ...validPayload, participantCpf: '123' }).success,
    ).toBe(false);
  });

  it('rejects an invalid e-mail', () => {
    expect(
      createRegistrationSchema.safeParse({ ...validPayload, participantEmail: 'not-an-email' })
        .success,
    ).toBe(false);
  });

  it('rejects a whitespace-only participantName', () => {
    expect(
      createRegistrationSchema.safeParse({ ...validPayload, participantName: '   ' }).success,
    ).toBe(false);
  });

  it('rejects a whitespace-only songName', () => {
    expect(createRegistrationSchema.safeParse({ ...validPayload, songName: '   ' }).success).toBe(
      false,
    );
  });

  it('rejects an invalid videoUrl', () => {
    expect(
      createRegistrationSchema.safeParse({ ...validPayload, videoUrl: 'not-a-url' }).success,
    ).toBe(false);
  });

  it('accepts text fields at the 255-character limit and rejects 256', () => {
    const atLimit = 'a'.repeat(255);
    const overLimit = 'a'.repeat(256);
    for (const field of ['participantName', 'songName', 'musicComposer', 'lyricsComposer']) {
      expect(
        createRegistrationSchema.safeParse({ ...validPayload, [field]: atLimit }).success,
      ).toBe(true);
      expect(
        createRegistrationSchema.safeParse({ ...validPayload, [field]: overLimit }).success,
      ).toBe(false);
    }
  });

  it('rejects a videoUrl longer than 2048 characters', () => {
    const longUrl = `https://example.com/${'v'.repeat(2048)}`;
    expect(
      createRegistrationSchema.safeParse({ ...validPayload, videoUrl: longUrl }).success,
    ).toBe(false);
  });

  it('accepts a null videoUrl', () => {
    expect(createRegistrationSchema.safeParse({ ...validPayload, videoUrl: null }).success).toBe(
      true,
    );
  });
});
