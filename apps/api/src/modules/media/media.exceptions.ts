import { HttpStatus } from '@nestjs/common';

import { HttpProblemException } from '../../common/exceptions/http-problem.exception';

/**
 * Attaching a media id to a post/avatar that isn't `READY` (still
 * `PENDING`/queued, or `FAILED`), or whose `purpose` doesn't match what's
 * being attached (docs/API.md §14).
 */
export class MediaNotReadyException extends HttpProblemException {
  constructor(detail: string) {
    super(
      'media-not-ready',
      'Media Not Ready',
      HttpStatus.UNPROCESSABLE_ENTITY,
      detail,
    );
  }
}
