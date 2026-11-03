import { randomUUID } from 'node:crypto';
import {
  LocalStorageAdapter,
  EncryptedStorageAdapter,
  StorageAdapter,
} from './storage';
describe('short-lived scoped local storage signatures', () => {
  beforeAll(() => {
    process.env.STORAGE_SIGNING_KEY = 'test-key-'.repeat(8);
  });
  it('binds the actor and key, rejects tampering and expires', async () => {
    const adapter = new LocalStorageAdapter();
    const key = randomUUID();
    const actorId = randomUUID();
    const url = await adapter.signedGetUrl(key, actorId, 60);
    const token = new URL(url, 'http://localhost').searchParams.get('token')!;
    expect(adapter.verify(token)).toMatchObject({ key, actorId });
    expect(() => adapter.verify(token + 'x')).toThrow();
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);
    expect(() => adapter.verify(token)).toThrow();
    jest.restoreAllMocks();
  });
  it('rejects traversal keys and long-lived signatures', () => {
    const adapter = new LocalStorageAdapter();
    expect(() =>
      adapter.signedGetUrl('../private', randomUUID(), 60),
    ).toThrow();
    expect(() =>
      adapter.signedGetUrl(randomUUID(), randomUUID(), 3600),
    ).toThrow();
  });
});

describe('encrypted object storage', () => {
  const previous = {
    keys: process.env.ENCRYPTION_KEYS,
    keyId: process.env.ENCRYPTION_KEY_ID,
    hmac: process.env.NATIONAL_ID_HMAC_KEY,
  };
  beforeAll(() => {
    process.env.ENCRYPTION_KEY_ID = 'v1';
    process.env.ENCRYPTION_KEYS = JSON.stringify({
      v1: Buffer.alloc(32, 7).toString('base64'),
    });
    process.env.NATIONAL_ID_HMAC_KEY = 'test-hmac-'.repeat(8);
    process.env.STORAGE_SIGNING_KEY = 'test-signing-'.repeat(8);
  });
  afterAll(() => {
    for (const [key, value] of Object.entries({
      ENCRYPTION_KEYS: previous.keys,
      ENCRYPTION_KEY_ID: previous.keyId,
      NATIONAL_ID_HMAC_KEY: previous.hmac,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  it('stores ciphertext, decrypts only in the API, and rejects object substitution or tampering', async () => {
    const data = new Map<string, Buffer>();
    const raw: StorageAdapter = {
      put: (key, body, mime) => {
        expect(mime).toBe('application/octet-stream');
        data.set(key, body);
        return Promise.resolve();
      },
      get: (key) => Promise.resolve(data.get(key)!),
      signedGetUrl: () => {
        throw new Error('Provider URLs must not be exposed');
      },
    };
    const secure = new EncryptedStorageAdapter(raw);
    const key = randomUUID();
    const body = Buffer.from('private image bytes');
    await secure.put(key, body);
    expect(data.get(key)?.includes(body)).toBe(false);
    expect(await secure.get(key)).toEqual(body);
    const url = await secure.signedGetUrl(key, randomUUID(), 60);
    expect(url).toMatch(/^\/api\/v1\/files\/download\?token=/);
    const token = new URL(url, 'http://localhost').searchParams.get('token')!;
    expect(secure.verify(token).key).toBe(key);
    const otherKey = randomUUID();
    data.set(otherKey, data.get(key)!);
    await expect(secure.get(otherKey)).rejects.toThrow();
    const encrypted = data.get(key)!;
    const corrupt = Buffer.from(encrypted);
    corrupt[corrupt.length - 3] ^= 1;
    data.set(key, corrupt);
    await expect(secure.get(key)).rejects.toThrow();
    data.set(key, body);
    await expect(secure.get(key)).rejects.toThrow('must be encrypted');
  });
});
