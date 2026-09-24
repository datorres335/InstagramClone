import * as React from 'react';
import { render } from '@testing-library/react-native';

import IndexScreen from '../app/index';

test('renders the placeholder heading', () => {
  const { getByTestId } = render(<IndexScreen />);
  expect(getByTestId('heading')).toHaveTextContent('Instagram Clone');
});
