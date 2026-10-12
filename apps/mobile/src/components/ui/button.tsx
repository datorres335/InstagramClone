import type { ComponentProps } from 'react';
import { Button as PaperButton } from 'react-native-paper';

import { colors, layout, radii } from '@instagram-clone/design-tokens';

// MD3 Paper draws button corners at 5 × theme.roundness (a pill); scale it
// back so buttons get the same radius as apps/web's MUI buttons.
const buttonTheme = { roundness: radii.md / 5 };

const contentStyle = { minHeight: layout.minTouchTarget };

/**
 * Paper's Button with the design-token corner radius and touch-target
 * height. Outlined buttons use the text color and the control outline, like
 * apps/web's `variant="outlined" color="inherit"` buttons.
 */
export function Button(props: ComponentProps<typeof PaperButton>) {
  const outlined = props.mode === 'outlined';
  return (
    <PaperButton
      theme={buttonTheme}
      contentStyle={contentStyle}
      textColor={outlined ? colors.text : undefined}
      {...props}
      style={[outlined ? { borderColor: colors.outline } : null, props.style]}
    />
  );
}
