import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('produces a hash that is not the plaintext password', async () => {
    const hash = await service.hash('password123');
    expect(hash).not.toBe('password123');
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it('verifies a matching password', async () => {
    const hash = await service.hash('password123');
    await expect(service.verify(hash, 'password123')).resolves.toBe(true);
  });

  it('rejects a non-matching password', async () => {
    const hash = await service.hash('password123');
    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('salts each hash independently, even for the same password', async () => {
    const [a, b] = await Promise.all([
      service.hash('same-password'),
      service.hash('same-password'),
    ]);
    expect(a).not.toBe(b);
  });
});
