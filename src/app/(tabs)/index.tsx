import { useQueries } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { MoveCard } from '@/components/battle/move-card';
import { AreaBackground } from '@/components/battle/area-background';
import { PokemonSprite } from '@/components/pokemon-sprite';
import { ScreenState } from '@/components/screen-state';
import { ThemedText } from '@/components/themed-text';
import { useBattleController } from '@/hooks/use-battle-controller';
import { STATUS_EFFECT_PRESENTATION } from '@/constants/status-effects';
import { AREA_PROGRESSION_CONFIG } from '@/services/area-progression';
import { getMoveLabel, getPlayerMaxHp } from '@/services/battle-rules';
import { SHOP_CONFIG } from '@/services/shop';
import { fetchPokemon } from '@/services/pokeapi';
import type { PokemonMove } from '@/types/game';
import { router, useLocalSearchParams, usePathname } from 'expo-router';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function BattleScreen() {
  const gridRef = useRef<React.ElementRef<typeof View>>(null);
  const [confirmWipeSave, setConfirmWipeSave] = useState(false);
  const [selectedUnlockSlot, setSelectedUnlockSlot] = useState<number | null>(null);
  const [selectedUnlockedMove, setSelectedUnlockedMove] = useState<string | null>(null);
  const [selectedReplacedMove, setSelectedReplacedMove] = useState<string | null>(null);
  const [confirmMoveReplacement, setConfirmMoveReplacement] = useState(false);
  const [moveLearningError, setMoveLearningError] = useState<string | null>(null);
  const [savingMove, setSavingMove] = useState(false);
  const [savingEvolution, setSavingEvolution] = useState(false);
  const [evolutionError, setEvolutionError] = useState<string | null>(null);
  const battle = useBattleController();
  const partyPokemonQueries = useQueries({
    queries:
      battle.profile?.party.map((member) => ({
        queryKey: ['pokemon', member.pokemonId, member.moves],
        queryFn: () => fetchPokemon(member.pokemonId, member.moves),
      })) ?? [],
  });
  const pendingEvolution = battle.profile?.pendingEvolutions.find(
    (evolution) => !evolution.prompted
  );
  const evolutionPokemonQueries = useQueries({
    queries:
      pendingEvolution?.options.map((option) => ({
        queryKey: ['pokemon', option.pokemonId, []],
        queryFn: () => fetchPokemon(option.pokemonId),
      })) ?? [],
  });
  const pathname = usePathname();
  const { throwBall } = useLocalSearchParams<{ throwBall?: string | string[] }>();
  const handledThrow = useRef<string | null>(null);
  const shopRedirectProgress = useRef<number | null>(null);

  useEffect(() => {
    const ball = Array.isArray(throwBall) ? throwBall[0] : throwBall;
    if (!ball) {
      handledThrow.current = null;
      return;
    }
    if (ball !== 'pokeBall' && ball !== 'greatBall' && ball !== 'ultraBall') {
      if (handledThrow.current !== ball) {
        handledThrow.current = ball;
        battle.setMessage('That Poké Ball is not available.');
        router.replace('/');
      }
      return;
    }
    if (!battle.remoteReady || battle.state.status !== 'ready' || handledThrow.current === ball) {
      return;
    }

    handledThrow.current = ball;
    void battle.handleCatch(ball);
    router.replace('/');
  }, [battle, throwBall]);

  useEffect(() => {
    const shopProgress = battle.profile?.shopProgress;
    const shouldOpenShop =
      battle.profile?.encounterComplete &&
      !battle.profile.pendingCatch &&
      shopProgress !== undefined &&
      shopProgress >= SHOP_CONFIG.encountersPerShop;

    if (!shouldOpenShop) {
      shopRedirectProgress.current = null;
      return;
    }
    if (pathname === '/shop') {
      shopRedirectProgress.current = null;
      return;
    }
    if (
      !battle.busy &&
      !battle.catchAnimation &&
      shopRedirectProgress.current !== shopProgress
    ) {
      shopRedirectProgress.current = shopProgress;
      router.replace('../shop');
    }
  }, [
    battle.busy,
    battle.catchAnimation,
    battle.profile?.encounterComplete,
    battle.profile?.pendingCatch,
    battle.profile?.shopProgress,
    pathname,
  ]);

  if (battle.state.status === 'loading') {
    return (
      <ScreenState
        title="Loading your save"
        message="Getting your party and raid progress ready."
        loading
      />
    );
  }
  if (battle.state.status === 'error') {
    return (
      <ScreenState
        title="Save unavailable"
        message={battle.operationError ?? battle.state.message}
        onRetry={battle.retry}
        onWipeSave={battle.debugWipeSaveData}
      />
    );
  }
  const profile = battle.state.profile;
  const activeEvolution = profile.pendingEvolutions.find(
    (evolution) => !evolution.prompted
  );
  const activeMember = profile.party.find((member) => member.slot === profile.activeSlot);
  const selectedUnlock =
    profile.pendingMoveUnlocks.find((unlock) => unlock.slot === selectedUnlockSlot) ??
    profile.pendingMoveUnlocks[0];
  const unlockMember = selectedUnlock
    ? profile.party.find(
        (member) =>
          member.slot === selectedUnlock.slot && member.pokemonId === selectedUnlock.pokemonId
      )
    : undefined;
  if (!activeMember) {
    return (
      <ScreenState
        title="No active Pokémon"
        message="Visit your party and choose a Pokémon to continue."
      />
    );
  }
  if (battle.remoteLoading) {
    return (
      <ScreenState
        title="Finding your Pokémon"
        message="Loading Pokémon and move data from PokéAPI."
        loading
      />
    );
  }
  if (battle.remoteError) {
    return (
      <ScreenState
        title="Pokémon data unavailable"
        message={
          battle.remoteError instanceof Error
            ? battle.remoteError.message
            : 'PokéAPI could not be reached.'
        }
        onRetry={battle.retryRemote}
      />
    );
  }
  if (!battle.remoteReady) {
    return (
      <ScreenState
        title="Battle data incomplete"
        message="The battle could not load its Pokémon. Try refreshing the data."
        onRetry={battle.retryRemote}
      />
    );
  }
  const playerPokemonCandidate = battle.playerPokemon;
  const bossPokemonCandidate = battle.bossPokemon;
  if (!playerPokemonCandidate || !bossPokemonCandidate) {
    return (
      <ScreenState
        title="Battle data incomplete"
        message="The battle could not load its Pokémon. Try refreshing the data."
        onRetry={battle.retryRemote}
      />
    );
  }
  const playerPokemon = playerPokemonCandidate;
  const bossPokemon = bossPokemonCandidate;
  const area = battle.area;
  if (!area) {
    return (
      <ScreenState
        title="Area unavailable"
        message="The saved area could not be found. Try refreshing your save."
        onRetry={battle.retry}
      />
    );
  }
  const dimensionsCandidate = battle.dimensions;
  if (!dimensionsCandidate) {
    return (
      <ScreenState
        title="Battle grid unavailable"
        message="The boss grid could not be calculated from its stats."
        onRetry={battle.retryRemote}
      />
    );
  }
  const dimensions = dimensionsCandidate;

  const hpPercent = Math.max(0, Math.min(100, (activeMember.currentHp / activeMember.maxHp) * 100));
  const encounterNumber = profile.encounterIndex + 1;
  const areaProgress =
    (encounterNumber / AREA_PROGRESSION_CONFIG.encountersPerArea) * 100;
  const shopDue = profile.shopProgress >= SHOP_CONFIG.encountersPerShop;

  function continueAfterDefeat() {
    if (shopDue) {
      router.replace('../shop');
      return;
    }
    void battle.startNewEncounter();
  }

  function dropMove(move: PokemonMove, x: number, y: number) {
    if (!battle.canBattle) return;
    gridRef.current?.measureInWindow((left, top, width, height) => {
      if (x < left || x > left + width || y < top || y > top + height) {
        battle.setMessage('Move selected. Drop it over a grid cell or tap a target.');
        return;
      }
      const column = Math.min(
        dimensions.columns - 1,
        Math.floor(((x - left) / width) * dimensions.columns)
      );
      const row = Math.min(
        dimensions.rows - 1,
        Math.floor(((y - top) / height) * dimensions.rows)
      );
      void battle.attackMove(move, row, column);
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View>
            <ThemedText style={styles.eyebrow}>POKÉMON RAID</ThemedText>
            <ThemedText style={styles.title}>Battle</ThemedText>
          </View>
          <View style={styles.turnPill}>
            <Text style={styles.turnText}>
              {battle.bossCaught ? 'CAUGHT' : battle.bossDefeated ? 'CLEAR' : 'LIVE RAID'}
            </Text>
          </View>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressLabelRow}>
            <ThemedText style={styles.progressArea}>
              {area.name.toUpperCase()} · AREA {profile.areaNumber}
            </ThemedText>
            <ThemedText style={styles.progressEncounter}>
              {profile.encounterIndex + 1}/{AREA_PROGRESSION_CONFIG.encountersPerArea}
            </ThemedText>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={`${area.name} area progress`}
            accessibilityValue={{
              min: 0,
              max: AREA_PROGRESSION_CONFIG.encountersPerArea,
              now: encounterNumber,
            }}
            style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${areaProgress}%` }]} />
          </View>
          <ThemedText style={styles.progressHint}>
            {area.favoredTypes.map(capitalize).join(' · ')} · Level {profile.opponentLevel}
          </ThemedText>
        </View>

        <View style={styles.arena}>
          <AreaBackground areaId={area.id} />
          <View style={styles.fighter}>
            <View style={styles.playerSprite}>
              <PokemonSprite pokemon={playerPokemon} />
            </View>
            <ThemedText numberOfLines={1} style={styles.fighterName}>
              {capitalize(playerPokemon.name)}
            </ThemedText>
            <ThemedText style={styles.fighterType}>{playerPokemon.types.join(' · ')}</ThemedText>
            <ThemedText style={styles.levelText}>LV. {activeMember.level}</ThemedText>
          </View>
          <Text style={styles.versus}>VS</Text>
          <View style={styles.fighter}>
            <View style={styles.bossSprite}>
              <PokemonSprite pokemon={bossPokemon} mirrored />
            </View>
            <ThemedText numberOfLines={1} style={styles.fighterName}>
              {capitalize(bossPokemon.name)}
            </ThemedText>
            <ThemedText style={styles.fighterType}>
              {bossPokemon.types.join(' · ')}
            </ThemedText>
            <ThemedText style={styles.levelText}>LV. {profile.opponentLevel}</ThemedText>
          </View>
        </View>

        <View style={styles.playerHealthCard}>
          <View style={styles.healthLabelRow}>
            <ThemedText style={styles.healthName}>YOUR POKÉMON</ThemedText>
            <ThemedText style={styles.healthValue}>
              {activeMember.currentHp} / {activeMember.maxHp} HP
            </ThemedText>
          </View>
          <View style={styles.healthTrack}>
            <View style={[styles.healthFill, { width: `${hpPercent}%` }]} />
          </View>
        </View>

        <View style={styles.bossCard}>
          <View style={styles.cardHeader}>
            <View>
              <ThemedText style={styles.sectionTitle}>
                {profile.opponentIsAreaBoss ? 'AREA BOSS VITALS' : 'OPPONENT VITALS'}
              </ThemedText>
              <ThemedText style={styles.hint}>
                {battle.bossRemaining} of {battle.totalHpBlocks} blocks remain
              </ThemedText>
            </View>
            <View style={styles.blocksPill}>
              <Text style={styles.blocksPillText}>GRID HEALTH</Text>
            </View>
          </View>
          <View style={styles.gridStage}>
            <View ref={gridRef} collapsable={false} style={styles.grid}>
              {Array.from({ length: dimensions.rows }, (_, row) => (
                <View key={`row-${row}`} style={styles.gridRow}>
                  {Array.from({ length: dimensions.columns }, (_, column) => {
                    const index = row * dimensions.columns + column;
                    const active = battle.cells[index];
                    const hasInitialBlock = battle.initialGridCells[index];
                    const status = battle.statuses[index];
                    const statusPresentation = status
                      ? STATUS_EFFECT_PRESENTATION[status]
                      : null;
                    const ball = battle.catchAnimation?.positions.includes(index) ?? false;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Boss grid row ${row + 1}, column ${column + 1}, ${statusPresentation ? `${statusPresentation.label} status, ${active ? 'occupied' : 'cleared'}` : active ? 'occupied' : hasInitialBlock ? 'cleared' : 'empty'}`}
                        disabled={battle.busy || !battle.canBattle || !battle.selectedMove}
                        key={index}
                        onPress={() => battle.handleGridCell(row, column)}
                        style={[
                          styles.gridCell,
                          !hasInitialBlock
                            ? styles.gridCellVoid
                            : active
                              ? styles.gridCellActive
                              : styles.gridCellCleared,
                          statusPresentation && {
                            backgroundColor: statusPresentation.color,
                          },
                          ball && styles.gridCellBall,
                        ]}>
                        {ball ? (
                          <Text style={styles.ballGlyph}>●</Text>
                        ) : statusPresentation ? (
                          <Image
                            contentFit="contain"
                            source={statusPresentation.icon}
                            style={styles.gridCellStatusIcon}
                          />
                        ) : active ? (
                          <View style={styles.cellDot} />
                        ) : hasInitialBlock ? (
                          <View style={styles.emptyDot} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
            {battle.bossDefeated && !profile.pendingCatch ? (
              <View style={styles.gridContinueOverlay}>
                <Pressable
                  accessibilityRole="button"
                  disabled={battle.busy}
                  onPress={continueAfterDefeat}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    styles.gridContinueButton,
                    battle.busy && styles.disabledButton,
                    pressed && !battle.busy && styles.pressed,
                  ]}>
                  <Text style={styles.primaryButtonText}>
                    {battle.busy
                      ? 'LOADING…'
                      : shopDue
                        ? 'CONTINUE TO SHOP'
                        : 'CONTINUE RUN'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          <ThemedText style={styles.gridHint}>
            {battle.bossDefeated
              ? 'Opponent defeated.'
              : battle.catchAnimation
              ? 'Wobble…'
              : 'Tap a move to view its pattern, then drag it here or tap a target cell.'}
          </ThemedText>
        </View>

        {(battle.operationError || battle.message) && (
          <View style={[styles.messageCard, battle.operationError && styles.errorCard]}>
            <ThemedText style={styles.messageText}>
              {battle.operationError ?? battle.message}
            </ThemedText>
          </View>
        )}

        {profile.pendingCatch ? (
          <View style={styles.replacementCard}>
            <ThemedText style={styles.sectionTitle}>MAKE ROOM FOR YOUR NEW CATCH</ThemedText>
            <ThemedText style={styles.replacementHint}>
              Choose a teammate to release and replace with {capitalize(bossPokemon.name)}.
              This choice is saved if you leave the screen.
            </ThemedText>
            {partyPokemonQueries.some((query) => query.error) ? (
              <View style={styles.replacementError}>
                <ThemedText style={styles.replacementHint}>
                  Some Pokémon names could not be loaded. You can still choose by ID.
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void Promise.all(partyPokemonQueries.map((query) => query.refetch()));
                  }}
                  style={styles.retryNamesButton}>
                  <Text style={styles.retryNamesText}>Retry names</Text>
                </Pressable>
              </View>
            ) : null}
            {profile.party.map((member, index) => {
              const pokemon = partyPokemonQueries[index]?.data;
              const label = pokemon
                ? capitalize(pokemon.name)
                : `Pokémon #${member.pokemonId}`;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Release ${label} and add ${capitalize(bossPokemon.name)}`}
                  disabled={battle.busy}
                  key={member.slot}
                  onPress={() => void battle.replacePartyMember(member.slot)}
                  style={({ pressed }) => [
                    styles.replacementButton,
                    battle.busy && styles.debugButtonDisabled,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.replacementButtonText}>
                    Release {label} · Lv. {member.level}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {profile.encounterComplete &&
        !profile.pendingCatch &&
        !battle.bossDefeated ? (
          <Pressable
            accessibilityRole="button"
            disabled={battle.busy || profile.shopProgress >= SHOP_CONFIG.encountersPerShop}
            onPress={() => void battle.startNewEncounter()}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>CONTINUE RUN</Text>
          </Pressable>
        ) : null}

        <View style={styles.debugCard}>
          <View style={styles.debugHeader}>
            <ThemedText style={styles.sectionTitle}>DEBUG TOOLS</ThemedText>
            <ThemedText style={styles.hint}>Prototype shortcuts</ThemedText>
          </View>
          <View style={styles.debugActions}>
            <Pressable
              accessibilityRole="button"
              disabled={battle.busy || profile.encounterComplete || !battle.remoteReady}
              onPress={() => void battle.debugDefeatCurrent()}
              style={({ pressed }) => [
                styles.debugButton,
                (battle.busy || profile.encounterComplete || !battle.remoteReady) &&
                  styles.debugButtonDisabled,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.debugButtonText}>Defeat Pokémon</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={battle.busy || profile.opponentIsAreaBoss}
              onPress={() => void battle.debugGoToAreaBoss()}
              style={({ pressed }) => [
                styles.debugButton,
                (battle.busy || profile.opponentIsAreaBoss) && styles.debugButtonDisabled,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.debugButtonText}>Go to Area Boss</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={battle.busy || profile.party.every(
                (member) => member.currentHp === member.maxHp
              )}
              onPress={() => void battle.debugHealEntireParty()}
              style={({ pressed }) => [
                styles.debugButton,
                (battle.busy ||
                  profile.party.every((member) => member.currentHp === member.maxHp)) &&
                  styles.debugButtonDisabled,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.debugButtonText}>Revive + Heal Party</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={battle.busy}
              onPress={() => setConfirmWipeSave(true)}
              style={({ pressed }) => [
                styles.debugButton,
                styles.debugDangerButton,
                battle.busy && styles.debugButtonDisabled,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.debugButtonText}>Wipe Save Data</Text>
            </Pressable>
          </View>
          {confirmWipeSave ? (
            <View style={styles.wipeConfirmation}>
              <ThemedText style={styles.wipeConfirmationText}>
                This erases your party and run progress. Start over and choose a new starter?
              </ThemedText>
              <View style={styles.debugActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={battle.busy}
                  onPress={() => {
                    setConfirmWipeSave(false);
                    void battle.debugWipeSaveData();
                  }}
                  style={({ pressed }) => [
                    styles.debugButton,
                    styles.debugDangerButton,
                    battle.busy && styles.debugButtonDisabled,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.debugButtonText}>
                    {battle.busy ? 'Wiping…' : 'Confirm Wipe'}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={battle.busy}
                  onPress={() => setConfirmWipeSave(false)}
                  style={({ pressed }) => [
                    styles.debugButton,
                    styles.debugCancelButton,
                    battle.busy && styles.debugButtonDisabled,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.debugButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.moveHeader}>
          <View>
            <ThemedText style={styles.sectionTitle}>CHOOSE YOUR MOVE</ThemedText>
            <ThemedText style={styles.hint}>Tap to preview · Drag onto the grid</ThemedText>
          </View>
        </View>
        <View style={styles.moveGrid}>
          {playerPokemon.moves.map((move, index) => (
            <MoveCard
              key={`${move.name}-${index}`}
              move={move}
              pattern={battle.playerMovePatterns[index]}
              selected={battle.selectedMoveIndex === index}
              disabled={!battle.canBattle}
              onSelect={() => {
                battle.setSelectedMoveIndex(index);
                battle.setMessage(`${getMoveLabel(move.name)} selected. Drag it to the grid or tap a target cell.`);
              }}
              onDragStart={() => battle.setSelectedMoveIndex(index)}
              onDrop={(x, y) => dropMove(move, x, y)}
            />
          ))}
        </View>
        {activeMember.currentHp <= 0 ? (
          <ThemedText style={styles.faintedHint}>
            Your active Pokémon fainted. Switch to a healthy party member or use a Revive.
          </ThemedText>
        ) : null}
      </ScrollView>
      <Modal
        animationType="fade"
        transparent
        visible={activeEvolution !== undefined}
        onRequestClose={() => {
          if (activeEvolution) {
            void battle.deferEvolution(activeEvolution.slot, activeEvolution.pokemonId).catch(
              (error: unknown) =>
                setEvolutionError(
                  error instanceof Error ? error.message : 'The evolution choice could not be saved.'
                )
            );
          }
        }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.evolutionModal}>
            <Text style={styles.modalEyebrow}>LEVEL UP</Text>
            <Text style={styles.modalTitle}>Ready to evolve?</Text>
            <Text style={styles.modalDescription}>
              Choose an evolution now, or wait and evolve this Pokémon for free in the shop.
            </Text>
            {activeEvolution?.options.map((option, index) => {
              const query = evolutionPokemonQueries[index];
              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={savingEvolution || !query?.data}
                  key={option.pokemonId}
                  onPress={async () => {
                    if (!activeEvolution || !query?.data) return;
                    setSavingEvolution(true);
                    setEvolutionError(null);
                    try {
                      await battle.evolvePokemon(
                        activeEvolution.slot,
                        option.pokemonId,
                        getPlayerMaxHp(query.data.stats.hp),
                        option.minimumLevel,
                        'level-up'
                      );
                    } catch (error) {
                      setEvolutionError(
                        error instanceof Error
                          ? error.message
                          : 'The Pokémon could not evolve.'
                      );
                    } finally {
                      setSavingEvolution(false);
                    }
                  }}
                  style={[styles.evolutionOption, !query?.data && styles.disabledButton]}>
                  {query?.data ? (
                    <PokemonSprite pokemon={query.data} size={38} />
                  ) : null}
                  <Text style={styles.optionText}>
                    {query?.isPending
                      ? 'Loading evolution…'
                      : `Evolve into ${capitalize(option.name)}`}
                  </Text>
                </Pressable>
              );
            })}
            {evolutionPokemonQueries.some((query) => query.error) ? (
              <View style={styles.replacementError}>
                <Text style={styles.modalError}>Evolution data could not be loaded.</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    void Promise.all(
                      evolutionPokemonQueries.map((query) => query.refetch())
                    )
                  }
                  style={styles.retryNamesButton}>
                  <Text style={styles.retryNamesText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
            {evolutionError ? <Text style={styles.modalError}>{evolutionError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={savingEvolution}
              onPress={() => {
                if (!activeEvolution) return;
                setEvolutionError(null);
                void battle
                  .deferEvolution(activeEvolution.slot, activeEvolution.pokemonId)
                  .catch((error: unknown) =>
                    setEvolutionError(
                      error instanceof Error
                        ? error.message
                        : 'The evolution choice could not be saved.'
                    )
                  );
              }}
              style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>
                {savingEvolution ? 'SAVING…' : 'NOT NOW'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={profile.pendingMoveUnlocks.length > 0 && activeEvolution === undefined}
        onRequestClose={() => undefined}>
        <View style={styles.modalBackdrop}>
          <View style={styles.moveLearningModal}>
            {confirmMoveReplacement ? (
              <>
                <ThemedText style={styles.modalTitle}>Replace this move?</ThemedText>
                <ThemedText style={styles.modalDescription}>
                  Replacing {selectedReplacedMove ? getMoveLabel(selectedReplacedMove) : 'a move'}{' '}
                  with {selectedUnlockedMove ? getMoveLabel(selectedUnlockedMove) : 'a new move'} is
                  irreversible without purchasing it again in the shop. Are you sure?
                </ThemedText>
                <View style={styles.modalActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={savingMove}
                    onPress={() => setConfirmMoveReplacement(false)}
                    style={styles.secondaryButton}>
                    <ThemedText style={styles.secondaryButtonText}>Go back</ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={savingMove || !selectedUnlock || !selectedUnlockedMove}
                    onPress={async () => {
                      if (!selectedUnlock || !selectedUnlockedMove || !selectedReplacedMove) return;
                      setSavingMove(true);
                      setMoveLearningError(null);
                      try {
                        await battle.learnMove(
                          selectedUnlock.slot,
                          selectedUnlockedMove,
                          selectedReplacedMove,
                          'level-up'
                        );
                        setConfirmMoveReplacement(false);
                        setSelectedUnlockedMove(null);
                        setSelectedReplacedMove(null);
                      } catch (error) {
                        setMoveLearningError(
                          error instanceof Error ? error.message : 'The move could not be learned.'
                        );
                      } finally {
                        setSavingMove(false);
                      }
                    }}
                    style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>
                      {savingMove ? 'SAVING…' : 'YES, REPLACE IT'}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <ThemedText style={styles.modalEyebrow}>LEVEL UP</ThemedText>
                <ThemedText style={styles.modalTitle}>New moves unlocked!</ThemedText>
                <ThemedText style={styles.modalDescription}>
                  Select an unlocked move to learn it. Skipped moves can be learned later in the shop.
                </ThemedText>
                {profile.pendingMoveUnlocks.length > 1 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.unlockMemberChoices}>
                      {profile.pendingMoveUnlocks.map((unlock) => {
                        const member = profile.party.find(
                          (candidate) => candidate.slot === unlock.slot
                        );
                        const memberIndex = profile.party.findIndex(
                          (candidate) => candidate.slot === unlock.slot
                        );
                        const memberPokemon = partyPokemonQueries[memberIndex]?.data;
                        return (
                          <Pressable
                            accessibilityRole="button"
                            key={unlock.slot}
                            onPress={() => {
                              setSelectedUnlockSlot(unlock.slot);
                              setSelectedUnlockedMove(null);
                              setSelectedReplacedMove(null);
                              setMoveLearningError(null);
                            }}
                            style={[
                              styles.unlockMemberChoice,
                              selectedUnlock?.slot === unlock.slot && styles.selectedOption,
                            ]}>
                            {member ? (
                              <PokemonSprite
                                pokemon={memberPokemon ?? { id: member.pokemonId, spriteUrl: null }}
                                size={30}
                              />
                            ) : null}
                            <ThemedText numberOfLines={1} style={styles.optionText}>
                              {memberPokemon ? capitalize(memberPokemon.name) : 'Loading Pokémon…'}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                ) : null}
                <ThemedText style={styles.modalSectionTitle}>CURRENT MOVES</ThemedText>
                <View style={styles.unlockOptions}>
                  {unlockMember?.moves.map((move) => (
                    <Pressable
                      accessibilityRole="button"
                      key={move}
                      disabled={unlockMember.moves.length < 4}
                      onPress={() => setSelectedReplacedMove(move)}
                      style={[
                        styles.moveOption,
                        selectedReplacedMove === move && styles.selectedOption,
                        unlockMember.moves.length < 4 && styles.unselectableOption,
                      ]}>
                      <ThemedText style={styles.optionText}>{getMoveLabel(move)}</ThemedText>
                    </Pressable>
                  ))}
                  {unlockMember && unlockMember.moves.length < 4 ? (
                    <ThemedText style={styles.emptySlotHint}>
                      Empty slot available — the next move you learn will fill it.
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText style={styles.modalSectionTitle}>NEWLY UNLOCKED</ThemedText>
                <ScrollView style={styles.unlockedMovesList} showsVerticalScrollIndicator>
                  <View style={styles.unlockOptions}>
                    {selectedUnlock?.moves.map((move) => (
                      <View
                        key={move}
                        style={[
                          styles.moveOption,
                          selectedUnlockedMove === move && styles.selectedOption,
                        ]}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            setSelectedUnlockedMove(move);
                            setMoveLearningError(null);
                          }}
                          style={styles.moveOptionSelect}>
                          <ThemedText style={styles.optionText}>{getMoveLabel(move)}</ThemedText>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          hitSlop={8}
                          onPress={() => {
                            if (!selectedUnlock) return;
                            if (selectedUnlockedMove === move) setSelectedUnlockedMove(null);
                            void battle.skipMoveUnlock(selectedUnlock.slot, move).catch((error: unknown) =>
                              setMoveLearningError(
                                error instanceof Error ? error.message : 'The move could not be skipped.'
                              )
                            );
                          }}>
                          <ThemedText style={styles.skipButtonText}>Skip</ThemedText>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </ScrollView>
                {moveLearningError ? (
                  <ThemedText style={styles.modalError}>{moveLearningError}</ThemedText>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={
                    savingMove ||
                    !selectedUnlock ||
                    !unlockMember ||
                    !selectedUnlockedMove ||
                    (unlockMember.moves.length >= 4 && !selectedReplacedMove)
                  }
                  onPress={async () => {
                    if (!selectedUnlock || !unlockMember || !selectedUnlockedMove) return;
                    if (unlockMember.moves.length >= 4) {
                      setConfirmMoveReplacement(true);
                      return;
                    }
                    setSavingMove(true);
                    setMoveLearningError(null);
                    try {
                      await battle.learnMove(
                        selectedUnlock.slot,
                        selectedUnlockedMove,
                        null,
                        'level-up'
                      );
                      setSelectedUnlockedMove(null);
                    } catch (error) {
                      setMoveLearningError(
                        error instanceof Error ? error.message : 'The move could not be learned.'
                      );
                    } finally {
                      setSavingMove(false);
                    }
                  }}
                  style={[
                    styles.learnMoveButton,
                    (!selectedUnlockedMove ||
                      (unlockMember?.moves.length === 4 && !selectedReplacedMove)) &&
                      styles.disabledButton,
                  ]}>
                  <Text style={styles.primaryButtonText}>
                    {savingMove
                      ? 'SAVING…'
                      : selectedUnlockedMove && unlockMember?.moves.length === 4
                        ? selectedReplacedMove
                          ? `REPLACE ${getMoveLabel(selectedReplacedMove).toUpperCase()} WITH ${getMoveLabel(selectedUnlockedMove).toUpperCase()}`
                          : 'SELECT A CURRENT MOVE TO REPLACE'
                        : selectedUnlockedMove
                          ? `LEARN ${getMoveLabel(selectedUnlockedMove).toUpperCase()}`
                          : 'SELECT A NEW MOVE'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
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
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: '#b86d51',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  turnPill: {
    borderRadius: 18,
    backgroundColor: '#25394a',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  turnText: {
    color: '#fffaf0',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  progressCard: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    gap: 7,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressArea: {
    color: '#39424a',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  progressEncounter: {
    color: '#a44f35',
    fontSize: 11,
    fontWeight: '900',
  },
  progressTrack: {
    height: 8,
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: '#e9e9e3',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: '#57a76f',
  },
  progressHint: {
    color: '#77736b',
    fontSize: 10,
    fontWeight: '700',
  },
  arena: {
    position: 'relative',
    minHeight: 136,
    padding: 10,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#e8e1d2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  fighter: {
    width: '39%',
    minWidth: 0,
    alignItems: 'center',
  },
  playerSprite: {
    width: 96,
    height: 88,
    borderRadius: 20,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bossSprite: {
    width: 96,
    height: 88,
    borderRadius: 20,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fighterName: {
    marginTop: 5,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'capitalize',
    maxWidth: '100%',
  },
  fighterType: {
    color: '#716d65',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  levelText: {
    color: '#8a513d',
    fontSize: 10,
    fontWeight: '900',
  },
  versus: {
    color: '#b85a42',
    fontSize: 15,
    fontWeight: '900',
  },
  playerHealthCard: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  healthLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  healthName: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  healthValue: {
    color: '#58605c',
    fontSize: 12,
    fontWeight: '800',
  },
  healthTrack: {
    height: 9,
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: '#e9e9e3',
  },
  healthFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: '#57a76f',
  },
  bossCard: {
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#39424a',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  hint: {
    marginTop: 3,
    color: '#77736b',
    fontSize: 11,
  },
  blocksPill: {
    borderRadius: 12,
    backgroundColor: '#f8eadc',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  blocksPillText: {
    color: '#a44f35',
    fontSize: 9,
    fontWeight: '900',
  },
  grid: {
    gap: 4,
    width: '100%',
    padding: 4,
    borderRadius: 13,
    backgroundColor: '#f1eee8',
  },
  gridStage: {
    position: 'relative',
  },
  gridContinueOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 250, 240, 0.78)',
  },
  gridContinueButton: {
    width: '100%',
    maxWidth: 280,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 4,
  },
  gridCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCellActive: {
    backgroundColor: '#d66b4a',
  },
  gridCellCleared: {
    backgroundColor: '#e5eee2',
  },
  gridCellVoid: {
    backgroundColor: 'rgba(229, 238, 226, 0.35)',
  },
  gridCellStatusIcon: {
    width: '64%',
    height: '64%',
  },
  gridCellBall: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e65d43',
  },
  cellDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#f5c3a9',
  },
  emptyDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#bfd3b7',
  },
  ballGlyph: {
    color: '#e34836',
    fontSize: 22,
    fontWeight: '900',
  },
  gridHint: {
    color: '#6f6a61',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  messageCard: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: '#e8efe2',
  },
  errorCard: {
    backgroundColor: '#ffe5df',
  },
  messageText: {
    color: '#3e5b40',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  moveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 74,
  },
  primaryButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#e65d43',
  },
  disabledButton: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  pressed: {
    opacity: 0.8,
  },
  faintedHint: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#ffe5df',
    color: '#9e4439',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  debugCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5c7a6',
    backgroundColor: '#fff8ed',
    gap: 10,
  },
  replacementCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#fff8ed',
    borderWidth: 1,
    borderColor: '#e5c7a6',
    gap: 9,
  },
  replacementHint: {
    color: '#716d65',
    fontSize: 12,
    lineHeight: 17,
  },
  replacementError: {
    gap: 6,
  },
  retryNamesButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#6f655e',
  },
  retryNamesText: {
    color: '#fffaf0',
    fontSize: 11,
    fontWeight: '800',
  },
  replacementButton: {
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: '#8a513d',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  replacementButtonText: {
    color: '#fffaf0',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  debugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  debugActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wipeConfirmation: {
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#fbe5df',
  },
  wipeConfirmationText: {
    color: '#713528',
    fontSize: 13,
    fontWeight: '700',
  },
  debugButton: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: '#8a513d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  debugButtonDisabled: {
    opacity: 0.45,
  },
  debugDangerButton: {
    backgroundColor: '#a43b32',
  },
  debugCancelButton: {
    backgroundColor: '#6f655e',
  },
  debugButtonText: {
    color: '#fffaf0',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 18,
    backgroundColor: 'rgba(27, 38, 46, 0.72)',
  },
  moveLearningModal: {
    maxHeight: '90%',
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#fffaf2',
    gap: 10,
  },
  evolutionModal: {
    maxHeight: '90%',
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#fffaf2',
    gap: 10,
  },
  evolutionOption: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8dfd2',
    backgroundColor: '#ffffff',
  },
  modalEyebrow: {
    color: '#b86d51',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  modalTitle: {
    color: '#25394a',
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '900',
  },
  modalDescription: {
    color: '#6f6a61',
    fontSize: 12,
    lineHeight: 18,
  },
  modalSectionTitle: {
    color: '#39424a',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 4,
  },
  unlockMemberChoices: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  unlockMemberChoice: {
    maxWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f1eee8',
  },
  unlockOptions: {
    gap: 6,
  },
  moveOption: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#e8dfd2',
    backgroundColor: '#ffffff',
  },
  moveOptionSelect: {
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  selectedOption: {
    borderColor: '#e65d43',
    backgroundColor: '#fff0e8',
  },
  unselectableOption: {
    opacity: 0.75,
  },
  optionText: {
    color: '#39424a',
    fontSize: 12,
    fontWeight: '800',
  },
  skipButtonText: {
    color: '#a4523e',
    fontSize: 11,
    fontWeight: '900',
  },
  emptySlotHint: {
    color: '#77736b',
    fontSize: 11,
    fontStyle: 'italic',
  },
  unlockedMovesList: {
    maxHeight: 170,
  },
  modalError: {
    color: '#a13a39',
    fontSize: 12,
    fontWeight: '700',
  },
  learnMoveButton: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#e65d43',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#e8dfd2',
  },
  secondaryButtonText: {
    color: '#39424a',
    fontSize: 12,
    fontWeight: '900',
  },
});
