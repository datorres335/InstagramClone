import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { FollowListItem as FollowListItemType } from '@instagram-clone/validation';

import { FollowListItem } from '../../components/follow-list-item';
import { apiClient } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error-message';

/**
 * `GET /search/users?q=` (docs/API.md §11, docs/FEATURES.md #14, Milestone
 * 17) — the first debounced input in this codebase, 300ms, mirroring
 * `apps/web`'s `SearchBox`. `apiClient` is called directly (no Server
 * Action indirection needed on mobile), the same `LikeButton`/
 * `NotificationBadge` pattern.
 */
const DEBOUNCE_MS = 300;

export default function SearchScreen() {
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
      style={styles.container}
      data={results}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <FollowListItem item={item} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title} role="heading">
            Search
          </Text>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by username or name"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {pending && <ActivityIndicator testID="loading-indicator" />}
          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
        </View>
      }
      ListEmptyComponent={
        !pending && trimmed.length >= 2 && !error ? (
          <Text style={styles.empty}>No results found.</Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: { padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  empty: { padding: 16, textAlign: 'center', color: '#6b7280' },
  error: { color: '#dc2626' },
});
