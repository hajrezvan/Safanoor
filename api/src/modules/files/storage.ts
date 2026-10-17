import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isUUID } from 'class-validator';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorageAdapter {
  put(key: string, body: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  signedGetUrl(key: string, actorId: string, seconds: number): Promise<string>;
}
export const STORAGE = Symbol('STORAGE');
export class LocalStorageAdapter implements StorageAdapter {
  private readonly root = resolve(process.env.LOCAL_STORAGE_PATH ?? '.storage');
  private readonly secret = process.env.STORAGE_SIGNING_KEY ?? '';
  constructor() {
    if (this.secret.length < 32)
      throw new Error('Storage signing key is required');
  }
  private path(key: string): string {
    if (!isUUID(key)) throw new Error('Invalid storage key');
    return resolve(this.root, key);
  }
  async put(key: string, body: Buffer): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await writeFile(this.path(key), body, { mode: 0o600 });
  }
  get(key: string): Promise<Buffer> {
    return readFile(this.path(key));
  }
  signedGetUrl(key: string, actorId: string, seconds: number): Promise<string> {
    this.path(key);
    if (!isUUID(actorId) || seconds < 1 || seconds > 60)
      throw new Error('Invalid signature scope');
    const value = Buffer.from(
      JSON.stringify({ key, actorId, expires: Date.now() + seconds * 1000 }),
    ).toString('base64url');
    const signature = createHmac('sha256', this.secret)
      .update(value)
      .digest('base64url');
    return Promise.resolve(
      `/api/v1/files/download?token=${value}.${signature}`,
    );
  }
  verify(token: string): { key: string; actorId: string } {
    const [value, signature] = token.split('.');
    if (!value || !signature) throw new Error('Invalid signed URL');
    const expected = createHmac('sha256', this.secret)
      .update(value)
      .digest('base64url');
    if (
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    )
      throw new Error('Invalid signed URL');
    const result = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as { key: string; actorId: string; expires: number };
    if (
      !isUUID(result.key) ||
      !isUUID(result.actorId) ||
      result.expires <= Date.now() ||
      result.expires > Date.now() + 60000
    )
      throw new Error('Expired signed URL');
    return result;
  }
}
export class S3StorageAdapter implements StorageAdapter {
  private readonly client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
    },
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: true,
  });
  private readonly signingClient = new S3Client({
    endpoint: process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
    },
  });
  private readonly bucket = process.env.S3_BUCKET ?? 'safanoor';
  async put(key: string, body: Buffer, mime: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mime,
      }),
    );
  }
  async get(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!response.Body) throw new Error('Object unavailable');
    return Buffer.from(await response.Body.transformToByteArray());
  }
  signedGetUrl(
    key: string,
    _actorId: string,
    seconds: number,
  ): Promise<string> {
    if (seconds < 1 || seconds > 60)
      throw new Error('Invalid signed URL lifetime');
    return getSignedUrl(
      this.signingClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: seconds },
    );
  }
}
