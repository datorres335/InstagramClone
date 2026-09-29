import * as ImagePicker from 'expo-image-picker';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Image,
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

  return (
    <View style={styles.container}>
      <Text style={styles.title} role="heading">
        Edit profile
      </Text>
      <View style={styles.avatarRow}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            accessibilityLabel="Your avatar"
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder} />
        )}
        <Pressable
          onPress={handlePickAvatar}
          disabled={
            avatarStatus === 'uploading' || avatarStatus === 'processing'
          }
          accessibilityRole="button"
        >
          <Text>
            {avatarStatus === 'uploading'
              ? 'Uploading…'
              : avatarStatus === 'processing'
                ? 'Processing…'
                : 'Change photo'}
          </Text>
        </Pressable>
      </View>
      {avatarError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {avatarError}
        </Text>
      )}
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
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e5e7eb',
  },
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
