import { useQueries } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenState } from '@/components/screen-state';
import { ThemedText } from '@/components/themed-text';
import { usePlayer } from '@/providers/player-provider';
import { fetchPokemon } from '@/services/pokeapi';
import type { BallType, HealingItem } from '@/types/game';

const healingItems: { key: HealingItem; name: string; detail: string }[] = [
  { key: 'potion', name: 'Potion', detail: 'Restore 30 HP' },
  { key: 'revive', name: 'Revive', detail: 'Restore half HP' },
];

const balls: { key: BallType; name: string }[] = [
  { key: 'pokeBall', name: 'Poké Ball' },
  { key: 'greatBall', name: 'Great Ball' },
  { key: 'ultraBall', name: 'Ultra Ball' },
];

function canUseItem(member: { currentHp: number; maxHp: number }, item: HealingItem) {
  return item === 'potion'
    ? member.currentHp > 0 && member.currentHp < member.maxHp
    : member.currentHp <= 0;
}

export default function BagScreen() {
  const { state, operationError, retry, applyItem, debugWipeSaveData } = usePlayer();
  const [selectedItem, setSelectedItem] = useState<HealingItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const party = state.status === 'ready' ? state.profile.party : [];
  const pokemonQueries = useQueries({
    queries: party.map((member) => ({
      queryKey: ['pokemon', member.pokemonId],
      queryFn: () => fetchPokemon(member.pokemonId),
    })),
  });
  const pokemonNamesLoading = pokemonQueries.some((query) => query.isPending);
  const pokemonNamesError = pokemonQueries.some((query) => query.error);

  if (state.status === 'loading') {
    return (
      <ScreenState title="Loading your bag" message="Restoring your saved items." loading />
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

  const { profile } = state;

  async function handleUseItem(item: HealingItem, slot: number) {
    try {
      await applyItem(item, slot);
      const memberIndex = party.findIndex((member) => member.slot === slot);
      const pokemonName = pokemonQueries[memberIndex]?.data?.name;
      const name = pokemonName
        ? pokemonName.charAt(0).toUpperCase() + pokemonName.slice(1)
        : 'Pokémon';
      setMessage(`${item === 'potion' ? 'Potion' : 'Revive'} used on ${name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The item could not be used.');
    }
  }

  function throwBall(ball: BallType) {
    router.replace({ pathname: '/', params: { throwBall: ball } });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText style={styles.eyebrow}>YOUR JOURNEY</ThemedText>
          <ThemedText style={styles.title}>Your bag</ThemedText>
          <ThemedText style={styles.subtitle}>Items are saved to your journey</ThemedText>
        </View>

        {operationError || message ? (
          <View style={styles.messageCard}>
            <ThemedText style={styles.messageText}>{message ?? operationError}</ThemedText>
          </View>
        ) : null}

        <ThemedText style={styles.sectionTitle}>HEALING</ThemedText>
        <View style={styles.items}>
          {healingItems.map((item) => {
            const unavailable = profile.inventory[item.key] === 0;
            return (
              <Pressable
                accessibilityRole="button"
                disabled={unavailable}
                key={item.key}
                onPress={() => {
                  setMessage(null);
                  setSelectedItem((current) => (current === item.key ? null : item.key));
                }}
                style={[
                  styles.item,
                  selectedItem === item.key && styles.selectedItem,
                  unavailable && styles.disabled,
                ]}>
                <ThemedText style={styles.itemName}>{item.name}</ThemedText>
                <ThemedText style={styles.itemDetail}>{item.detail}</ThemedText>
                <ThemedText style={styles.count}>×{profile.inventory[item.key]}</ThemedText>
              </Pressable>
            );
          })}
        </View>

        {selectedItem ? (
          <View style={styles.partySection}>
            <ThemedText style={styles.sectionTitle}>
              CHOOSE A POKÉMON FOR {selectedItem.toUpperCase()}
            </ThemedText>
            {pokemonNamesLoading ? (
              <View style={styles.nameStatus}>
                <ActivityIndicator size="small" color="#e65d43" />
                <ThemedText style={styles.itemDetail}>Loading Pokémon names…</ThemedText>
              </View>
            ) : null}
            {pokemonNamesError ? (
              <View style={styles.nameStatus}>
                <ThemedText style={styles.itemDetail}>
                  Some Pokémon names could not be loaded.
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void Promise.all(pokemonQueries.map((query) => query.refetch()));
                  }}
                  style={styles.retryNamesButton}>
                  <ThemedText style={styles.retryNamesText}>Retry names</ThemedText>
                </Pressable>
              </View>
            ) : null}
            {party.some((member) => canUseItem(member, selectedItem)) ? (
              party.map((member, index) => {
                const eligible = canUseItem(member, selectedItem);
                const pokemon = pokemonQueries[index]?.data;
                const pokemonName = pokemon
                  ? pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1)
                  : 'Name unavailable';
                return (
                  <Pressable
                    accessibilityRole="button"
                    disabled={!eligible}
                    key={member.slot}
                    onPress={() => void handleUseItem(selectedItem, member.slot)}
                    style={[styles.partyRow, !eligible && styles.disabled]}>
                    <View style={styles.partyDetails}>
                      <ThemedText style={styles.itemName}>{pokemonName}</ThemedText>
                      <ThemedText style={styles.itemDetail}>
                        {member.currentHp}/{member.maxHp} HP
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.useText}>
                      {eligible ? 'USE →' : 'UNAVAILABLE'}
                    </ThemedText>
                  </Pressable>
                );
              })
            ) : (
              <ThemedText style={styles.itemDetail}>
                {selectedItem === 'potion'
                  ? 'No Pokémon needs healing right now.'
                  : 'No fainted Pokémon can be revived right now.'}
              </ThemedText>
            )}
          </View>
        ) : null}

        <ThemedText style={styles.sectionTitle}>POKÉ BALLS</ThemedText>
        <View style={styles.items}>
          {balls.map((ball) => {
            const unavailable = profile.inventory[ball.key] === 0;
            return (
              <Pressable
                accessibilityRole="button"
                disabled={unavailable}
                key={ball.key}
                onPress={() => throwBall(ball.key)}
                style={[styles.item, unavailable && styles.disabled]}>
                <ThemedText style={styles.itemName}>{ball.name}</ThemedText>
                <ThemedText style={styles.itemDetail}>Try to catch the boss</ThemedText>
                <ThemedText style={styles.count}>×{profile.inventory[ball.key]}</ThemedText>
              </Pressable>
            );
          })}
        </View>
        <ThemedText style={styles.hint}>
          Choosing a ball opens the battle so you can watch the catch attempt.
        </ThemedText>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 14,
  },
  header: {
    gap: 3,
    marginBottom: 4,
  },
  eyebrow: {
    color: '#b86d51',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  subtitle: {
    color: '#77736b',
    fontSize: 12,
  },
  sectionTitle: {
    marginTop: 4,
    color: '#787369',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  items: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 9,
  },
  item: {
    width: '48%',
    minHeight: 76,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ebe5d8',
  },
  selectedItem: {
    borderColor: '#e65d43',
    backgroundColor: '#fff1eb',
  },
  itemName: {
    fontWeight: '800',
  },
  itemDetail: {
    color: '#77736b',
    fontSize: 12,
  },
  count: {
    position: 'absolute',
    top: 10,
    right: 12,
    color: '#e65d43',
    fontWeight: '900',
  },
  partySection: {
    gap: 8,
  },
  nameStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  retryNamesButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#6f655e',
  },
  retryNamesText: {
    color: '#fffaf0',
    fontSize: 11,
    fontWeight: '800',
  },
  partyRow: {
    minHeight: 54,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  partyDetails: {
    flex: 1,
    gap: 2,
  },
  useText: {
    color: '#e65d43',
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.45,
  },
  hint: {
    color: '#77736b',
    fontSize: 11,
    textAlign: 'center',
  },
  messageCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#e8efe2',
  },
  messageText: {
    color: '#3e5b40',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
