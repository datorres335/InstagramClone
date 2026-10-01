'use server';

import type { NotificationListResponse } from '@instagram-clone/validation';

import { getApiClient } from '../../../lib/get-api-client';

/**
 * The "load more" Server Action behind `NotificationsList` (Milestone 16) —
 * mirrors `home/actions.ts`'s `getFeedPageAction`/`saved/actions.ts`'s
 * `getSavedPageAction`; only a Server Action can read the httpOnly session
 * cookie via `getApiClient()`.
 */
export async function getNotificationsPageAction(
  cursor: string | undefined,
): Promise<NotificationListResponse> {
  return getApiClient().notifications.list({ cursor });
}
