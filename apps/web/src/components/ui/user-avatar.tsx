import Avatar from '@mui/material/Avatar';

const sizeClassName = {
  sm: 'size-avatar-sm text-label',
  md: 'size-avatar-md text-body-large',
  profile: 'size-avatar-lg text-headline md:size-avatar-xl md:text-display',
} as const;

interface UserAvatarProps {
  username: string;
  avatarUrl: string | null;
  size: keyof typeof sizeClassName;
  /** Accessible name for the image; omit when the username is shown right next to it. */
  alt?: string;
}

/**
 * The one avatar used everywhere on web (docs/ARCHITECTURE.md §5.5 parity
 * map; `apps/mobile`'s `components/ui/user-avatar.tsx` is its twin). With no
 * photo it shows the username's first letter on the surface color rather
 * than an empty `<img>`. Without an `alt` it's decorative and hidden from
 * screen readers, letter included, so a row's link isn't announced as "B,
 * @bob …".
 */
export function UserAvatar({
  username,
  avatarUrl,
  size,
  alt = '',
}: UserAvatarProps) {
  return (
    <Avatar
      src={avatarUrl ?? undefined}
      alt={alt}
      aria-hidden={alt === '' ? true : undefined}
      className={`${sizeClassName[size]} bg-surface-variant font-semibold text-text-secondary`}
    >
      {username.charAt(0).toUpperCase()}
    </Avatar>
  );
}
