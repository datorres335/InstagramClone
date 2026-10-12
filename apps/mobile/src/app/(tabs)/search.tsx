import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { HelperText, Text, TextInput } from 'react-native-paper';

import { colors } from '@instagram-clone/design-tokens';
import type { FollowListItem as FollowListItemType } from '@instagram-clone/validation';

import { FollowListItem } from '../../components/follow-list-item';
import { EmptyState } from '../../components/ui/empty-state';
import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';
import { useAuth } from '../../lib/auth-context';

/**
 * `GET /search/users?q=` (docs/API.md §11, docs/FEATURES.md #14, Milestone
 * 17) — the first debounced input in this codebase, 300ms, mirroring
 * `apps/web`'s `SearchBox`. `apiClient` is called directly (no Server
 * Action indirection needed on mobile), the same `LikeButton` pattern.
 */
const DEBOUNCE_MS = 300;

export default function SearchScreen() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FollowListItemType[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      setPending(false);
      return;
    }

    setPending(true);
    const timer = setTimeout(async () => {
      try {
        const response = await apiClient.search.searchUsers({ q: trimmed });
        setResults(response.data);
        setError(null);
      } catch (caught) {
        setError(authErrorMessage(caught));
      } finally {
        setPending(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const trimmed = query.trim();

  return (
    <FlatList
      testID="search-results"
      className="flex-1 bg-background"
      contentContainerClassName="px-4"
      keyboardShouldPersistTaps="handled"
      data={results}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <FollowListItem
          item={item}
          isViewer={item.username === user?.username}
        />
      )}
      ListHeaderComponent={
        <View className="gap-3 py-3">
          <Text variant="titleLarge" role="heading">
            Search
          </Text>
          <TextInput
            mode="outlined"
            dense
            value={query}
            onChangeText={setQuery}
            placeholder="Search by username or name"
            accessibilityLabel="Search for people"
            autoCapitalize="none"
            autoCorrect={false}
            left={<TextInput.Icon icon="search" color={colors.textSecondary} />}
          />
          {pending && (
            <ActivityIndicator
              testID="loading-indicator"
              color={colors.textSecondary}
              style={{ padding: 16 }}
            />
          )}
          {error && (
            <HelperText type="error" accessibilityRole="alert">
              {error}
            </HelperText>
          )}
        </View>
      }
      ListEmptyComponent={
        !pending && trimmed.length >= 2 && !error ? (
          <EmptyState icon="search-off" message="No results found." />
        ) : null
      }
    />
  );
}
