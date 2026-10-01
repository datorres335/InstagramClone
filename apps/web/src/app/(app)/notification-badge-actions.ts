'use server';

import { getApiClient } from '../../lib/get-api-client';

export async function getUnreadNotificationCountAction(): Promise<number> {
  const result = await getApiClient().notifications.getUnreadCount();
  return result.count;
}
