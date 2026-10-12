import { HeaderHeightContext } from 'expo-router/react-navigation';
import { useContext, useEffect, useState, type ComponentProps } from 'react';
import {
  Keyboard,
  Platform,
  KeyboardAvoidingView as RNKeyboardAvoidingView,
} from 'react-native';

/**
 * Keeps the focused field above the keyboard on both platforms. With Expo
 * SDK 56's edge-to-edge layout Android no longer resizes the window for the
 * keyboard, so React Native's `KeyboardAvoidingView` has to pad there too —
 * but on Android its `keyboardDidHide` handling can leave some padding behind
 * (the hide event's coordinates still overlap the view), so it's only enabled
 * while the keyboard is up. The offset is the stack header's height, since
 * the view's own frame is measured below it (0 on headerless screens and in
 * tests, where there's no navigator).
 */
export function KeyboardAvoidingView(
  props: Omit<
    ComponentProps<typeof RNKeyboardAvoidingView>,
    'behavior' | 'keyboardVerticalOffset' | 'enabled'
  >,
) {
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());

  useEffect(() => {
    const subscriptions = [
      Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true)),
      Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false)),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  return (
    <RNKeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
      enabled={Platform.OS === 'ios' || keyboardVisible}
      {...props}
    />
  );
}
