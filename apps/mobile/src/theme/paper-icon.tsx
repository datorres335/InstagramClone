import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type MaterialIconName = keyof typeof MaterialIcons.glyphMap;
type CommunityIconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface PaperIconProps {
  name: string;
  color?: string;
  size: number;
}

function isMaterialIconName(name: string): name is MaterialIconName {
  return name in MaterialIcons.glyphMap;
}

function isCommunityIconName(name: string): name is CommunityIconName {
  return name in MaterialCommunityIcons.glyphMap;
}

/**
 * Paper's icon provider. Google's Material Icons first — the same set
 * apps/web's @mui/icons-material draws from — falling back to Material
 * Community Icons, the names Paper's own internals (checkbox, chip close,
 * ...) ask for.
 */
export function PaperIcon({ name, color, size }: PaperIconProps) {
  const props: Omit<ComponentProps<typeof MaterialIcons>, 'name'> = {
    color,
    size,
  };
  if (isMaterialIconName(name)) return <MaterialIcons name={name} {...props} />;
  if (isCommunityIconName(name)) {
    return <MaterialCommunityIcons name={name} {...props} />;
  }
  return null;
}
