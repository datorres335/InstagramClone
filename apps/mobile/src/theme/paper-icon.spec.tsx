import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { render } from '@testing-library/react-native';

import { PaperIcon } from './paper-icon';

describe('PaperIcon', () => {
  it('draws Material Icons names from the Material Icons set', () => {
    const { UNSAFE_getByType, UNSAFE_queryByType } = render(
      <PaperIcon name="favorite-border" size={24} color="#000000" />,
    );
    expect(UNSAFE_getByType(MaterialIcons).props.name).toBe('favorite-border');
    expect(UNSAFE_queryByType(MaterialCommunityIcons)).toBeNull();
  });

  it('falls back to Material Community Icons for names only that set has', () => {
    const { UNSAFE_getByType } = render(
      <PaperIcon name="checkbox-marked" size={24} />,
    );
    expect(UNSAFE_getByType(MaterialCommunityIcons).props.name).toBe(
      'checkbox-marked',
    );
  });

  it('renders nothing for an unknown name', () => {
    const { toJSON } = render(<PaperIcon name="no-such-icon-xyz" size={24} />);
    expect(toJSON()).toBeNull();
  });
});
