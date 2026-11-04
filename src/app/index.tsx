import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MoveCard } from '@/components/battle/move-card';
import { PokemonSprite } from '@/components/pokemon-sprite';
import { ScreenState } from '@/components/screen-state';
import { ThemedText } from '@/components/themed-text';
import { useBattleController } from '@/hooks/use-battle-controller';
import { getMoveLabel } from '@/services/battle-rules';
import type { PokemonMove } from '@/types/game';
import { router, useLocalSearchParams } from 'expo-router';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function BattleScreen() {
  const gridRef = useRef<React.ElementRef<typeof View>>(null);
  const battle = useBattleController();
  const { throwBall } = useLocalSearchParams<{ throwBall?: string | string[] }>();
  const handledThrow = useRef<string | null>(null);

  useEffect(() => {
    const ball = Array.isArray(throwBall) ? throwBall[0] : throwBall;
    if (!ball) {
      handledThrow.current = null;
      return;
    }
    if (ball !== 'pokeBall' && ball !== 'greatBall' && ball !== 'ultraBall') {
      handledThrow.current = ball;
      battle.setMessage('That Poké Ball is not available.');
      router.replace('/');
      return;
    }
    if (!battle.remoteReady || battle.state.status !== 'ready' || handledThrow.current === ball) {
      return;
    }

    handledThrow.current = ball;
    void battle.handleCatch(ball);
    router.replace('/');
  }, [battle, throwBall]);

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
        message={battle.state.message}
        onRetry={battle.retry}
      />
    );
  }
  const profile = battle.state.profile;
  const activeMember = profile.party.find((member) => member.slot === profile.activeSlot);
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

        <View style={styles.arena}>
          <View style={styles.fighter}>
            <View style={styles.playerSprite}>
              <PokemonSprite pokemon={playerPokemon} />
            </View>
            <ThemedText numberOfLines={1} style={styles.fighterName}>
              {capitalize(playerPokemon.name)}
            </ThemedText>
            <ThemedText style={styles.fighterType}>{playerPokemon.types.join(' · ')}</ThemedText>
          </View>
          <Text style={styles.versus}>VS</Text>
          <View style={styles.fighter}>
            <View style={styles.bossSprite}>
              <PokemonSprite pokemon={bossPokemon} mirrored />
            </View>
            <ThemedText numberOfLines={1} style={styles.fighterName}>
              {capitalize(bossPokemon.name)}
            </ThemedText>
            <ThemedText style={styles.fighterType}>RAID BOSS</ThemedText>
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
              <ThemedText style={styles.sectionTitle}>BOSS VITALS</ThemedText>
              <ThemedText style={styles.hint}>
                {battle.bossRemaining} of {battle.totalCells} blocks remain
              </ThemedText>
            </View>
            <View style={styles.blocksPill}>
              <Text style={styles.blocksPillText}>GRID HEALTH</Text>
            </View>
          </View>
          <View ref={gridRef} collapsable={false} style={styles.grid}>
            {Array.from({ length: dimensions.rows }, (_, row) => (
              <View key={`row-${row}`} style={styles.gridRow}>
                {Array.from({ length: dimensions.columns }, (_, column) => {
                  const index = row * dimensions.columns + column;
                  const active = battle.cells[index];
                  const ball = battle.catchAnimation?.positions.includes(index) ?? false;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Boss grid row ${row + 1}, column ${column + 1}, ${active ? 'occupied' : 'cleared'}`}
                      disabled={battle.busy || !battle.canBattle || !battle.selectedMove}
                      key={index}
                      onPress={() => battle.handleGridCell(row, column)}
                      style={[
                        styles.gridCell,
                        active ? styles.gridCellActive : styles.gridCellCleared,
                        ball && styles.gridCellBall,
                      ]}>
                      {ball ? (
                        <Text style={styles.ballGlyph}>●</Text>
                      ) : active ? (
                        <View style={styles.cellDot} />
                      ) : (
                        <View style={styles.emptyDot} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <ThemedText style={styles.gridHint}>
            {battle.catchAnimation
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

        {profile.encounterComplete ? (
          <Pressable
            accessibilityRole="button"
            disabled={battle.busy}
            onPress={() => void battle.startNewEncounter()}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>RAID AGAIN</Text>
          </Pressable>
        ) : null}

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
  arena: {
    minHeight: 136,
    padding: 10,
    borderRadius: 20,
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
    backgroundColor: '#d8e6d5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bossSprite: {
    width: 96,
    height: 88,
    borderRadius: 20,
    backgroundColor: '#f0d7c9',
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
});
