import type { ComponentProps } from 'react';
import { Button as PaperButton } from 'react-native-paper';

import { layout, radii } from '@instagram-clone/design-tokens';

// MD3 Paper draws button corners at 5 × theme.roundness (a pill); scale it
// back so buttons get the same radius as apps/web's MUI buttons.
const buttonTheme = { roundness: radii.md / 5 };

const contentStyle = { minHeight: layout.minTouchTarget };

/** Paper's Button with the design-token corner radius and touch-target height. */
export function Button(props: ComponentProps<typeof PaperButton>) {
  return (
    <PaperButton theme={buttonTheme} contentStyle={contentStyle} {...props} />
  );
}
