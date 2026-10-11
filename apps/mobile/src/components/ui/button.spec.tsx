import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { layout, radii } from '@instagram-clone/design-tokens';

import { Button } from './button';

describe('Button', () => {
  it('renders an accessible button that fires onPress', () => {
    const onPress = jest.fn();
    render(
      <Button mode="contained" onPress={onPress}>
        Log in
      </Button>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('uses the token corner radius and touch-target height, not MD3 pills', () => {
    const { toJSON } = render(<Button mode="contained">Log in</Button>);

    const styles: Record<string, unknown>[] = [];
    const collect = (node: ReturnType<typeof toJSON>) => {
      if (!node || Array.isArray(node)) return;
      styles.push(StyleSheet.flatten(node.props.style) ?? {});
      node.children?.forEach((child) => {
        if (typeof child !== 'string') collect(child);
      });
    };
    collect(toJSON());

    expect(styles.some((style) => style.borderRadius === radii.md)).toBe(true);
    expect(styles.some((style) => style.borderRadius === radii.md * 5)).toBe(
      false,
    );
    expect(
      styles.some((style) => style.minHeight === layout.minTouchTarget),
    ).toBe(true);
  });
});
