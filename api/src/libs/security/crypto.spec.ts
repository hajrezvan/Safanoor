import { randomBytes } from 'node:crypto';
import { CryptoService } from './crypto.service';
describe('purpose-bound encryption and separate uniqueness HMAC', () => {
  it('authenticates ciphertext, supports old-key reads and keeps HMAC stable', () => {
    const old = randomBytes(32).toString('base64');
    process.env.ENCRYPTION_KEY_ID = 'v1';
    process.env.ENCRYPTION_KEYS = JSON.stringify({ v1: old });
    process.env.NATIONAL_ID_HMAC_KEY = 'unique-hmac-'.repeat(4);
    const before = new CryptoService();
    const value = before.encrypt('0084575948', 'national-id');
    expect(value).not.toContain('0084575948');
    expect(() => before.decrypt(value, 'medical')).toThrow();
    process.env.ENCRYPTION_KEY_ID = 'v2';
    process.env.ENCRYPTION_KEYS = JSON.stringify({
      v1: old,
      v2: randomBytes(32).toString('base64'),
    });
    const after = new CryptoService();
    expect(after.decrypt(value, 'national-id')).toBe('0084575948');
    expect(after.encrypt('0084575948', 'national-id')).toMatch(/^v2\./);
    expect(after.nationalIdHash('0084575948')).toBe(
      before.nationalIdHash('0084575948'),
    );
  });
});
