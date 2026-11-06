import { useQueries, useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PokemonSprite } from '@/components/pokemon-sprite';
import { ScreenState } from '@/components/screen-state';
import { ThemedText } from '@/components/themed-text';
import { usePlayer } from '@/providers/player-provider';
import { fetchPokemon } from '@/services/pokeapi';
import { AREA_PROGRESSION_CONFIG, AREAS } from '@/services/area-progression';

export default function GameOverScreen() {
  const queryClient = useQueryClient();
  const { state, retry, startNewRun, debugWipeSaveData } = usePlayer();
  const summary = state.status === 'ready' ? state.profile.runSummary : null;
  const pokemonQueries = useQueries({
    queries: (summary?.party ?? []).map((member) => ({
      queryKey: ['pokemon', member.pokemonId],
      queryFn: () => fetchPokemon(member.pokemonId),
    })),
  });
  const [busy, setBusy] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status === 'loading') {
    return (
      <ScreenState
        title="Loading your run"
        message="Restoring the completed run summary."
        loading
      />
    );
  }
  if (state.status === 'error') {
    return (
      <ScreenState
        title="Save unavailable"
        message={state.message}
        onRetry={retry}
        onWipeSave={debugWipeSaveData}
      />
    );
  }
  if (state.profile.runStatus !== 'gameOver') {
    return (
      <Redirect
        href={state.profile.starterSelected ? '/' : '/starter-selection'}
      />
    );
  }
  if (!summary) {
    return (
      <ScreenState
        title="Run summary unavailable"
        message="The completed run has no saved summary. Retry or use the debug wipe to start over."
        onRetry={retry}
        onWipeSave={debugWipeSaveData}
      />
    );
  }

  const area = AREAS.find((candidate) => candidate.id === summary.areaId);
  if (!area) {
    return (
      <ScreenState
        title="Run summary unavailable"
        message="The saved area is not recognized. Retry or use the debug wipe to start over."
        onRetry={retry}
        onWipeSave={debugWipeSaveData}
      />
    );
  }
  const pokemonError = pokemonQueries.find((query) => query.error)?.error;
  const loadingTeam = pokemonQueries.some((query) => query.isPending);

  const clearedEncounters =
    (summary.areaNumber - 1) * AREA_PROGRESSION_CONFIG.encountersPerArea +
    summary.encounterIndex;
  const encounterNumber = summary.encounterIndex + 1;

  async function beginNewRun() {
    setBusy(true);
    setError(null);
    try {
      queryClient.removeQueries({ queryKey: ['starter-options'] });
      await startNewRun();
      router.replace('/starter-selection');
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : 'A new run could not be started.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function wipeRun() {
    setBusy(true);
    setError(null);
    try {
      queryClient.removeQueries({ queryKey: ['starter-options'] });
      await debugWipeSaveData();
      router.replace('/starter-selection');
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : 'The saved run could not be wiped.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ThemedText style={styles.eyebrow}>RUN COMPLETE</ThemedText>
          <ThemedText style={styles.title}>Game over</ThemedText>
          <ThemedText style={styles.subtitle}>
            Your whole team is unable to battle. Your run summary will stay here until you start a new run.
          </ThemedText>
        </View>

        <View style={styles.progressCard}>
          <ThemedText style={styles.sectionTitle}>HOW FAR YOU GOT</ThemedText>
          <ThemedText style={styles.areaText}>
            Area {summary.areaNumber} · {area.name}
          </ThemedText>
          <ThemedText style={styles.detailText}>
            Encounter {encounterNumber} of {AREA_PROGRESSION_CONFIG.encountersPerArea}
            {summary.opponentIsAreaBoss ? ' · Area boss' : ''}
          </ThemedText>
          <ThemedText style={styles.detailText}>
            {clearedEncounters} encounter{clearedEncounters === 1 ? '' : 's'} cleared · Opponents reached level {summary.opponentLevel}
          </ThemedText>
        </View>

        <View style={styles.teamCard}>
          <ThemedText style={styles.sectionTitle}>TEAM USED THIS RUN</ThemedText>
          {loadingTeam ? (
            <View style={styles.teamStatus}>
              <ActivityIndicator size="small" color="#e65d43" />
              <ThemedText style={styles.detailText}>
                Loading Pokémon names and artwork…
              </ThemedText>
            </View>
          ) : null}
          {pokemonError ? (
            <View style={styles.teamStatus}>
              <ThemedText style={styles.error}>
                {pokemonError instanceof Error
                  ? pokemonError.message
                  : 'PokéAPI could not provide the run team.'}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void Promise.all(pokemonQueries.map((query) => query.refetch()));
                }}
                style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Retry team data</Text>
              </Pressable>
            </View>
          ) : null}
          {summary.party.map((member, index) => {
            const pokemon = pokemonQueries[index]?.data;
            return (
              <View key={member.slot} style={styles.memberRow}>
                <View style={styles.sprite}>
                  {pokemon ? <PokemonSprite pokemon={pokemon} size={44} /> : null}
                </View>
                <View style={styles.memberDetails}>
                  <ThemedText style={styles.memberName}>
                    {pokemon?.name ?? `Pokémon #${member.pokemonId}`}
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    Lv. {member.level} · {member.currentHp}/{member.maxHp} HP
                  </ThemedText>
                </View>
                {member.currentHp <= 0 ? (
                  <Text style={styles.fainted}>FAINTED</Text>
                ) : null}
              </View>
            );
          })}
          {summary.party.length === 0 ? (
            <ThemedText style={styles.detailText}>No Pokémon were in the party.</ThemedText>
          ) : null}
        </View>

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void beginNewRun()}
          style={({ pressed }) => [
            styles.primaryButton,
            busy && styles.disabled,
            pressed && !busy && styles.pressed,
          ]}>
          <Text style={styles.primaryButtonText}>
            {busy ? 'Starting…' : 'START A NEW RUN'}
          </Text>
        </Pressable>

        <View style={styles.debugCard}>
          <ThemedText style={styles.sectionTitle}>DEBUG TOOLS</ThemedText>
          {confirmWipe ? (
            <>
              <ThemedText style={styles.detailText}>
                This erases the saved run, party, progress, and inventory.
              </ThemedText>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void wipeRun()}
                  style={[styles.debugButton, busy && styles.disabled]}>
                  <Text style={styles.debugButtonText}>
                    {busy ? 'Wiping…' : 'Confirm wipe'}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => setConfirmWipe(false)}
                  style={[styles.cancelButton, busy && styles.disabled]}>
                  <Text style={styles.debugButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => setConfirmWipe(true)}
              style={[styles.debugButton, busy && styles.disabled]}>
              <Text style={styles.debugButtonText}>Wipe save data</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f1e7',
  },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 14,
  },
  header: {
    gap: 6,
  },
  eyebrow: {
    color: '#b86d51',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
  },
  subtitle: {
    color: '#77736b',
    fontSize: 14,
    lineHeight: 20,
  },
  progressCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    gap: 5,
  },
  sectionTitle: {
    color: '#39424a',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  areaText: {
    color: '#8a513d',
    fontSize: 19,
    fontWeight: '900',
  },
  detailText: {
    color: '#77736b',
    fontSize: 12,
    lineHeight: 18,
  },
  teamCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    gap: 10,
  },
  teamStatus: {
    alignItems: 'center',
    gap: 7,
  },
  memberRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 14,
    backgroundColor: '#f8f6f0',
  },
  sprite: {
    width: 52,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberDetails: {
    flex: 1,
    gap: 3,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  fainted: {
    color: '#a43b32',
    fontSize: 9,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: '#e65d43',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  debugCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5c7a6',
    backgroundColor: '#fff8ed',
    gap: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  debugButton: {
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#a43b32',
    paddingHorizontal: 12,
  },
  cancelButton: {
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#6f655e',
    paddingHorizontal: 12,
  },
  debugButtonText: {
    color: '#fffaf0',
    fontSize: 11,
    fontWeight: '900',
  },
  error: {
    color: '#a43b32',
    fontSize: 12,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#6f655e',
    paddingHorizontal: 12,
  },
  retryButtonText: {
    color: '#fffaf0',
    fontSize: 11,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.8,
  },
});
