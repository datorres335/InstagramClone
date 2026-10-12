import * as ImagePicker from 'expo-image-picker';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  HelperText,
  ProgressBar,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';

import { colors } from '@instagram-clone/design-tokens';

import { Button } from '../../components/ui/button';
import { UserAvatar } from '../../components/ui/user-avatar';
import { authErrorMessage } from '../../lib/auth-error-message';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import { KeyboardAvoidingView } from '../../components/ui/keyboard-avoiding-view';

type AvatarStatus = 'idle' | 'uploading' | 'processing' | 'done';

export default function EditProfileScreen() {
  const { user, loading, setUser } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(user?.websiteUrl ?? '');
  const [isPrivate, setIsPrivate] = useState(user?.isPrivate ?? false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>('idle');
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    // `UserResponseSchema` (session, `useAuth().user`) deliberately never
    // includes `avatarUrl` (docs/API.md §3) — the public profile is the only
    // place it's exposed, so it's fetched separately just to seed the
    // preview.
    if (!user) return;
    let cancelled = false;
    apiClient.users.getProfile(user.username).then((profile) => {
      if (!cancelled) setAvatarUrl(profile.avatarUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!loading && !user) {
    return <Redirect href="/(auth)/login" />;
  }

  async function handlePickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setAvatarError('Photo library access is required to change your photo.');
      return;
    }

    // Square crop performed client-side (docs/FEATURES.md #4) — Expo's
    // native cropper, not a custom widget (`apps/web`'s equivalent instead
    // relies on the server's `sharp` center-crop since there's no
    // comparable free native crop on the web).
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const contentType = (asset.mimeType ?? 'image/jpeg') as
      | 'image/jpeg'
      | 'image/png'
      | 'image/webp';

    setAvatarError(null);
    setAvatarStatus('uploading');
    setAvatarUrl(asset.uri);

    try {
      const fileBlob = await (await fetch(asset.uri)).blob();

      const { mediaId, uploadUrl } = await apiClient.media.presign({
        purpose: 'AVATAR',
        contentType,
        byteSize: fileBlob.size,
      });

      await apiClient.media.uploadToPresignedUrl(
        uploadUrl,
        fileBlob,
        contentType,
      );
      await apiClient.media.complete(mediaId);

      setAvatarStatus('processing');
      const processed = await apiClient.media.waitUntilProcessed(mediaId);
      if (processed.status === 'FAILED') {
        throw new Error(processed.failureReason ?? 'Photo processing failed.');
      }

      const avatarMedia = await apiClient.users.updateAvatar(mediaId);
      setAvatarUrl(avatarMedia.variants?.thumbnail ?? null);
      setAvatarStatus('done');
    } catch (caught) {
      setAvatarError(authErrorMessage(caught));
      setAvatarStatus('idle');
    }
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

  const avatarBusy =
    avatarStatus === 'uploading' || avatarStatus === 'processing';

  return (
    <KeyboardAvoidingView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-4 p-4">
        <View className="flex-row items-center gap-4 rounded-lg bg-surface p-4">
          <UserAvatar
            username={user?.username ?? ''}
            avatarUrl={avatarUrl}
            size="md"
            accessibilityLabel="Your avatar"
          />
          <View className="flex-1 gap-1">
            <Text variant="labelLarge">@{user?.username}</Text>
            {avatarBusy && <ProgressBar indeterminate color={colors.primary} />}
            {avatarStatus === 'done' && (
              <Text variant="bodySmall" style={{ color: colors.success }}>
                Photo updated.
              </Text>
            )}
          </View>
          <Button
            mode="contained"
            compact
            onPress={handlePickAvatar}
            disabled={avatarBusy}
            accessibilityRole="button"
          >
            {avatarStatus === 'uploading'
              ? 'Uploading…'
              : avatarStatus === 'processing'
                ? 'Processing…'
                : 'Change photo'}
          </Button>
        </View>
        {avatarError && (
          <HelperText type="error" accessibilityRole="alert">
            {avatarError}
          </HelperText>
        )}
        <TextInput
          mode="outlined"
          label="Name"
          accessibilityLabel="Name"
          value={fullName}
          onChangeText={setFullName}
          maxLength={150}
        />
        <View>
          <TextInput
            mode="outlined"
            label="Bio"
            accessibilityLabel="Bio"
            multiline
            value={bio}
            onChangeText={setBio}
            maxLength={150}
          />
          <HelperText type="info">Up to 150 characters.</HelperText>
        </View>
        <TextInput
          mode="outlined"
          label="Website"
          accessibilityLabel="Website"
          autoCapitalize="none"
          keyboardType="url"
          placeholder="https://"
          value={websiteUrl}
          onChangeText={setWebsiteUrl}
        />
        <View className="flex-row items-center justify-between">
          <Text variant="bodyLarge">Private account</Text>
          <Switch
            accessibilityLabel="Private account"
            value={isPrivate}
            onValueChange={setIsPrivate}
            color={colors.primary}
          />
        </View>
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
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
