import { Link, type Href } from 'expo-router';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

interface AuthCardProps {
  title: string;
  children: React.ReactNode;
  footerText: string;
  footerLinkText: string;
  footerHref: Href;
}

/**
 * The login/register card — brand, title, form, and a footer card linking to
 * the other screen. Same layout as apps/web's `(auth)/auth-card.tsx`.
 */
export function AuthCard({
  title,
  children,
  footerText,
  footerLinkText,
  footerHref,
}: AuthCardProps) {
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-1 justify-center gap-3 px-4">
        <View className="gap-6 rounded-lg border border-border bg-background px-6 py-10">
          <Text className="text-center font-inter-semibold text-headline text-text">
            Instagram Clone
          </Text>
          <Text
            role="heading"
            className="text-center font-inter-semibold text-body-large text-text-secondary"
          >
            {title}
          </Text>
          {children}
        </View>
        <View className="flex-row flex-wrap justify-center gap-1 rounded-lg border border-border bg-background px-6 py-5">
          <Text className="font-inter text-body text-text">{footerText}</Text>
          {/* expo-router's Link isn't a NativeWind-styled component; style its Text child. */}
          <Link href={footerHref} asChild>
            <Text
              accessibilityRole="link"
              className="font-inter-semibold text-body text-primary"
            >
              {footerLinkText}
            </Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
