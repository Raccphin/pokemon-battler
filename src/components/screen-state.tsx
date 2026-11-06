import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

interface ScreenStateProps {
  title: string;
  message: string;
  loading?: boolean;
  onRetry?: () => void;
  onWipeSave?: () => Promise<void>;
}

export function ScreenState({
  title,
  message,
  loading = false,
  onRetry,
  onWipeSave,
}: ScreenStateProps) {
  const theme = useTheme();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);

  async function wipeSave() {
    if (!onWipeSave || wiping) return;
    setWiping(true);
    setWipeError(null);
    try {
      await onWipeSave();
      setConfirmWipe(false);
    } catch (error) {
      setWipeError(
        error instanceof Error ? error.message : 'The saved data could not be wiped.',
      );
    } finally {
      setWiping(false);
    }
  }

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
      {onWipeSave ? (
        confirmWipe ? (
          <View style={styles.confirmation}>
            {wipeError ? (
              <ThemedText style={styles.wipeError}>{wipeError}</ThemedText>
            ) : null}
            <ThemedText themeColor="textSecondary" style={styles.confirmationText}>
              This permanently erases your saved party and run progress.
            </ThemedText>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={wiping}
                onPress={() => void wipeSave()}
                style={({ pressed }) => [
                  styles.wipe,
                  wiping && styles.disabled,
                  pressed && !wiping && styles.pressed,
                ]}>
                <ThemedText style={styles.actionText}>
                  {wiping ? 'Wiping…' : 'Confirm wipe'}
                </ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={wiping}
                onPress={() => setConfirmWipe(false)}
                style={({ pressed }) => [
                  styles.cancel,
                  wiping && styles.disabled,
                  pressed && !wiping && styles.pressed,
                ]}>
                <ThemedText style={styles.actionText}>Cancel</ThemedText>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setConfirmWipe(true)}
            style={({ pressed }) => [styles.wipe, pressed && styles.pressed]}>
            <ThemedText style={styles.actionText}>Wipe invalid save</ThemedText>
          </Pressable>
        )
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
  confirmation: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  confirmationText: {
    textAlign: 'center',
  },
  wipeError: {
    color: '#b42318',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  wipe: {
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: '#a43b32',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  cancel: {
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: '#6f655e',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  actionText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.8,
  },
});
