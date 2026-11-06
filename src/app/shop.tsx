import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBattleController } from '@/hooks/use-battle-controller';
import { ScreenState } from '@/components/screen-state';
import { ThemedText } from '@/components/themed-text';
import { PokemonSprite } from '@/components/pokemon-sprite';
import { STATUS_EFFECT_PRESENTATION } from '@/constants/status-effects';
import { usePlayer } from '@/providers/player-provider';
import {
  MOVE_LEARNING_PRICE,
  SHOP_CONFIG,
  getShopItemLabel,
} from '@/services/shop';
import { fetchPokemon, fetchPokemonShopMoves } from '@/services/pokeapi';
import { getMoveLabel } from '@/services/battle-rules';
import { getMovePattern } from '@/services/move-patterns';
import type { ShopItemKey } from '@/types/game';

const SHOP_ITEMS: ShopItemKey[] = ['potion', 'revive', 'pokeBall', 'greatBall', 'ultraBall'];

export default function ShopScreen() {
  const {
    state,
    operationError,
    retry,
    purchaseItem,
    learnMove,
    debugWipeSaveData,
  } = usePlayer();
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [selectedMove, setSelectedMove] = useState<string | null>(null);
  const [replacedMove, setReplacedMove] = useState<string | null>(null);
  const [confirmMovePurchase, setConfirmMovePurchase] = useState(false);
  const [learning, setLearning] = useState(false);
  const [learningError, setLearningError] = useState<string | null>(null);
  const battle = useBattleController();
  const selectedPartyMember =
    state.status === 'ready'
      ? state.profile.party.find((member) => member.slot === selectedSlot) ??
        state.profile.party[0]
      : undefined;
  const partyPokemonQueries = useQueries({
    queries:
      state.status === 'ready'
        ? state.profile.party.map((member) => ({
            queryKey: ['pokemon', member.pokemonId, member.moves],
            queryFn: () => fetchPokemon(member.pokemonId, member.moves),
          }))
        : [],
  });
  const learnsetQuery = useQuery({
    queryKey: [
      'pokemon-shop-moves',
      selectedPartyMember?.pokemonId,
      selectedPartyMember?.level,
    ],
    queryFn: () => {
      if (!selectedPartyMember) throw new Error('Choose a Pokémon first.');
      return fetchPokemonShopMoves(
        selectedPartyMember.pokemonId,
        selectedPartyMember.level
      );
    },
    enabled: selectedPartyMember !== undefined,
  });

  if (state.status === 'loading') {
    return <ScreenState title="Loading the shop" message="Restoring your coin pouch." loading />;
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
  const selectedMember = selectedPartyMember;
  const selectedMemberIndex = selectedMember
    ? profile.party.findIndex((member) => member.slot === selectedMember.slot)
    : -1;
  const selectedPokemon = partyPokemonQueries[selectedMemberIndex]?.data;
  const learnableMoves =
    learnsetQuery.data?.filter((move) => !selectedMember?.moves.includes(move.name)) ?? [];
  const previewMove = learnsetQuery.data?.find((move) => move.name === selectedMove);
  const previewPattern =
    previewMove && selectedPokemon && selectedMember
      ? getMovePattern(previewMove, selectedPokemon.stats, {
          level: selectedMember.level,
          currentHp: selectedMember.currentHp,
          maxHp: selectedMember.maxHp,
          lastPhysicalDamageTaken: selectedMember.lastPhysicalDamageTaken,
        })
      : null;
  const shopDue =
    profile.encounterComplete &&
    profile.shopProgress >= SHOP_CONFIG.encountersPerShop;

  async function handlePurchase(item: ShopItemKey) {
    try {
      await purchaseItem(item);
    } catch {
      // The provider stores the failure message in operationError.
    }
  }

  async function handleLearnMove() {
    if (!selectedMember || !selectedMove) return;
    setLearning(true);
    setLearningError(null);
    try {
      await learnMove(
        selectedMember.slot,
        selectedMove,
        selectedMember.moves.length >= 4 ? replacedMove : null,
        'shop'
      );
      setSelectedMove(null);
      setReplacedMove(null);
      setConfirmMovePurchase(false);
    } catch (error) {
      setLearningError(error instanceof Error ? error.message : 'The move could not be learned.');
    } finally {
      setLearning(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText style={styles.eyebrow}>SHOP</ThemedText>
          <ThemedText style={styles.title}>Marketplace</ThemedText>
          <ThemedText style={styles.subtitle}>Spend coins on recovery and battle items.</ThemedText>
        </View>

        <View style={styles.walletCard}>
          <ThemedText style={styles.walletLabel}>Coins</ThemedText>
          <ThemedText style={styles.walletValue}>{profile.money}</ThemedText>
        </View>

        {operationError ? (
          <View style={styles.errorCard}>
            <ThemedText style={styles.errorText}>{operationError}</ThemedText>
          </View>
        ) : null}

        <View style={styles.items}>
          {SHOP_ITEMS.map((item) => {
            const price = SHOP_CONFIG.prices[item];
            const canAfford = profile.money >= price;
            const unavailable = !canAfford;

            return (
              <Pressable
                accessibilityRole="button"
                disabled={unavailable}
                key={item}
                onPress={() => void handlePurchase(item)}
                style={[styles.item, unavailable && styles.disabled]}>
                <ThemedText style={styles.itemName}>{getShopItemLabel(item)}</ThemedText>
                <ThemedText style={styles.itemMeta}>{price} coins</ThemedText>
                <ThemedText style={styles.itemAction}>Tap to buy</ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.moveLearningCard}>
          <ThemedText style={styles.sectionTitle}>TEACH A MOVE</ThemedText>
          <ThemedText style={styles.footerText}>
            Learn an eligible level-up or TM-compatible move for {MOVE_LEARNING_PRICE} coins.
            Level-up moves must be unlocked by this Pokémon’s current level.
          </ThemedText>
          {!selectedMember ? (
            <ThemedText style={styles.footerText}>Choose a Pokémon before learning moves.</ThemedText>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.pokemonChoices}>
                  {profile.party.map((member, index) => {
                    const pokemon = partyPokemonQueries[index]?.data;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          pokemon
                            ? `${getMoveLabel(pokemon.name)}, level ${member.level}`
                            : `Loading Pokémon, level ${member.level}`
                        }
                        key={member.slot}
                        onPress={() => {
                          setSelectedSlot(member.slot);
                          setSelectedMove(null);
                          setReplacedMove(null);
                          setLearningError(null);
                        }}
                        style={[
                          styles.pokemonChoice,
                          selectedMember?.slot === member.slot && styles.selectedChoice,
                        ]}>
                        <PokemonSprite
                          pokemon={pokemon ?? { id: member.pokemonId, spriteUrl: null }}
                          size={36}
                        />
                        <View style={styles.pokemonChoiceTextGroup}>
                          <ThemedText numberOfLines={1} style={styles.moveChoiceText}>
                            {pokemon ? getMoveLabel(pokemon.name) : 'Loading Pokémon…'}
                          </ThemedText>
                          <ThemedText style={styles.pokemonLevel}>
                            Lv. {member.level}
                          </ThemedText>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              {partyPokemonQueries.some((query) => query.error) ? (
                <View style={styles.catalogError}>
                  <ThemedText style={styles.errorText}>
                    Pokémon details could not be loaded.
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      void Promise.all(
                        partyPokemonQueries.map((query) => query.refetch())
                      )
                    }
                    style={styles.retryButton}>
                    <ThemedText style={styles.retryText}>Retry</ThemedText>
                  </Pressable>
                </View>
              ) : null}

              {learnsetQuery.isPending ? (
                <ThemedText style={styles.footerText}>Loading this Pokémon’s learnset…</ThemedText>
              ) : null}
              {learnsetQuery.error ? (
                <View style={styles.catalogError}>
                  <ThemedText style={styles.errorText}>
                    {learnsetQuery.error instanceof Error
                      ? learnsetQuery.error.message
                      : 'Could not load this Pokémon’s moves.'}
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void learnsetQuery.refetch()}
                    style={styles.retryButton}>
                    <ThemedText style={styles.retryText}>Retry</ThemedText>
                  </Pressable>
                </View>
              ) : null}
              {learnsetQuery.data ? (
                <>
                  <ThemedText style={styles.moveSectionLabel}>CURRENT MOVES</ThemedText>
                  {selectedMember.moves.length > 0 ? (
                    <View style={styles.moveChoices}>
                      {selectedMember.moves.map((move) => (
                        <Pressable
                          accessibilityRole="button"
                          disabled={selectedMember.moves.length < 4}
                          key={move}
                          onPress={() => setReplacedMove(move)}
                          style={[
                            styles.moveChoice,
                            replacedMove === move && styles.selectedChoice,
                            selectedMember.moves.length < 4 && styles.unselectableChoice,
                          ]}>
                          <ThemedText style={styles.moveChoiceText}>{getMoveLabel(move)}</ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <ThemedText style={styles.footerText}>No moves equipped.</ThemedText>
                  )}
                  {selectedMember.moves.length < 4 ? (
                    <ThemedText style={styles.footerText}>
                      Empty move slots will be filled before replacing an equipped move.
                    </ThemedText>
                  ) : null}
                  <ThemedText style={styles.moveSectionLabel}>AVAILABLE AT THIS LEVEL</ThemedText>
                  {learnableMoves.length === 0 ? (
                    <ThemedText style={styles.footerText}>
                      This Pokémon has no other supported level-up moves available yet.
                    </ThemedText>
                  ) : (
                    <View style={styles.moveChoices}>
                      {learnableMoves.map((move) => (
                        <Pressable
                          accessibilityRole="button"
                          key={move.name}
                          onPress={() => {
                            setSelectedMove(move.name);
                            setLearningError(null);
                          }}
                          style={[
                            styles.moveChoice,
                            selectedMove === move.name && styles.selectedChoice,
                          ]}>
                          <ThemedText style={styles.moveChoiceText}>
                            {getMoveLabel(move.name)}
                          </ThemedText>
                          <ThemedText style={styles.moveSource}>
                            {move.learnMethod === 'level-up'
                              ? `Level ${move.learnedAtLevel}`
                              : 'TM / machine'}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {previewMove && previewPattern ? (
                    <View style={styles.attackPreview}>
                      <View style={styles.attackPreviewHeader}>
                          {selectedPokemon ? (
                          <PokemonSprite pokemon={selectedPokemon} size={38} />
                        ) : null}
                        <View style={styles.attackPreviewTitleGroup}>
                          <ThemedText style={styles.moveSectionLabel}>ATTACK PREVIEW</ThemedText>
                          <ThemedText style={styles.attackPreviewName}>
                            {selectedPokemon
                              ? `${getMoveLabel(selectedPokemon.name)} · ${getMoveLabel(previewMove.name)}`
                              : getMoveLabel(previewMove.name)}
                          </ThemedText>
                        </View>
                      </View>
                      {previewMove.statusEffect ? (
                        <ThemedText style={styles.previewStatus}>
                          {STATUS_EFFECT_PRESENTATION[previewMove.statusEffect].label.toUpperCase()}
                        </ThemedText>
                      ) : null}
                      <View style={styles.previewPattern}>
                        {Array.from(
                          { length: previewPattern.footprintSize },
                          (_, row) => (
                            <View key={row} style={styles.previewPatternRow}>
                              {Array.from(
                                { length: previewPattern.footprintSize },
                                (_, column) => {
                                  const hit = previewPattern.hitCells.some(
                                    (cell) => cell.row === row && cell.column === column
                                  );
                                  const status = previewMove.statusEffect
                                    ? STATUS_EFFECT_PRESENTATION[previewMove.statusEffect]
                                    : null;
                                  return (
                                    <View
                                      key={column}
                                      style={[
                                        styles.previewPatternCell,
                                        hit && styles.previewPatternHit,
                                        hit && status
                                          ? { backgroundColor: status.color }
                                          : null,
                                      ]}
                                    />
                                  );
                                }
                              )}
                            </View>
                          )
                        )}
                      </View>
                      <ThemedText style={styles.previewDetails}>
                        {previewPattern.hitCells.length} hit cells ·{' '}
                        {previewPattern.effectivePower === null
                          ? 'fails until its condition is met'
                          : `${previewPattern.effectivePower} power`}
                      </ThemedText>
                    </View>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    disabled={
                      learning ||
                      !selectedMove ||
                      profile.money < MOVE_LEARNING_PRICE ||
                      (selectedMember.moves.length >= 4 && !replacedMove)
                    }
                    onPress={() => {
                      if (selectedMember.moves.length >= 4) {
                        setConfirmMovePurchase(true);
                      } else {
                        void handleLearnMove();
                      }
                    }}
                    style={[
                      styles.teachButton,
                      (!selectedMove ||
                        profile.money < MOVE_LEARNING_PRICE ||
                        (selectedMember.moves.length >= 4 && !replacedMove)) &&
                        styles.disabled,
                    ]}>
                    <ThemedText style={styles.teachButtonText}>
                      {learning
                        ? 'PURCHASING…'
                        : selectedMove && selectedMember.moves.length >= 4 && replacedMove
                          ? `REPLACE ${getMoveLabel(replacedMove).toUpperCase()} WITH ${getMoveLabel(selectedMove).toUpperCase()} · ${MOVE_LEARNING_PRICE} COINS`
                          : `LEARN MOVE · ${MOVE_LEARNING_PRICE} COINS`}
                    </ThemedText>
                  </Pressable>
                  {profile.money < MOVE_LEARNING_PRICE ? (
                    <ThemedText style={styles.footerText}>
                      You need {MOVE_LEARNING_PRICE - profile.money} more coins to learn a move.
                    </ThemedText>
                  ) : null}
                </>
              ) : null}
              {learningError ? <ThemedText style={styles.errorText}>{learningError}</ThemedText> : null}
            </>
          )}
        </View>

        <Modal
          animationType="fade"
          transparent
          visible={confirmMovePurchase}
          onRequestClose={() => setConfirmMovePurchase(false)}>
          <View style={styles.confirmBackdrop}>
            <View style={styles.confirmCard}>
              <ThemedText style={styles.confirmTitle}>Replace this move?</ThemedText>
              <ThemedText style={styles.footerText}>
                {selectedMove && replacedMove
                  ? `Learn ${getMoveLabel(selectedMove)} instead of ${getMoveLabel(replacedMove)}? This costs ${MOVE_LEARNING_PRICE} coins and cannot be undone without purchasing the old move again.`
                  : 'This move replacement cannot be undone without purchasing the old move again.'}
              </ThemedText>
              <View style={styles.confirmActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={learning}
                  onPress={() => setConfirmMovePurchase(false)}
                  style={styles.cancelButton}>
                  <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={learning}
                  onPress={() => void handleLearnMove()}
                  style={styles.confirmButton}>
                  <ThemedText style={styles.confirmButtonText}>
                    {learning ? 'PURCHASING…' : 'CONFIRM PURCHASE'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {shopDue ? (
          <>
            <ThemedText style={styles.footerText}>
              Purchase items and heal before continuing your run.
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              disabled={battle.busy}
              onPress={async () => {
                if (await battle.startNewEncounter(true)) {
                  router.replace('/');
                }
              }}
              style={({ pressed }) => [
                styles.continueButton,
                battle.busy && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <ThemedText style={styles.continueButtonText}>
                {battle.busy ? 'LOADING NEXT ENCOUNTER…' : 'CONTINUE TO NEXT ENCOUNTER'}
              </ThemedText>
            </Pressable>
            {battle.message && battle.message !== 'Choose a move to view its attack pattern.' ? (
              <ThemedText style={styles.footerText}>{battle.message}</ThemedText>
            ) : null}
          </>
        ) : (
          <ThemedText style={styles.footerText}>
            The shop will open automatically after {SHOP_CONFIG.encountersPerShop} encounters.
          </ThemedText>
        )}
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
    paddingTop: 18,
    paddingBottom: 24,
    gap: 14,
  },
  header: {
    gap: 4,
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
  walletCard: {
    backgroundColor: '#fffaf2',
    borderWidth: 1,
    borderColor: '#ebd4a8',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletLabel: {
    color: '#7a695e',
    fontWeight: '700',
  },
  walletValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#d39f34',
  },
  errorCard: {
    backgroundColor: '#fff0f0',
    borderColor: '#e6bbbc',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    color: '#a13a39',
    fontWeight: '700',
  },
  items: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  item: {
    width: '48%',
    minHeight: 88,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8dfd2',
  },
  itemName: {
    fontWeight: '800',
    marginBottom: 4,
  },
  itemMeta: {
    color: '#77736b',
    fontSize: 12,
  },
  itemAction: {
    marginTop: 8,
    color: '#b86d51',
    fontWeight: '800',
  },
  continueButton: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#e65d43',
    paddingHorizontal: 16,
  },
  continueButtonText: {
    color: '#fffaf0',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.45,
  },
  footer: {
    marginTop: 4,
  },
  footerText: {
    color: '#7a695e',
    fontSize: 12,
  },
  moveLearningCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ebd4a8',
    backgroundColor: '#fffaf2',
    gap: 10,
  },
  sectionTitle: {
    color: '#39424a',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  pokemonChoices: {
    flexDirection: 'row',
    gap: 8,
  },
  pokemonChoice: {
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f1eee8',
  },
  pokemonChoiceTextGroup: {
    flex: 1,
  },
  pokemonLevel: {
    color: '#77736b',
    fontSize: 10,
    fontWeight: '700',
  },
  moveSectionLabel: {
    color: '#39424a',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  moveChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  moveChoice: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e8dfd2',
    borderRadius: 11,
    backgroundColor: '#ffffff',
  },
  selectedChoice: {
    borderColor: '#e65d43',
    backgroundColor: '#fff0e8',
  },
  unselectableChoice: {
    opacity: 0.75,
  },
  moveChoiceText: {
    color: '#39424a',
    fontSize: 11,
    fontWeight: '800',
  },
  moveSource: {
    marginTop: 2,
    color: '#77736b',
    fontSize: 9,
    fontWeight: '700',
  },
  attackPreview: {
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#25394a',
  },
  attackPreviewHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  attackPreviewTitleGroup: {
    alignItems: 'flex-start',
  },
  attackPreviewName: {
    color: '#fffaf0',
    fontSize: 12,
    fontWeight: '800',
  },
  previewStatus: {
    color: '#fffaf0',
    fontSize: 10,
    fontWeight: '900',
  },
  previewPattern: {
    alignItems: 'center',
    gap: 3,
  },
  previewPatternRow: {
    flexDirection: 'row',
    gap: 3,
  },
  previewPatternCell: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  previewPatternHit: {
    backgroundColor: '#efb34f',
    borderColor: '#ffd787',
  },
  previewDetails: {
    color: '#fffaf0',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  teachButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: '#e65d43',
  },
  teachButtonText: {
    color: '#fffaf0',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  catalogError: {
    gap: 6,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  retryText: {
    color: '#a4523e',
    fontSize: 12,
    fontWeight: '900',
  },
  confirmBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 18,
    backgroundColor: 'rgba(27, 38, 46, 0.72)',
  },
  confirmCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#fffaf2',
    gap: 12,
  },
  confirmTitle: {
    color: '#25394a',
    fontSize: 21,
    fontWeight: '900',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#e8dfd2',
  },
  cancelButtonText: {
    color: '#39424a',
    fontSize: 11,
    fontWeight: '900',
  },
  confirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#e65d43',
  },
  confirmButtonText: {
    color: '#fffaf0',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
});
