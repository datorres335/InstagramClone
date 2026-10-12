import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  HelperText,
  IconButton,
  ProgressBar,
  Text,
  TextInput,
} from 'react-native-paper';

import { colors, iconSize } from '@instagram-clone/design-tokens';

import { Button } from '../../components/ui/button';
import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';
import { KeyboardAvoidingView } from '../../components/ui/keyboard-avoiding-view';

const MAX_IMAGES = 10;
const TILE_COLUMNS = 3;
const TILE_GAP = 8;
const SCREEN_PADDING = 16;

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
  const { width } = useWindowDimensions();
  const tileSize =
    (width - SCREEN_PADDING * 2 - TILE_GAP * (TILE_COLUMNS - 1)) / TILE_COLUMNS;
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
    <KeyboardAvoidingView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-4 p-4">
        <Pressable
          onPress={handlePickImages}
          disabled={images.length >= MAX_IMAGES}
          accessibilityRole="button"
          className={`items-center gap-2 rounded-lg border-2 border-dashed border-outline px-4 py-8 ${
            images.length >= MAX_IMAGES ? 'opacity-50' : ''
          }`}
        >
          <MaterialIcons
            name="add-photo-alternate"
            size={48}
            color={colors.textSecondary}
          />
          <Text variant="labelLarge" style={{ color: colors.primary }}>
            Add photos
          </Text>
          <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
            JPEG, PNG or WebP, up to {MAX_IMAGES}
          </Text>
        </Pressable>
        {/* A plain wrapped row, not FlatList/VirtualizedList — capped at 10
            images, so virtualization has no benefit and only adds a
            known-finicky dependency (its internal real-timer-based cell
            scheduling doesn't play well with RNTL's `waitFor` in tests). */}
        {images.length > 0 && (
          <View className="flex-row flex-wrap" style={{ gap: TILE_GAP }}>
            {images.map((item, index) => (
              <View
                key={item.uri}
                className="overflow-hidden rounded-md bg-surface-variant"
                style={{ width: tileSize, height: tileSize }}
              >
                <Image
                  source={{ uri: item.uri }}
                  accessibilityLabel={`Selected photo ${index + 1}`}
                  style={{ width: tileSize, height: tileSize }}
                />
                <View className="absolute top-0 right-0">
                  <IconButton
                    icon="close"
                    size={iconSize.sm}
                    mode="contained"
                    containerColor={colors.background}
                    iconColor={colors.text}
                    onPress={() => removeImage(item)}
                    disabled={submitting}
                    accessibilityLabel={`Remove photo ${index + 1}`}
                  />
                </View>
                <View className="absolute inset-x-0 bottom-0 gap-1 bg-background px-2 py-1">
                  {(item.status === 'uploading' ||
                    item.status === 'processing') && (
                    <>
                      <Text variant="bodySmall">
                        {item.status === 'uploading'
                          ? 'Uploading…'
                          : 'Processing…'}
                      </Text>
                      <ProgressBar indeterminate color={colors.primary} />
                    </>
                  )}
                  {item.status === 'ready' && (
                    <Text variant="bodySmall" style={{ color: colors.success }}>
                      Ready
                    </Text>
                  )}
                  {item.status === 'error' && (
                    <Text
                      variant="bodySmall"
                      accessibilityRole="alert"
                      style={{ color: colors.error }}
                    >
                      {item.error}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
        <TextInput
          mode="outlined"
          label="Caption"
          accessibilityLabel="Caption"
          multiline
          maxLength={2200}
          value={caption}
          onChangeText={setCaption}
        />
        <TextInput
          mode="outlined"
          label="Location"
          accessibilityLabel="Location"
          maxLength={255}
          value={location}
          onChangeText={setLocation}
        />
        {error && (
          <HelperText type="error" accessibilityRole="alert">
            {error}
          </HelperText>
        )}
        <Button
          mode="contained"
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
        >
          {submitting ? 'Posting…' : 'Share'}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
