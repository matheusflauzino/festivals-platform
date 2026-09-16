import { AdminUser } from './admin-user.entity';

describe('AdminUser', () => {
  const validInput = {
    tenantId: 'tenant-1',
    name: 'Carlos Souza',
    email: 'carlos@example.com',
    role: 'ORGANIZER' as const,
  };

  it('creates a pending invite with a generated token and no password', () => {
    const admin = AdminUser.invite(validInput);

    expect(admin.id).toBeDefined();
    expect(admin.status).toBe('PENDING');
    expect(admin.passwordHash).toBeNull();
    expect(admin.inviteToken).toBeDefined();
    expect(admin.inviteToken).not.toBeNull();
    expect((admin.inviteToken as string).length).toBeGreaterThanOrEqual(32);
  });

  it('rejects an invalid email', () => {
    expect(() =>
      AdminUser.invite({ ...validInput, email: 'not-an-email' }),
    ).toThrow('invalid email');
  });

  it('rejects an invalid role', () => {
    expect(() =>
      // @ts-expect-error deliberately invalid for this test
      AdminUser.invite({ ...validInput, role: 'SUPERADMIN' }),
    ).toThrow('invalid role');
  });

  it('activates a pending admin, setting the password hash and clearing the invite token', () => {
    const admin = AdminUser.invite(validInput);
    const activated = admin.activate('hashed-password');

    expect(activated.status).toBe('ACTIVE');
    expect(activated.passwordHash).toBe('hashed-password');
    expect(activated.inviteToken).toBeNull();
    expect(activated.id).toBe(admin.id);
  });

  it('rejects activating an already-active admin', () => {
    const admin = AdminUser.invite(validInput).activate('hashed-password');
    expect(() => admin.activate('other-hash')).toThrow('admin already active');
  });
});
