import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useShopController } from '@/hooks/use-shop-controller';
import { ScreenState } from '@/components/screen-state';
import { MovePatternPreview } from '@/components/battle/move-pattern-preview';
import { ThemedText } from '@/components/themed-text';
import { PokemonSprite } from '@/components/pokemon-sprite';
import { getMoveLabel } from '@/utils/labels';

export default function ShopScreen() {
  const shop = useShopController();
  const {
    state,
    operationError,
    retry,
    debugWipeSaveData,
    battle,
    selectedMember,
    selectedPokemon,
    partyMembers,
    learnsetData,
    learnsetLoading,
    learnsetError,
    retryLearnset,
    evolutionChoices,
    evolutionDataError,
    learnableMoves,
    previewMove,
    previewPattern,
    shopDue,
    shopItems,
    moveLearningPrice,
    canAffordMoveLearning,
    canTeachSelectedMove,
    encountersPerShop,
    partyPokemonError,
    partyEvolutionLoading,
    selectedMove,
    setSelectedMove,
    replacedMove,
    setReplacedMove,
    confirmMovePurchase,
    setConfirmMovePurchase,
    learning,
    learningError,
    setLearningError,
    purchaseError,
    evolvingOption,
    evolutionError,
    choosePartyMember,
    retryPartyPokemon,
    retryPartyEvolutions,
    handlePurchase,
    handleLearnMove,
    handleEvolution,
  } = shop;

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
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText style={styles.eyebrow}>SHOP</ThemedText>
          <ThemedText style={styles.title}>Marketplace</ThemedText>
          <ThemedText style={styles.subtitle}>Spend coins on recovery and battle items.</ThemedText>
        </View>

        <View style={styles.walletCard}>
          <ThemedText style={styles.walletLabel}>Coins</ThemedText>
          <ThemedText style={styles.walletValue}>{profile.money}</ThemedText>
        </View>

        {operationError || purchaseError ? (
          <View style={styles.errorCard}>
            <ThemedText style={styles.errorText}>
              {purchaseError ?? operationError}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.items}>
          {shopItems.map((item) => {
            const price = item.price;
            const unavailable = !item.canAfford;

            return (
              <Pressable
                accessibilityRole="button"
                disabled={unavailable}
                key={item.key}
                onPress={() => void handlePurchase(item.key)}
                style={[styles.item, unavailable && styles.disabled]}>
                <ThemedText style={styles.itemName}>{item.label}</ThemedText>
                <ThemedText style={styles.itemMeta}>{price} coins</ThemedText>
                <ThemedText style={styles.itemAction}>Tap to buy</ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.moveLearningCard}>
          <ThemedText style={styles.sectionTitle}>TEACH A MOVE</ThemedText>
          <ThemedText style={styles.footerText}>
            Learn an eligible level-up or TM-compatible move for {moveLearningPrice} coins.
            Level-up moves must be unlocked by this Pokémon’s current level.
          </ThemedText>
          {!selectedMember ? (
            <ThemedText style={styles.footerText}>Choose a Pokémon before learning moves.</ThemedText>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.pokemonChoices}>
                  {partyMembers.map((member) => {
                    const pokemon = member.pokemon;
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
                          choosePartyMember(member.slot);
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

              {partyPokemonError ? (
                <View style={styles.catalogError}>
                  <ThemedText style={styles.errorText}>
                    Pokémon details could not be loaded.
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    onPress={retryPartyPokemon}
                    style={styles.retryButton}>
                    <ThemedText style={styles.retryText}>Retry</ThemedText>
                  </Pressable>
                </View>
              ) : null}

              {learnsetLoading ? (
                <ThemedText style={styles.footerText}>Loading this Pokémon’s learnset…</ThemedText>
              ) : null}
              {learnsetError ? (
                <View style={styles.catalogError}>
                  <ThemedText style={styles.errorText}>
                    {learnsetError instanceof Error
                      ? learnsetError.message
                      : 'Could not load this Pokémon’s moves.'}
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    onPress={retryLearnset}
                    style={styles.retryButton}>
                    <ThemedText style={styles.retryText}>Retry</ThemedText>
                  </Pressable>
                </View>
              ) : null}
              {learnsetData ? (
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
                  {previewMove && previewPattern ? (
                    <MovePatternPreview
                      move={previewMove}
                      pattern={previewPattern}
                      pokemon={selectedPokemon}
                    />
                  ) : null}
                  <ThemedText style={styles.moveSectionLabel}>AVAILABLE AT THIS LEVEL</ThemedText>
                  {learnableMoves.length === 0 ? (
                    <ThemedText style={styles.footerText}>
                      This Pokémon has no other supported level-up moves available yet.
                    </ThemedText>
                  ) : (
                    <ScrollView
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                      style={styles.availableMoveList}
                      contentContainerStyle={styles.moveChoices}>
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
                    </ScrollView>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    disabled={
                      !canTeachSelectedMove
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
                      !canTeachSelectedMove && styles.disabled,
                    ]}>
                    <ThemedText style={styles.teachButtonText}>
                      {learning
                        ? 'PURCHASING…'
                        : selectedMove && selectedMember.moves.length >= 4 && replacedMove
                          ? `REPLACE ${getMoveLabel(replacedMove).toUpperCase()} WITH ${getMoveLabel(selectedMove).toUpperCase()} · ${moveLearningPrice} COINS`
                          : `LEARN MOVE · ${moveLearningPrice} COINS`}
                    </ThemedText>
                  </Pressable>
                  {!canAffordMoveLearning ? (
                    <ThemedText style={styles.footerText}>
                      You need {moveLearningPrice - profile.money} more coins to learn a move.
                    </ThemedText>
                  ) : null}
                </>
              ) : null}
              {learningError ? <ThemedText style={styles.errorText}>{learningError}</ThemedText> : null}
            </>
          )}
        </View>

        {evolutionChoices.length > 0 ||
        evolutionDataError ||
        partyEvolutionLoading ? (
          <View style={styles.evolutionCard}>
            <ThemedText style={styles.sectionTitle}>EVOLVE A POKÉMON</ThemedText>
            <ThemedText style={styles.footerText}>
              Evolve any eligible party Pokémon for free.
            </ThemedText>
            {partyEvolutionLoading ? (
              <ThemedText style={styles.footerText}>Checking your party for available evolutions…</ThemedText>
            ) : null}
            {evolutionDataError ? (
              <View style={styles.catalogError}>
                <ThemedText style={styles.errorText}>
                  Evolution choices could not be loaded.
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    retryPartyEvolutions()
                  }
                  style={styles.retryButton}>
                  <ThemedText style={styles.retryText}>Retry</ThemedText>
                </Pressable>
              </View>
            ) : null}
            {evolutionChoices.map(({ member, options, pokemon }) => {
              return (
                <View key={`${member.slot}:${member.pokemonId}`} style={styles.evolutionParty}>
                  <View style={styles.evolutionMember}>
                    <PokemonSprite
                      pokemon={pokemon ?? { id: member.pokemonId, spriteUrl: null }}
                      size={38}
                    />
                    <View style={styles.pokemonChoiceTextGroup}>
                      <ThemedText numberOfLines={1} style={styles.moveChoiceText}>
                        {pokemon ? getMoveLabel(pokemon.name) : 'Loading Pokémon…'}
                      </ThemedText>
                      <ThemedText style={styles.pokemonLevel}>Lv. {member.level}</ThemedText>
                    </View>
                  </View>
                  {options.map((option) => {
                    const key = `${member.slot}:${option.pokemonId}`;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        disabled={evolvingOption !== null}
                        key={option.pokemonId}
                        onPress={() =>
                          void handleEvolution(
                            member.slot,
                            option.pokemonId,
                            option.minimumLevel
                          )
                        }
                        style={[
                          styles.evolutionButton,
                          evolvingOption === key && styles.disabled,
                          evolvingOption !== null && evolvingOption !== key && styles.disabled,
                        ]}>
                        <ThemedText style={styles.teachButtonText}>
                          {evolvingOption === key
                            ? 'EVOLVING…'
                            : `EVOLVE INTO ${getMoveLabel(option.name).toUpperCase()} · FREE`}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
            {evolutionError ? (
              <View style={styles.catalogError}>
                <ThemedText style={styles.errorText}>{evolutionError}</ThemedText>
                <ThemedText style={styles.footerText}>
                  Tap an evolution again to retry.
                </ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}

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
                  ? `Learn ${getMoveLabel(selectedMove)} instead of ${getMoveLabel(replacedMove)}? This costs ${moveLearningPrice} coins and cannot be undone without purchasing the old move again.`
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
            {battle.message && battle.message !== 'Choose a move to view its attack pattern.' ? (
              <ThemedText style={styles.footerText}>{battle.message}</ThemedText>
            ) : null}
          </>
        ) : (
          <ThemedText style={styles.footerText}>
            The shop will open automatically after {encountersPerShop} encounters.
          </ThemedText>
        )}
      </ScrollView>
      {shopDue ? (
        <View style={styles.stickyFooter}>
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
              pressed && !battle.busy && styles.pressed,
            ]}>
            <ThemedText style={styles.continueButtonText}>
              {battle.busy ? 'LOADING NEXT ENCOUNTER…' : 'CONTINUE TO NEXT ENCOUNTER'}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f1e7',
  },
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 18,
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
  stickyFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#e8dfd2',
    backgroundColor: '#f5f1e7',
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
  evolutionCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ebd4a8',
    backgroundColor: '#fffaf2',
    gap: 10,
  },
  evolutionParty: {
    paddingTop: 8,
    gap: 8,
  },
  evolutionMember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  evolutionButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#e65d43',
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
  availableMoveList: {
    maxHeight: 180,
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
