import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';

import { AuthCard } from '../../components/auth-card';
import { Button } from '../../components/ui/button';
import { authErrorMessage } from '../../lib/auth-error-message';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';

export default function LoginScreen() {
  const { setUser } = useAuth();
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const user = await apiClient.auth.login({ emailOrUsername, password });
      setUser(user);
      router.replace('/(tabs)/home');
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Log in"
      footerText="Don't have an account?"
      footerLinkText="Create one"
      footerHref="/(auth)/register"
    >
      <View className="gap-4">
        <TextInput
          mode="outlined"
          label="Email or username"
          accessibilityLabel="Email or username"
          autoCapitalize="none"
          autoComplete="username"
          value={emailOrUsername}
          onChangeText={setEmailOrUsername}
        />
        <TextInput
          mode="outlined"
          label="Password"
          accessibilityLabel="Password"
          secureTextEntry
          autoComplete="current-password"
          value={password}
          onChangeText={setPassword}
        />
        {error && (
          <HelperText type="error" accessibilityRole="alert">
            {error}
          </HelperText>
        )}
        <Button
          mode="contained"
          onPress={handleSubmit}
          disabled={submitting}
          accessibilityRole="button"
        >
          {submitting ? 'Logging in…' : 'Log in'}
        </Button>
      </View>
    </AuthCard>
  );
}
