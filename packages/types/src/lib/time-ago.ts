const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Instagram-style compact age of a post or comment ("Just now", "5m", "3h",
 * "2d", "4w", then a date). Shared by apps/web and apps/mobile so both show
 * identical text (Milestone 24).
 */
export function formatTimeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const elapsed = Math.max(0, now.getTime() - then.getTime());

  if (elapsed < MINUTE) return 'Just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
  if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)}d`;
  if (elapsed < 5 * WEEK) return `${Math.floor(elapsed / WEEK)}w`;

  const sameYear = then.getUTCFullYear() === now.getUTCFullYear();
  return then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  });
}
