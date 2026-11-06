import { useQuery } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PokemonSprite } from '@/components/pokemon-sprite';
import { ScreenState } from '@/components/screen-state';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { usePlayer } from '@/providers/player-provider';
import { getPlayerMaxHp } from '@/services/battle-rules';
import { fetchStarterOptions, type StarterOption } from '@/services/starter-selection';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function StarterSelectionScreen() {
  const theme = useTheme();
  const { state, selectStarter, retry, debugWipeSaveData } = usePlayer();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const starterQuery = useQuery({
    queryKey: ['starter-options'],
    queryFn: fetchStarterOptions,
    enabled: state.status === 'ready' && !state.profile.starterSelected,
  });

  if (state.status === 'loading') {
    return <ScreenState title="Loading your save" message="Checking your run progress." loading />;
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
  if (state.profile.starterSelected) {
    return <Redirect href="/" />;
  }
  if (starterQuery.isPending) {
    return (
      <ScreenState
        title="Finding your starters"
        message="Loading Pokémon choices from PokéAPI."
        loading
      />
    );
  }
  if (starterQuery.error || !starterQuery.data) {
    return (
      <ScreenState
        title="Starters unavailable"
        message={
          starterQuery.error instanceof Error
            ? starterQuery.error.message
            : 'PokéAPI could not provide starter choices.'
        }
        onRetry={() => {
          void starterQuery.refetch();
        }}
      />
    );
  }

  const selectedPokemon = starterQuery.data.find((pokemon) => pokemon.id === selectedId);

  async function confirmSelection(pokemon: StarterOption) {
    setConfirming(true);
    setConfirmError(null);
    try {
      await selectStarter(pokemon.id, getPlayerMaxHp(pokemon.hp));
      router.replace('/');
    } catch (error) {
      setConfirmError(
        error instanceof Error ? error.message : 'The starter could not be saved. Try again.'
      );
    } finally {
      setConfirming(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <View style={styles.heading}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            NEW RUN
          </ThemedText>
          <ThemedText type="subtitle" style={styles.title}>
            Choose your starter
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Tap one Pokémon to select it. Your choice becomes the first member of your party.
          </ThemedText>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.choices}
          showsVerticalScrollIndicator={Platform.OS !== 'web'}>
          {starterQuery.data.map((pokemon) => {
            const selected = pokemon.id === selectedId;
            return (
              <Pressable
                key={pokemon.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${capitalize(pokemon.name)}, ${pokemon.types.join(' and ')} type`}
                onPress={() => {
                  setSelectedId(pokemon.id);
                  setConfirmError(null);
                }}
                style={[
                  styles.choice,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: selected ? '#e65d43' : 'transparent',
                  },
                ]}>
                <PokemonSprite pokemon={pokemon} />
                <View style={styles.choiceDetails}>
                  <ThemedText style={styles.pokemonName}>{capitalize(pokemon.name)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {pokemon.types.map(capitalize).join(' / ')}
                  </ThemedText>
                </View>
                {selected ? <ThemedText style={styles.selectedMark}>SELECTED</ThemedText> : null}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          {confirmError ? (
            <ThemedText style={styles.error}>{confirmError}</ThemedText>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={!selectedPokemon || confirming}
            onPress={() => {
              if (selectedPokemon) void confirmSelection(selectedPokemon);
            }}
            style={({ pressed }) => [
              styles.confirmButton,
              (!selectedPokemon || confirming) && styles.disabledButton,
              pressed && selectedPokemon && !confirming && styles.pressed,
            ]}>
            <ThemedText style={styles.confirmText}>
              {confirming ? 'Saving…' : 'Confirm starter'}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  heading: {
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
  },
  choices: {
    gap: 10,
    paddingBottom: 12,
  },
  scroll: {
    flex: 1,
  },
  choice: {
    minHeight: 126,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 18,
    padding: 8,
  },
  choiceDetails: {
    flex: 1,
    gap: 2,
  },
  pokemonName: {
    fontSize: 20,
    fontWeight: '700',
  },
  selectedMark: {
    color: '#e65d43',
    fontSize: 11,
    fontWeight: '800',
    marginRight: 8,
  },
  footer: {
    gap: 10,
    paddingTop: 12,
  },
  error: {
    color: '#b42318',
    textAlign: 'center',
  },
  confirmButton: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#e65d43',
    paddingHorizontal: 20,
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.8,
  },
});
