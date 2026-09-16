import { describe, expect, it } from 'vitest';
import {
  inviteAdminUserSchema,
  acceptAdminInviteSchema,
  loginAdminUserSchema,
} from './admin-auth.schema';

describe('inviteAdminUserSchema', () => {
  it('accepts a valid payload', () => {
    const result = inviteAdminUserSchema.safeParse({
      name: 'Carlos Souza',
      email: 'carlos@example.com',
      role: 'JUDGE',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid role', () => {
    const result = inviteAdminUserSchema.safeParse({
      name: 'Carlos Souza',
      email: 'carlos@example.com',
      role: 'SUPERADMIN',
    });
    expect(result.success).toBe(false);
  });
});

describe('acceptAdminInviteSchema', () => {
  it('accepts a valid password', () => {
    expect(acceptAdminInviteSchema.safeParse({ password: 'a-strong-password' }).success).toBe(
      true,
    );
  });

  it('rejects a short password', () => {
    expect(acceptAdminInviteSchema.safeParse({ password: 'short' }).success).toBe(false);
  });
});

describe('loginAdminUserSchema', () => {
  it('accepts a valid email/password pair', () => {
    expect(
      loginAdminUserSchema.safeParse({ email: 'carlos@example.com', password: 'x' }).success,
    ).toBe(true);
  });

  it('rejects a non-email identifier (admin login is email-only, unlike participants)', () => {
    expect(loginAdminUserSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(
      false,
    );
  });
});
