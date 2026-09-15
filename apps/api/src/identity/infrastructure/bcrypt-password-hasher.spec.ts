import { BcryptPasswordHasher } from './bcrypt-password-hasher';

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher();

  it('hashes a password and verifies it matches', async () => {
    const hash = await hasher.hash('correct horse battery staple');
    await expect(
      hasher.compare('correct horse battery staple', hash),
    ).resolves.toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await hasher.hash('correct horse battery staple');
    await expect(hasher.compare('wrong password', hash)).resolves.toBe(false);
  });

  it('verifies a hash using the $2y$ prefix (PHP/Laravel bcrypt variant)', async () => {
    // A bcryptjs-generated hash for 'secret123' with its $2b$ prefix rewritten to
    // $2y$ — the two prefixes are algorithmically interchangeable (verified before
    // writing this plan: bcrypt.compare('secret123', legacyHash) resolves true).
    const legacyHash =
      '$2y$10$M4cDo4hP7sKB0l3SGYrt1unhAr.8VQSXpTEmPQqLp/Dage.w.nd6i';
    await expect(hasher.compare('secret123', legacyHash)).resolves.toBe(true);
  });
});
