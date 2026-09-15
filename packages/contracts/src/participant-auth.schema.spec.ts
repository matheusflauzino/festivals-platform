import { describe, expect, it } from 'vitest';
import { registerParticipantSchema, loginParticipantSchema } from './participant-auth.schema';

describe('registerParticipantSchema', () => {
  it('accepts a valid payload', () => {
    const result = registerParticipantSchema.safeParse({
      name: 'Ana Silva',
      email: 'ana@example.com',
      cpf: '12345678901',
      password: 'a-strong-password',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a cpf that is not 11 digits', () => {
    const result = registerParticipantSchema.safeParse({
      name: 'Ana Silva',
      email: 'ana@example.com',
      cpf: '123',
      password: 'a-strong-password',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = registerParticipantSchema.safeParse({
      name: 'Ana Silva',
      email: 'ana@example.com',
      cpf: '12345678901',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginParticipantSchema', () => {
  it('accepts an email or cpf as the identifier', () => {
    expect(
      loginParticipantSchema.safeParse({ identifier: 'ana@example.com', password: 'x' })
        .success,
    ).toBe(true);
    expect(
      loginParticipantSchema.safeParse({ identifier: '12345678901', password: 'x' })
        .success,
    ).toBe(true);
  });

  it('rejects an empty password', () => {
    const result = loginParticipantSchema.safeParse({
      identifier: 'ana@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});
