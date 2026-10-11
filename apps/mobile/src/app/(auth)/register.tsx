import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';

import { AuthCard } from '../../components/auth-card';
import { Button } from '../../components/ui/button';
import { authErrorMessage } from '../../lib/auth-error-message';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';

export default function RegisterScreen() {
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const user = await apiClient.auth.register({ email, username, password });
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
      title="Create account"
      footerText="Already have an account?"
      footerLinkText="Log in"
      footerHref="/(auth)/login"
    >
      <View className="gap-4">
        <TextInput
          mode="outlined"
          label="Email"
          accessibilityLabel="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          mode="outlined"
          label="Username"
          accessibilityLabel="Username"
          autoCapitalize="none"
          autoComplete="username"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          mode="outlined"
          label="Password"
          accessibilityLabel="Password"
          secureTextEntry
          autoComplete="new-password"
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
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </View>
    </AuthCard>
  );
}
