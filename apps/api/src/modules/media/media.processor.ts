import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { generateMediaVariants } from './media-variants';
import type { MediaProcessingJob } from './media.service';

/**
 * Runs in-process within `apps/api` rather than a separate worker app — an
 * explicit, accepted MVP trade-off (docs/ARCHITECTURE.md §5.2/§8, risk #4),
 * registered inside `MediaModule` itself since nothing else needs this queue.
 */
@Processor('media')
export class MediaProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<MediaProcessingJob>): Promise<void> {
    const media = await this.prisma.media.findUniqueOrThrow({
      where: { id: job.data.mediaId },
    });

    try {
      const original = await this.storage.getObjectBuffer(media.storageKey);
      const { thumbnail, feed, width, height, blurhash } =
        await generateMediaVariants(original);

      const thumbnailKey = `media/${media.id}/thumbnail.webp`;
      const feedKey = `media/${media.id}/feed.webp`;
      await Promise.all([
        this.storage.putObject(thumbnailKey, thumbnail, 'image/webp'),
        this.storage.putObject(feedKey, feed, 'image/webp'),
      ]);

      await this.prisma.media.update({
        where: { id: media.id },
        data: {
          status: 'READY',
          variants: { thumbnail: thumbnailKey, feed: feedKey },
          width,
          height,
          blurhash,
        },
      });
    } catch (error) {
      await this.prisma.media.update({
        where: { id: media.id },
        data: {
          status: 'FAILED',
          failureReason:
            error instanceof Error
              ? error.message
              : 'Unknown processing error.',
        },
      });
      throw error;
    }
  }
}
