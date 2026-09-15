import { User } from './user.entity';

describe('User', () => {
  const validInput = {
    tenantId: 'tenant-1',
    name: 'Ana Silva',
    email: 'ana@example.com',
    cpf: '12345678901',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
  };

  it('creates a user with the given fields', () => {
    const user = User.create(validInput);

    expect(user.id).toBeDefined();
    expect(user.tenantId).toBe('tenant-1');
    expect(user.email).toBe('ana@example.com');
    expect(user.cpf).toBe('12345678901');
  });

  it('rejects an invalid email', () => {
    expect(() => User.create({ ...validInput, email: 'not-an-email' })).toThrow(
      'invalid email',
    );
  });

  it('rejects a CPF that is not exactly 11 digits', () => {
    expect(() => User.create({ ...validInput, cpf: '123' })).toThrow(
      'cpf must be 11 digits',
    );
  });
});
