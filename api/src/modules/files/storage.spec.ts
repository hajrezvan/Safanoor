import { randomUUID } from 'node:crypto';
import { LocalStorageAdapter } from './storage';
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
