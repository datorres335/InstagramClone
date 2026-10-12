import { render, type RenderResult } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { PaperProvider } from 'react-native-paper';

import { PaperIcon } from '../theme/paper-icon';
import { paperTheme } from '../theme/paper-theme';

const paperSettings = { icon: PaperIcon };

/**
 * Renders inside the app's real Paper theme and icon provider (what
 * `app/_layout.tsx` sets up), for tests that assert on token-themed output
 * such as which Material icon a toggle shows. Plain `render` is enough
 * everywhere else — Paper falls back to its default theme.
 */
export function renderWithTheme(ui: ReactElement): RenderResult {
  return render(
    <PaperProvider theme={paperTheme} settings={paperSettings}>
      {ui}
    </PaperProvider>,
  );
}
