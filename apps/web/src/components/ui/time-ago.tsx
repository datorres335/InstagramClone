import { formatTimeAgo } from '@instagram-clone/types';

/**
 * A post/comment age ("3h", "2d"). It can render on the server and again on
 * the client a moment later, so a minute boundary crossed in between would
 * differ — `suppressHydrationWarning` keeps that from being reported as a
 * hydration error.
 */
export function TimeAgo({ iso }: { iso: string }) {
  return (
    <time
      dateTime={iso}
      title={new Date(iso).toLocaleString('en-US')}
      suppressHydrationWarning
      className="text-caption whitespace-nowrap text-text-secondary"
    >
      {formatTimeAgo(iso)}
    </time>
  );
}
