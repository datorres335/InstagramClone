import { formatTimeAgo } from './time-ago';

const now = new Date('2026-10-12T12:00:00.000Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatTimeAgo', () => {
  it.each([
    [0, 'Just now'],
    [59_000, 'Just now'],
    [MINUTE, '1m'],
    [59 * MINUTE, '59m'],
    [HOUR, '1h'],
    [23 * HOUR, '23h'],
    [DAY, '1d'],
    [6 * DAY, '6d'],
    [7 * DAY, '1w'],
    [34 * DAY, '4w'],
  ])('formats %ims ago as %s', (elapsed, expected) => {
    expect(formatTimeAgo(ago(elapsed), now)).toBe(expected);
  });

  it('shows a short date after five weeks, without the year in the same year', () => {
    expect(formatTimeAgo('2026-03-05T08:00:00.000Z', now)).toBe('Mar 5');
  });

  it('includes the year for an earlier year', () => {
    expect(formatTimeAgo('2025-12-31T23:00:00.000Z', now)).toBe('Dec 31, 2025');
  });

  it('treats a timestamp slightly in the future (clock skew) as just now', () => {
    expect(formatTimeAgo('2026-10-12T12:00:00.400Z', now)).toBe('Just now');
  });
});
