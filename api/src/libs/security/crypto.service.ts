import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';

@Injectable()
export class CryptoService {
  private readonly keys: Record<string, string>;
  private readonly current: string;
  constructor() {
    this.current = process.env.ENCRYPTION_KEY_ID ?? 'v1';
    this.keys = JSON.parse(process.env.ENCRYPTION_KEYS ?? '{}') as Record<
      string,
      string
    >;
    if (
      !this.keys[this.current] ||
      Buffer.from(this.keys[this.current], 'base64').length !== 32
    )
      throw new Error('A 32-byte encryption key is required');
    if (
      !process.env.NATIONAL_ID_HMAC_KEY ||
      process.env.NATIONAL_ID_HMAC_KEY.length < 32
    )
      throw new Error('A separate national ID HMAC key is required');
  }
  encrypt(value: string, purpose: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(
      'aes-256-gcm',
      Buffer.from(this.keys[this.current], 'base64'),
      iv,
    );
    cipher.setAAD(Buffer.from(purpose));
    const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [
      this.current,
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      body.toString('base64'),
    ].join('.');
  }
  decrypt(value: string, purpose: string): string {
    const [keyId, iv, tag, body] = value.split('.');
    const key = this.keys[keyId];
    if (!key || !iv || !tag || !body)
      throw new Error('Invalid encrypted value');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      Buffer.from(key, 'base64'),
      Buffer.from(iv, 'base64'),
    );
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(body, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
  nationalIdHash(value: string): string {
    return createHmac('sha256', process.env.NATIONAL_ID_HMAC_KEY!)
      .update(value)
      .digest('hex');
  }
}
