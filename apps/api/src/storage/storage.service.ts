import { Inject, Injectable } from '@nestjs/common';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { ApiEnv } from '@instagram-clone/config';

import { API_ENV } from '../config/config.module';

/** How long a presigned upload URL stays valid (docs/ARCHITECTURE.md §8). */
const PRESIGNED_UPLOAD_TTL_SECONDS = 300;

/**
 * Thin wrapper around the AWS SDK v3 S3 client — the only place in the app
 * that talks to the bucket directly (docs/ARCHITECTURE.md §8). Backed by
 * MinIO locally, any S3-compatible provider in production, purely via
 * `packages/config`'s `S3_*` env vars.
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(@Inject(API_ENV) env: ApiEnv) {
    this.bucket = env.S3_BUCKET;
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
    // The bucket is bootstrapped public-download (docker-compose.yml's
    // `minio-init`), so a plain path-style URL is a valid, permanent GET —
    // no signed GET URLs needed (docs/ARCHITECTURE.md §8 point 5).
    this.publicBaseUrl = `${env.S3_ENDPOINT.replace(/\/+$/, '')}/${this.bucket}`;
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds = PRESIGNED_UPLOAD_TTL_SECONDS,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  /** Confirms a client's direct upload actually landed before queuing processing. */
  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch (error) {
      if (this.isNotFound(error)) return false;
      throw error;
    }
  }

  /** Reads the original upload's bytes so the processor can generate variants. */
  async getObjectBuffer(key: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await result.Body?.transformToByteArray();
    return Buffer.from(bytes ?? []);
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  /**
   * Resolves a stored object key to a public URL (docs/ARCHITECTURE.md §8
   * point 5) — the API only ever persists keys, never full URLs, so storage
   * configuration can change without a data migration.
   */
  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  private isNotFound(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const { name, $metadata } = error as {
      name?: string;
      $metadata?: { httpStatusCode?: number };
    };
    return name === 'NotFound' || $metadata?.httpStatusCode === 404;
  }
}
