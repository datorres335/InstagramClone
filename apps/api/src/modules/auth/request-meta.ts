import type { Request } from 'express';

import type { TokenMeta } from './tokens.service';

/** Best-effort device/session display info stored on `RefreshToken` rows. */
export function extractRequestMeta(req: Request): TokenMeta {
  return {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  };
}
