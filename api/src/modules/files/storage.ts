import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isUUID } from 'class-validator';
import { CryptoService } from '../../libs/security/crypto.service';
import {
  GetObjectCommand,
  HeadBucketCommand,
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

export type S3ConnectionConfig = {
  endpoint: string;
  publicEndpoint?: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
};

export function envS3Config(): S3ConnectionConfig {
  return {
    endpoint: process.env.S3_ENDPOINT ?? 'http://127.0.0.1:9000',
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket: process.env.S3_BUCKET ?? 'safanoor',
    accessKey: process.env.S3_ACCESS_KEY ?? '',
    secretKey: process.env.S3_SECRET_KEY ?? '',
  };
}

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
  private readonly client: S3Client;
  private readonly signingClient: S3Client;
  private readonly bucket: string;
  constructor(config: S3ConnectionConfig = envS3Config()) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      region: config.region,
      forcePathStyle: true,
    });
    this.signingClient = new S3Client({
      endpoint: config.publicEndpoint || config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    });
  }
  destroy(): void {
    this.client.destroy();
    this.signingClient.destroy();
  }
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
  async probe(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }
}

/** Encrypt private objects before sending them to an S3-compatible provider.
 * Downloads use the API token route, so storage publicity cannot expose images.
 */
export class EncryptedStorageAdapter implements StorageAdapter {
  private readonly crypto = new CryptoService();
  private readonly signatures = new LocalStorageAdapter();
  private readonly prefix = 'SAFANOOR-ENCRYPTED-V1\n';
  constructor(private readonly raw: StorageAdapter) {}
  async put(key: string, body: Buffer): Promise<void> {
    const encrypted =
      this.prefix +
      this.crypto.encrypt(body.toString('base64'), `storage:${key}`);
    await this.raw.put(
      key,
      Buffer.from(encrypted, 'utf8'),
      'application/octet-stream',
    );
  }
  async get(key: string): Promise<Buffer> {
    const stored = (await this.raw.get(key)).toString('utf8');
    if (!stored.startsWith(this.prefix))
      throw new Error('Storage object must be encrypted');
    return Buffer.from(
      this.crypto.decrypt(stored.slice(this.prefix.length), `storage:${key}`),
      'base64',
    );
  }
  signedGetUrl(key: string, actorId: string, seconds: number): Promise<string> {
    return this.signatures.signedGetUrl(key, actorId, seconds);
  }
  verify(token: string): { key: string; actorId: string } {
    return this.signatures.verify(token);
  }
  get underlying(): StorageAdapter {
    return this.raw;
  }
}

/** Delegates to the active adapter so admin can switch MinIO without restart. */
export class SwitchingStorageAdapter implements StorageAdapter {
  constructor(private resolve: () => StorageAdapter) {}
  put(key: string, body: Buffer, mime: string): Promise<void> {
    return this.resolve().put(key, body, mime);
  }
  get(key: string): Promise<Buffer> {
    return this.resolve().get(key);
  }
  signedGetUrl(key: string, actorId: string, seconds: number): Promise<string> {
    return this.resolve().signedGetUrl(key, actorId, seconds);
  }
  verify(token: string): { key: string; actorId: string } {
    const current = this.resolve();
    if (current instanceof EncryptedStorageAdapter) return current.verify(token);
    if (current instanceof LocalStorageAdapter) return current.verify(token);
    throw new Error('Signed local download is unavailable for this storage');
  }
}
