import { Redirect, router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PokemonSprite } from '@/components/pokemon-sprite';
import { ScreenState } from '@/components/screen-state';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useStarterSelectionController } from '@/hooks/use-starter-selection-controller';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function StarterSelectionScreen() {
  const theme = useTheme();
  const starter = useStarterSelectionController();
  const {
    state,
    retry,
    debugWipeSaveData,
    starterOptions,
    starterLoading,
    starterError,
    retryStarters,
    selectedId,
    selectedPokemon,
    chooseStarter,
    confirming,
    confirmError,
    confirmSelection,
  } = starter;

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
  if (starterLoading) {
    return (
      <ScreenState
        title="Finding your starters"
        message="Loading Pokémon choices from PokéAPI."
        loading
      />
    );
  }
  if (starterError || !starterOptions) {
    return (
      <ScreenState
        title="Starters unavailable"
        message={
          starterError instanceof Error
            ? starterError.message
            : 'PokéAPI could not provide starter choices.'
        }
        onRetry={retryStarters}
      />
    );
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
          {starterOptions.map((pokemon) => {
            const selected = pokemon.id === selectedId;
            return (
              <Pressable
                key={pokemon.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${capitalize(pokemon.name)}, ${pokemon.types.join(' and ')} type`}
                onPress={() => {
                  chooseStarter(pokemon.id);
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
              if (selectedPokemon) {
                void confirmSelection(selectedPokemon).then((saved) => {
                  if (saved) router.replace('/');
                });
              }
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
