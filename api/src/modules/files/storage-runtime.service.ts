import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CryptoService } from '../../libs/security/crypto.service';
import { one } from '../../libs/database/database.types';
import {
  EncryptedStorageAdapter,
  envS3Config,
  LocalStorageAdapter,
  S3ConnectionConfig,
  S3StorageAdapter,
  StorageAdapter,
} from './storage';

export type StorageMode = 'local' | 'remote';

export type StorageStatus = {
  mode: StorageMode;
  driver: 's3' | 'local';
  endpoint: string;
  publicEndpoint: string;
  bucket: string;
  region: string;
  accessKey: string;
  hasSecret: boolean;
  healthy: boolean;
  healthError?: string;
};

type StoredRow = {
  mode: StorageMode;
  endpoint: string | null;
  publicEndpoint: string | null;
  bucket: string | null;
  region: string | null;
  accessKey: string | null;
  secretKeyEnc: string | null;
};

@Injectable()
export class StorageRuntimeService implements OnModuleInit {
  private readonly logger = new Logger(StorageRuntimeService.name);
  private adapter: StorageAdapter;
  private status: StorageStatus;

  constructor(
    private readonly db: DataSource,
    private readonly crypto: CryptoService,
  ) {
    const fallback = this.buildFromEnv();
    this.adapter = fallback.adapter;
    this.status = fallback.status;
  }

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  current(): StorageAdapter {
    return this.adapter;
  }

  snapshot(): StorageStatus {
    return { ...this.status };
  }

  async reload(): Promise<StorageStatus> {
    const row = await one<StoredRow>(
      this.db,
      `SELECT mode,
              endpoint,
              public_endpoint AS "publicEndpoint",
              bucket,
              region,
              access_key AS "accessKey",
              secret_key_enc AS "secretKeyEnc"
         FROM storage_settings WHERE id=true`,
    ).catch(() => null);

    if (row?.mode === 'remote' && row.endpoint && row.bucket && row.accessKey && row.secretKeyEnc) {
      const config: S3ConnectionConfig = {
        endpoint: row.endpoint,
        publicEndpoint: row.publicEndpoint || row.endpoint,
        bucket: row.bucket,
        region: row.region || 'us-east-1',
        accessKey: row.accessKey,
        secretKey: this.crypto.decrypt(row.secretKeyEnc, 'system:storage'),
      };
      const raw = new S3StorageAdapter(config);
      this.adapter = new EncryptedStorageAdapter(raw);
      this.status = await this.withHealth({
        mode: 'remote',
        driver: 's3',
        endpoint: config.endpoint,
        publicEndpoint: config.publicEndpoint || config.endpoint,
        bucket: config.bucket,
        region: config.region,
        accessKey: config.accessKey,
        hasSecret: true,
        healthy: false,
      }, raw);
      this.logger.log(`Storage active: remote MinIO/S3 @ ${config.endpoint}`);
      return this.snapshot();
    }

    const built = this.buildFromEnv();
    this.adapter = built.adapter;
    this.status = built.raw
      ? await this.withHealth(built.status, built.raw)
      : built.status;
    this.logger.log(
      `Storage active: ${this.status.driver} (${this.status.mode}) @ ${this.status.endpoint || 'filesystem'}`,
    );
    return this.snapshot();
  }

  async saveRemote(
    input: {
      endpoint: string;
      publicEndpoint?: string;
      bucket: string;
      region?: string;
      accessKey: string;
      secretKey: string;
    },
    actorId: string,
  ): Promise<StorageStatus> {
    const secretEnc = this.crypto.encrypt(input.secretKey, 'system:storage');
    await this.db.query(
      `INSERT INTO storage_settings(id, mode, endpoint, public_endpoint, bucket, region, access_key, secret_key_enc, updated_at, updated_by)
       VALUES (true,'remote',$1,$2,$3,$4,$5,$6,now(),$7)
       ON CONFLICT (id) DO UPDATE SET
         mode='remote',
         endpoint=EXCLUDED.endpoint,
         public_endpoint=EXCLUDED.public_endpoint,
         bucket=EXCLUDED.bucket,
         region=EXCLUDED.region,
         access_key=EXCLUDED.access_key,
         secret_key_enc=EXCLUDED.secret_key_enc,
         updated_at=now(),
         updated_by=EXCLUDED.updated_by`,
      [
        input.endpoint,
        input.publicEndpoint || input.endpoint,
        input.bucket,
        input.region || 'us-east-1',
        input.accessKey,
        secretEnc,
        actorId,
      ],
    );
    return this.reload();
  }

  async useLocal(actorId: string): Promise<StorageStatus> {
    await this.db.query(
      `INSERT INTO storage_settings(id, mode, endpoint, public_endpoint, bucket, region, access_key, secret_key_enc, updated_at, updated_by)
       VALUES (true,'local',NULL,NULL,NULL,NULL,NULL,NULL,now(),$1)
       ON CONFLICT (id) DO UPDATE SET
         mode='local',
         endpoint=NULL,
         public_endpoint=NULL,
         bucket=NULL,
         region=NULL,
         access_key=NULL,
         secret_key_enc=NULL,
         updated_at=now(),
         updated_by=EXCLUDED.updated_by`,
      [actorId],
    );
    return this.reload();
  }

  private buildFromEnv(): { adapter: StorageAdapter; status: StorageStatus; raw?: S3StorageAdapter } {
    if (process.env.STORAGE_DRIVER === 's3') {
      const config = envS3Config();
      const raw = new S3StorageAdapter(config);
      return {
        adapter: new EncryptedStorageAdapter(raw),
        raw,
        status: {
          mode: 'local',
          driver: 's3',
          endpoint: config.endpoint,
          publicEndpoint: config.publicEndpoint || config.endpoint,
          bucket: config.bucket,
          region: config.region,
          accessKey: config.accessKey,
          hasSecret: Boolean(config.secretKey),
          healthy: false,
        },
      };
    }
    return {
      adapter: new LocalStorageAdapter(),
      status: {
        mode: 'local',
        driver: 'local',
        endpoint: process.env.LOCAL_STORAGE_PATH ?? '.storage',
        publicEndpoint: '',
        bucket: '',
        region: '',
        accessKey: '',
        hasSecret: false,
        healthy: true,
      },
    };
  }

  private async withHealth(
    status: StorageStatus,
    raw: S3StorageAdapter,
  ): Promise<StorageStatus> {
    try {
      await raw.probe();
      return { ...status, healthy: true, healthError: undefined };
    } catch (error) {
      return {
        ...status,
        healthy: false,
        healthError: error instanceof Error ? error.message : 'probe failed',
      };
    }
  }
}
