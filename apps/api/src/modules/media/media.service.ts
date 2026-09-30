import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';

import type { Media, MediaPurpose } from '@instagram-clone/prisma-client';
import type {
  MediaResponse,
  PresignMediaInput,
  PresignMediaResponse,
} from '@instagram-clone/validation';

import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { resolveAvatarUrl, toMediaResponse } from './media-response.mapper';
import { MediaNotReadyException } from './media.exceptions';

/** docs/API.md §6/§14 — enforced here (not via Zod `.max()`) so exceeding it is the documented `413`. */
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

const PRESIGN_TTL_SECONDS = 300;

export interface MediaProcessingJob {
  mediaId: string;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue('media')
    private readonly mediaQueue: Queue<MediaProcessingJob>,
  ) {}

  async presign(
    userId: string,
    input: PresignMediaInput,
  ): Promise<PresignMediaResponse> {
    if (input.byteSize > MAX_MEDIA_BYTES) {
      throw new PayloadTooLargeException(
        `Media exceeds the ${MAX_MEDIA_BYTES}-byte limit.`,
      );
    }

    // The storage key is derived from the row's id, so the row is created
    // first (letting Prisma generate the uuidv7 id, matching every other
    // table's convention — docs/DATABASE.md §1) and the key filled in with a
    // second write, rather than pre-generating an id client-side.
    const created = await this.prisma.media.create({
      data: {
        ownerId: userId,
        purpose: input.purpose,
        byteSize: input.byteSize,
        contentType: input.contentType,
        storageKey: '',
      },
    });
    const storageKey = `media/${created.id}/original`;
    await this.prisma.media.update({
      where: { id: created.id },
      data: { storageKey },
    });

    const uploadUrl = await this.storage.getPresignedUploadUrl(
      storageKey,
      input.contentType,
      PRESIGN_TTL_SECONDS,
    );

    return {
      mediaId: created.id,
      uploadUrl,
      expiresAt: new Date(
        Date.now() + PRESIGN_TTL_SECONDS * 1000,
      ).toISOString(),
    };
  }

  async complete(userId: string, mediaId: string): Promise<MediaResponse> {
    const media = await this.getOwnedMedia(userId, mediaId);

    // Idempotent: a repeated `complete` call for an already-queued/processed
    // media just returns its current state instead of re-enqueuing.
    if (media.status === 'PENDING') {
      const uploaded = await this.storage.objectExists(media.storageKey);
      if (!uploaded) {
        throw new NotFoundException(
          'Uploaded object not found — upload may not have completed yet.',
        );
      }
      await this.mediaQueue.add('process', { mediaId: media.id });
    }

    return toMediaResponse(media, this.storage);
  }

  async getById(userId: string, mediaId: string): Promise<MediaResponse> {
    const media = await this.getOwnedMedia(userId, mediaId);
    return toMediaResponse(media, this.storage);
  }

  async setAsAvatar(userId: string, mediaId: string): Promise<MediaResponse> {
    const media = await this.getReadyMediaForAttachment(
      userId,
      mediaId,
      'AVATAR',
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarMediaId: media.id },
    });

    return toMediaResponse(media, this.storage);
  }

  /**
   * Ownership + purpose + `READY`-status validation shared by every
   * "attach this media to something" flow (`setAsAvatar` above;
   * `PostsService.createPost`, Milestone 11) — `403`/`404` via
   * `getOwnedMedia`, `422 media-not-ready` (docs/API.md §14) for the wrong
   * `purpose` or a non-`READY` status.
   */
  async getReadyMediaForAttachment(
    userId: string,
    mediaId: string,
    purpose: MediaPurpose,
  ): Promise<Media> {
    const media = await this.getOwnedMedia(userId, mediaId);

    if (media.purpose !== purpose) {
      throw new MediaNotReadyException(
        `This media was not uploaded for ${purpose.toLowerCase()} use.`,
      );
    }
    if (media.status !== 'READY') {
      throw new MediaNotReadyException(
        'This media is still processing or failed to process.',
      );
    }

    return media;
  }

  /** Shared by `UsersService.getPublicProfile` to resolve `PublicProfileResponse.avatarUrl`. */
  resolveAvatarUrl(media: Media | null): string | null {
    return resolveAvatarUrl(media, this.storage);
  }

  private async getOwnedMedia(userId: string, mediaId: string): Promise<Media> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });
    if (!media) {
      throw new NotFoundException('Media not found.');
    }
    if (media.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this media.');
    }
    return media;
  }
}
