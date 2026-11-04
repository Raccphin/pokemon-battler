import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

interface ScreenStateProps {
  title: string;
  message: string;
  loading?: boolean;
  onRetry?: () => void;
}

export function ScreenState({ title, message, loading = false, onRetry }: ScreenStateProps) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {loading ? <ActivityIndicator size="large" color="#e65d43" /> : null}
      <ThemedText type="subtitle" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.message}>
        {message}
      </ThemedText>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
          <ThemedText style={styles.retryText}>Try again</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    gap: 14,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
  retry: {
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: '#e65d43',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
});
