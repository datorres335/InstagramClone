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

/**
 * Account settings (docs/API.md §13, docs/FEATURES.md #17, Milestone 19) —
 * one screen, three independent sections, mirroring `apps/web`'s single
 * `/settings` page rather than three separate routes (each section is too
 * small on its own to justify its own screen).
 */
export default function SettingsScreen() {
  const { user, loading, setUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  const [deleteCurrentPassword, setDeleteCurrentPassword] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  if (!loading && !user) {
    return <Redirect href="/(auth)/login" />;
  }

  async function handleChangePassword() {
    setPasswordError(null);
    setPasswordSuccess(false);
    setPasswordSubmitting(true);
    try {
      await apiClient.users.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordSuccess(true);
    } catch (caught) {
      setPasswordError(authErrorMessage(caught));
    } finally {
      setPasswordSubmitting(false);
    }
  }

  async function handleChangeEmail() {
    setEmailError(null);
    setEmailSuccess(false);
    setEmailSubmitting(true);
    try {
      const updated = await apiClient.users.changeEmail({
        newEmail,
        currentPassword: emailCurrentPassword,
      });
      setUser(updated);
      setEmailCurrentPassword('');
      setEmailSuccess(true);
    } catch (caught) {
      setEmailError(authErrorMessage(caught));
    } finally {
      setEmailSubmitting(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteError(null);
    setDeleteSubmitting(true);
    try {
      await apiClient.users.deleteAccount({
        currentPassword: deleteCurrentPassword,
      });
      setUser(null);
      router.replace('/(auth)/login');
    } catch (caught) {
      setDeleteError(authErrorMessage(caught));
      setDeleteSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title} role="heading">
        Settings
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change password</Text>
        <TextInput
          style={styles.input}
          placeholder="Current password"
          accessibilityLabel="Current password"
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="New password"
          accessibilityLabel="New password"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        {passwordError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {passwordError}
          </Text>
        )}
        {passwordSuccess && <Text>Password changed.</Text>}
        <Pressable
          style={styles.button}
          onPress={handleChangePassword}
          disabled={passwordSubmitting}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>
            {passwordSubmitting ? 'Saving…' : 'Change password'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change email</Text>
        <Text>Current email: {user?.email}</Text>
        <TextInput
          style={styles.input}
          placeholder="New email"
          accessibilityLabel="New email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={newEmail}
          onChangeText={setNewEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Current password"
          accessibilityLabel="Current password for email change"
          secureTextEntry
          value={emailCurrentPassword}
          onChangeText={setEmailCurrentPassword}
        />
        {emailError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {emailError}
          </Text>
        )}
        {emailSuccess && <Text>Email changed.</Text>}
        <Pressable
          style={styles.button}
          onPress={handleChangeEmail}
          disabled={emailSubmitting}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>
            {emailSubmitting ? 'Saving…' : 'Change email'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delete account</Text>
        <Text>
          This permanently deletes your account. This cannot be undone from the
          app.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Current password"
          accessibilityLabel="Current password for account deletion"
          secureTextEntry
          value={deleteCurrentPassword}
          onChangeText={setDeleteCurrentPassword}
        />
        <View style={styles.switchRow}>
          <Text>I understand this is permanent and cannot be undone.</Text>
          <Switch
            accessibilityLabel="Confirm permanent account deletion"
            value={deleteConfirmed}
            onValueChange={setDeleteConfirmed}
          />
        </View>
        {deleteError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {deleteError}
          </Text>
        )}
        <Pressable
          style={[styles.button, styles.dangerButton]}
          onPress={handleDeleteAccount}
          disabled={deleteSubmitting || !deleteConfirmed}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>
            {deleteSubmitting ? 'Deleting…' : 'Delete account'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 24,
    backgroundColor: '#ffffff',
  },
  title: { fontSize: 24, fontWeight: '600' },
  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
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
    gap: 12,
  },
  error: { color: '#dc2626' },
  button: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  dangerButton: { backgroundColor: '#dc2626' },
  buttonText: { color: '#ffffff', fontWeight: '600' },
});
