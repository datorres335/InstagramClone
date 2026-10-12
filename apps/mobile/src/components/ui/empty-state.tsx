import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { colors } from '@instagram-clone/design-tokens';

interface EmptyStateProps {
  icon: ComponentProps<typeof MaterialIcons>['name'];
  message: string;
}

/** Icon plus one sentence, the same empty state on every list — twin of apps/web's `components/ui/empty-state.tsx`. */
export function EmptyState({ icon, message }: EmptyStateProps) {
  return (
    <View className="items-center gap-3 px-4 py-12">
      <View
        className="h-16 w-16 items-center justify-center rounded-full border-2 border-text"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <MaterialIcons name={icon} size={32} color={colors.text} />
      </View>
      <Text
        variant="bodyLarge"
        style={{ color: colors.textSecondary, textAlign: 'center' }}
      >
        {message}
      </Text>
    </View>
  );
}
