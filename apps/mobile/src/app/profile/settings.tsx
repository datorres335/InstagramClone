import { Redirect, router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import {
  Dialog,
  HelperText,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';

import { colors, radii, typography } from '@instagram-clone/design-tokens';

import { Button } from '../../components/ui/button';
import { authErrorMessage } from '../../lib/auth-error-message';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import { interFamily } from '../../theme/fonts';
import { KeyboardAvoidingView } from '../../components/ui/keyboard-avoiding-view';

/** One bordered card, the same sections as apps/web's `SettingsSection`. */
function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-3 rounded-lg border border-border p-4">
      <Text variant="labelLarge" role="heading">
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * Account settings (docs/API.md §13, docs/FEATURES.md #17, Milestone 19) —
 * one screen, three independent sections, mirroring `apps/web`'s single
 * `/settings` page rather than three separate routes (each section is too
 * small on its own to justify its own screen). Deleting the account is
 * confirmed in a dialog that asks for the password (Milestone 25, like web's
 * MUI `Dialog`); Log out sits at the bottom. The title is the stack header's.
 */
export default function SettingsScreen() {
  const { user, loading, setUser, logout } = useAuth();

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

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteCurrentPassword, setDeleteCurrentPassword] = useState('');
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
      setNewEmail('');
      setEmailCurrentPassword('');
      setEmailSuccess(true);
    } catch (caught) {
      setEmailError(authErrorMessage(caught));
    } finally {
      setEmailSubmitting(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  function closeDeleteDialog() {
    if (deleteSubmitting) return;
    setDeleteOpen(false);
    setDeleteCurrentPassword('');
    setDeleteError(null);
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
    <KeyboardAvoidingView className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="grow gap-4 p-4"
        keyboardShouldPersistTaps="handled"
      >
        <SettingsSection title="Change password">
          <TextInput
            mode="outlined"
            label="Current password"
            accessibilityLabel="Current password"
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
          <View>
            <TextInput
              mode="outlined"
              label="New password"
              accessibilityLabel="New password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              maxLength={128}
            />
            <HelperText type="info">At least 8 characters.</HelperText>
          </View>
          {passwordError && (
            <HelperText type="error" accessibilityRole="alert">
              {passwordError}
            </HelperText>
          )}
          {passwordSuccess && (
            <Text variant="bodyMedium" style={{ color: colors.success }}>
              Password changed.
            </Text>
          )}
          <Button
            mode="contained"
            onPress={handleChangePassword}
            disabled={passwordSubmitting}
            style={{ alignSelf: 'flex-start' }}
          >
            {passwordSubmitting ? 'Saving…' : 'Change password'}
          </Button>
        </SettingsSection>

        <SettingsSection title="Change email">
          <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
            Current email: <Text variant="bodyMedium">{user?.email}</Text>
          </Text>
          <TextInput
            mode="outlined"
            label="New email"
            accessibilityLabel="New email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={newEmail}
            onChangeText={setNewEmail}
          />
          <TextInput
            mode="outlined"
            label="Current password"
            accessibilityLabel="Current password for email change"
            secureTextEntry
            value={emailCurrentPassword}
            onChangeText={setEmailCurrentPassword}
          />
          {emailError && (
            <HelperText type="error" accessibilityRole="alert">
              {emailError}
            </HelperText>
          )}
          {emailSuccess && (
            <Text variant="bodyMedium" style={{ color: colors.success }}>
              Email changed.
            </Text>
          )}
          <Button
            mode="contained"
            onPress={handleChangeEmail}
            disabled={emailSubmitting}
            style={{ alignSelf: 'flex-start' }}
          >
            {emailSubmitting ? 'Saving…' : 'Change email'}
          </Button>
        </SettingsSection>

        <SettingsSection title="Delete account">
          <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
            This permanently deletes your account. This cannot be undone from
            the app.
          </Text>
          <Button
            mode="outlined"
            textColor={colors.error}
            onPress={() => setDeleteOpen(true)}
            style={{ alignSelf: 'flex-start', borderColor: colors.error }}
          >
            Delete account
          </Button>
        </SettingsSection>

        {/* Moved here from the home screen's header in Milestone 24. */}
        <Button mode="outlined" onPress={handleLogout}>
          Log out
        </Button>
      </ScrollView>

      <Portal>
        <Dialog
          visible={deleteOpen}
          onDismiss={closeDeleteDialog}
          // MD3's dialog corners and headline are much larger than web's
          // MUI dialog; match it.
          style={{ backgroundColor: colors.background, borderRadius: radii.lg }}
        >
          <Dialog.Title
            style={{
              fontFamily: interFamily.semibold,
              fontSize: typography.title.fontSize,
              lineHeight: typography.title.lineHeight,
            }}
          >
            Delete your account?
          </Dialog.Title>
          <Dialog.Content style={{ gap: 12 }}>
            <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
              This permanently deletes your account. This cannot be undone from
              the app. Enter your password to confirm.
            </Text>
            <TextInput
              mode="outlined"
              label="Current password"
              accessibilityLabel="Current password for account deletion"
              secureTextEntry
              value={deleteCurrentPassword}
              onChangeText={setDeleteCurrentPassword}
            />
            {deleteError && (
              <HelperText type="error" accessibilityRole="alert">
                {deleteError}
              </HelperText>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              mode="text"
              onPress={closeDeleteDialog}
              disabled={deleteSubmitting}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              buttonColor={colors.error}
              onPress={handleDeleteAccount}
              disabled={deleteSubmitting || !deleteCurrentPassword}
            >
              {deleteSubmitting ? 'Deleting…' : 'Delete'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </KeyboardAvoidingView>
  );
}
