import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';

const MAX_IMAGES = 10;

interface ImageSlot {
  uri: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  status: 'uploading' | 'processing' | 'ready' | 'error';
  mediaId: string | null;
  error: string | null;
}

/**
 * Multi-image presign → direct-upload → poll flow (docs/ARCHITECTURE.md §8),
 * the same pipeline as the avatar uploader (Milestone 9) run once per
 * selected image, sequentially, so upload order matches carousel `position`.
 * No client-side crop — `expo-image-picker`'s crop is mutually exclusive
 * with multi-select, and post images keep their original aspect ratio
 * anyway (the `feed` variant, unlike the avatar `thumbnail` variant).
 */
export default function NewPostScreen() {
  const [images, setImages] = useState<ImageSlot[]>([]);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePickImages() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is required to add photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      orderedSelection: true,
      quality: 0.9,
    });
    if (result.canceled || result.assets.length === 0) return;

    setError(null);
    const newSlots: ImageSlot[] = result.assets.map((asset) => ({
      uri: asset.uri,
      contentType: (asset.mimeType ?? 'image/jpeg') as ImageSlot['contentType'],
      status: 'uploading',
      mediaId: null,
      error: null,
    }));
    setImages((prev) => [...prev, ...newSlots]);

    for (const slot of newSlots) {
      await uploadOne(slot);
    }
  }

  async function uploadOne(slot: ImageSlot) {
    // Keyed on `uri` (stable for this slot's whole lifetime), not object
    // identity — each call below replaces the slot's object in state, so
    // comparing by reference would only ever match the *first* update; every
    // subsequent one would silently no-op against the now-stale closure.
    const uri = slot.uri;
    const updateSlot = (patch: Partial<ImageSlot>) => {
      setImages((prev) =>
        prev.map((s) => (s.uri === uri ? { ...s, ...patch } : s)),
      );
    };

    try {
      const blob = await (await fetch(slot.uri)).blob();
      const { mediaId, uploadUrl } = await apiClient.media.presign({
        purpose: 'POST_IMAGE',
        contentType: slot.contentType,
        byteSize: blob.size,
      });

      await apiClient.media.uploadToPresignedUrl(
        uploadUrl,
        blob,
        slot.contentType,
      );
      await apiClient.media.complete(mediaId);
      updateSlot({ status: 'processing', mediaId });

      const processed = await apiClient.media.waitUntilProcessed(mediaId);
      if (processed.status === 'FAILED') {
        throw new Error(processed.failureReason ?? 'Photo processing failed.');
      }
      updateSlot({ status: 'ready' });
    } catch (caught) {
      updateSlot({ status: 'error', error: authErrorMessage(caught) });
    }
  }

  function removeImage(slot: ImageSlot) {
    setImages((prev) => prev.filter((s) => s !== slot));
  }

  const readyMediaIds = images
    .filter((slot) => slot.status === 'ready' && slot.mediaId)
    .map((slot) => slot.mediaId as string);
  const canSubmit =
    images.length > 0 &&
    images.every((slot) => slot.status === 'ready') &&
    !submitting;

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const post = await apiClient.posts.create({
        caption: caption.trim() || null,
        location: location.trim() || null,
        mediaIds: readyMediaIds,
      });
      router.replace({ pathname: '/post/[id]', params: { id: post.id } });
    } catch (caught) {
      setError(authErrorMessage(caught));
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title} role="heading">
        New post
      </Text>
      <Pressable
        style={styles.button}
        onPress={handlePickImages}
        disabled={images.length >= MAX_IMAGES}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>Add photos</Text>
      </Pressable>
      {/* A plain mapped row, not FlatList/VirtualizedList — capped at 10
          images, so virtualization has no benefit and only adds a
          known-finicky dependency (its internal real-timer-based cell
          scheduling doesn't play well with RNTL's `waitFor` in tests). */}
      <ScrollView horizontal>
        {images.map((item) => (
          <View key={item.uri} style={styles.imageSlot}>
            <Image source={{ uri: item.uri }} style={styles.thumbnail} />
            {item.status === 'uploading' && <Text>Uploading…</Text>}
            {item.status === 'processing' && <Text>Processing…</Text>}
            {item.status === 'ready' && <Text>Ready</Text>}
            {item.status === 'error' && (
              <Text accessibilityRole="alert" style={styles.error}>
                {item.error}
              </Text>
            )}
            <Pressable
              onPress={() => removeImage(item)}
              disabled={submitting}
              accessibilityRole="button"
            >
              <Text>Remove</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <TextInput
        style={styles.input}
        placeholder="Caption"
        accessibilityLabel="Caption"
        multiline
        maxLength={2200}
        value={caption}
        onChangeText={setCaption}
      />
      <TextInput
        style={styles.input}
        placeholder="Location"
        accessibilityLabel="Location"
        maxLength={255}
        value={location}
        onChangeText={setLocation}
      />
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Pressable
        style={styles.button}
        onPress={handleSubmit}
        disabled={!canSubmit}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>
          {submitting ? 'Posting…' : 'Share'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  title: { fontSize: 20, fontWeight: '600' },
  imageSlot: { marginRight: 8, alignItems: 'center' },
  thumbnail: { width: 96, height: 96 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
  },
  button: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#ffffff', fontWeight: '600' },
  error: { color: '#dc2626' },
});
