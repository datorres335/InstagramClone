import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { authErrorMessage } from '../../lib/auth-error-message';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';

export default function EditProfileScreen() {
  const { user, loading, setUser } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(user?.websiteUrl ?? '');
  const [isPrivate, setIsPrivate] = useState(user?.isPrivate ?? false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && !user) {
    return <Redirect href="/(auth)/login" />;
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const updated = await apiClient.users.updateProfile({
        fullName: fullName.trim() || null,
        bio: bio.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        isPrivate,
      });
      setUser(updated);
      router.replace(`/profile/${updated.username}`);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title} role="heading">
        Edit profile
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Name"
        accessibilityLabel="Name"
        value={fullName}
        onChangeText={setFullName}
      />
      <TextInput
        style={styles.input}
        placeholder="Bio"
        accessibilityLabel="Bio"
        multiline
        value={bio}
        onChangeText={setBio}
      />
      <TextInput
        style={styles.input}
        placeholder="Website"
        accessibilityLabel="Website"
        autoCapitalize="none"
        keyboardType="url"
        value={websiteUrl}
        onChangeText={setWebsiteUrl}
      />
      <View style={styles.switchRow}>
        <Text>Private account</Text>
        <Switch
          accessibilityLabel="Private account"
          value={isPrivate}
          onValueChange={setIsPrivate}
        />
      </View>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Pressable
        style={styles.button}
        onPress={handleSubmit}
        disabled={submitting}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{submitting ? 'Saving…' : 'Save'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  error: { color: '#dc2626' },
  button: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#ffffff', fontWeight: '600' },
});
