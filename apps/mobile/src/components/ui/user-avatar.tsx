import { Avatar } from 'react-native-paper';

import { avatarSize, colors } from '@instagram-clone/design-tokens';

import { interFamily } from '../../theme/fonts';

interface UserAvatarProps {
  username: string;
  avatarUrl: string | null;
  size: keyof typeof avatarSize;
  /** Accessible name for the image; omit when the username is shown right next to it. */
  accessibilityLabel?: string;
}

/**
 * The one avatar used everywhere on mobile — twin of apps/web's
 * `components/ui/user-avatar.tsx`. With no photo it shows the username's
 * first letter on the surface color.
 */
export function UserAvatar({
  username,
  avatarUrl,
  size,
  accessibilityLabel,
}: UserAvatarProps) {
  const diameter = avatarSize[size];
  const a11y = accessibilityLabel
    ? {
        accessible: true,
        accessibilityLabel,
        accessibilityRole: 'image' as const,
      }
    : { accessible: false, importantForAccessibility: 'no' as const };

  if (avatarUrl) {
    return (
      <Avatar.Image
        size={diameter}
        source={{ uri: avatarUrl }}
        style={{ backgroundColor: colors.surfaceVariant }}
        {...a11y}
      />
    );
  }
  return (
    <Avatar.Text
      size={diameter}
      label={username.charAt(0).toUpperCase()}
      color={colors.textSecondary}
      style={{ backgroundColor: colors.surfaceVariant }}
      labelStyle={{ fontFamily: interFamily.semibold }}
      {...a11y}
    />
  );
}
