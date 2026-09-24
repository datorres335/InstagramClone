import { StyleSheet, Text, View } from 'react-native';

// Placeholder root route. Replaced by the real auth/feed screens in the
// milestones that implement those features (see docs/IMPLEMENTATION_PLAN.md).
export default function IndexScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title} testID="heading" role="heading">
        Instagram Clone
      </Text>
      <Text style={styles.subtitle}>
        Mobile app scaffold — infrastructure milestone
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
  },
});
