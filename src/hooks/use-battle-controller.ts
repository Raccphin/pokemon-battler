import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  calculateCatchResult,
  getBallDetails,
  getBossAttack,
  getBossGridDimensions,
  getMoveLabel,
  getPatternCells,
  getPlayerMaxHp,
} from '@/services/battle-rules';
import { rumble } from '@/services/haptics';
import { fetchPokemon } from '@/services/pokeapi';
import { usePlayer } from '@/providers/player-provider';
import type { BallType, PokemonMove } from '@/types/game';

const sleep = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));

function randomCells(count: number, total: number): number[] {
  const cells = new Set<number>();
  while (cells.size < Math.min(count, total)) {
    cells.add(Math.floor(Math.random() * total));
  }
  return [...cells];
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function useBattleController() {
  const {
    state,
    operationError,
    clearOperationError,
    retry,
    updateOpponentCells,
    damageActivePokemon,
    resolveCatch,
    resetEncounter,
  } = usePlayer();
  const profile = state.status === 'ready' ? state.profile : null;
  const activeMember = profile?.party.find((member) => member.slot === profile.activeSlot);
  const activePokemonId = activeMember?.pokemonId;
  const bossId = profile?.opponentId;

  const playerQuery = useQuery({
    queryKey: ['pokemon', activePokemonId],
    queryFn: () => {
      if (!activePokemonId) throw new Error('No active Pokémon is selected.');
      return fetchPokemon(activePokemonId);
    },
    enabled: activePokemonId !== undefined,
  });
  const bossQuery = useQuery({
    queryKey: ['pokemon', bossId],
    queryFn: () => {
      if (!bossId) throw new Error('No raid boss is selected.');
      return fetchPokemon(bossId);
    },
    enabled: bossId !== undefined,
  });
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Choose a move to view its attack pattern.');
  const [catchAnimation, setCatchAnimation] = useState<{ positions: number[] } | null>(null);
  const playerPokemon = playerQuery.data;
  const bossPokemon = bossQuery.data;
  const dimensions = bossPokemon ? getBossGridDimensions(bossPokemon) : null;
  const totalCells = dimensions ? dimensions.rows * dimensions.columns : 0;
  const savedCells = profile?.opponentCells ?? [];

  useEffect(() => {
    if (
      profile &&
      dimensions &&
      savedCells.length !== totalCells &&
      !profile.encounterComplete
    ) {
      void updateOpponentCells(Array.from({ length: totalCells }, () => true)).catch(
        () => undefined
      );
    }
  }, [dimensions, profile, savedCells.length, totalCells, updateOpponentCells]);

  const cells =
    profile && dimensions
      ? profile.opponentCells.length === totalCells
        ? profile.opponentCells
        : Array.from({ length: totalCells }, () => true)
      : [];
  const selectedMove: PokemonMove | undefined =
    playerPokemon?.moves[selectedMoveIndex ?? -1];
  const remoteLoading = playerQuery.isPending || bossQuery.isPending;
  const remoteError = playerQuery.error ?? bossQuery.error;
  const remoteReady = Boolean(playerPokemon && bossPokemon && dimensions);
  const bossRemaining = cells.filter(Boolean).length;
  const bossDefeated = Boolean(profile?.encounterComplete && bossRemaining === 0);
  const bossCaught = Boolean(profile?.encounterComplete && bossRemaining > 0);
  const currentHp = activeMember?.currentHp ?? 0;
  const canBattle = Boolean(
    !busy &&
      profile &&
      dimensions &&
      !profile.encounterComplete &&
      currentHp > 0 &&
      bossRemaining > 0 &&
      cells.length === totalCells
  );
  async function performMove(move: PokemonMove, row: number, column: number) {
    if (!canBattle || !dimensions || !profile || !bossPokemon) return;
    const hitCells = getPatternCells(row, column, move.patternSize, dimensions);
    const hitAnything = hitCells.some((index) => cells[index]);
    if (!hitAnything) {
      setMessage('That part of the grid is already clear.');
      return;
    }

    setBusy(true);
    clearOperationError();
    const nextCells = cells.map((cell, index) => (hitCells.includes(index) ? false : cell));
    const defeated = nextCells.every((cell) => !cell);
    try {
      await updateOpponentCells(nextCells, defeated);
      rumble();
      if (defeated) {
        setMessage(`${capitalize(bossPokemon.name)} fainted! The raid is complete.`);
      } else {
        const counterattack = getBossAttack(bossPokemon, round);
        await damageActivePokemon(counterattack.damage);
        rumble();
        setRound((turn) => turn + 1);
        setMessage(
          `${getMoveLabel(move.name)} cleared ${hitCells.filter((index) => cells[index]).length} block(s). ` +
            `${capitalize(bossPokemon.name)} used ${getMoveLabel(counterattack.move.name)} for ${counterattack.damage} damage.`
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The attack could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCatch(ball: BallType) {
    if (!profile || !bossPokemon || busy || profile.encounterComplete || !cells.some(Boolean)) {
      return;
    }
    if (cells.every(Boolean)) {
      setMessage('Clear at least one boss-grid block before throwing a ball.');
      return;
    }
    if (profile.party.length >= 6) {
      setMessage('Your party is full. Make room before trying to catch this Pokémon.');
      return;
    }
    const ballDetails = getBallDetails(ball);
    const result = calculateCatchResult(
      bossPokemon.captureRate,
      bossRemaining,
      totalCells,
      ballDetails.multiplier,
      Math.random()
    );
    const emptyCells = cells
      .map((cell, index) => (!cell ? index : -1))
      .filter((index) => index >= 0);
    const occupiedCells = cells
      .map((cell, index) => (cell ? index : -1))
      .filter((index) => index >= 0);
    const landingCell = result.success
      ? emptyCells[Math.floor(Math.random() * emptyCells.length)]
      : occupiedCells[Math.floor(Math.random() * occupiedCells.length)];
    if (landingCell === undefined) {
      setMessage('No grid cell is available for the catch animation.');
      return;
    }

    setBusy(true);
    clearOperationError();
    try {
      await resolveCatch(
        ball,
        result.success,
        bossPokemon.id,
        getPlayerMaxHp(bossPokemon.stats.hp)
      );
      setCatchAnimation({ positions: randomCells(ballDetails.count, totalCells) });
      setMessage(`${ballDetails.label} is wobbling…`);
      for (let wobble = 1; wobble <= 3; wobble += 1) {
        await sleep(650);
        rumble();
        setCatchAnimation({
          positions:
            wobble === 3 ? [landingCell] : randomCells(ballDetails.count, totalCells),
        });
      }
      setMessage(
        result.success
          ? `${capitalize(bossPokemon.name)} was caught and added to your party!`
          : `${capitalize(bossPokemon.name)} broke free. Try again after clearing more blocks.`
      );
      await sleep(500);
      setCatchAnimation(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The catch attempt could not be saved.');
      setCatchAnimation(null);
    } finally {
      setBusy(false);
    }
  }

  async function startNewEncounter() {
    try {
      setBusy(true);
      await resetEncounter();
      setMessage('A new raid encounter is ready.');
      setRound(0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The encounter could not be reset.');
    } finally {
      setBusy(false);
    }
  }

  function retryRemote() {
    void Promise.all([
      playerQuery.refetch(),
      bossQuery.refetch(),
    ]);
  }

  function handleGridCell(row: number, column: number) {
    if (!selectedMove) {
      setMessage('Choose one of your moves first.');
      return;
    }
    void performMove(selectedMove, row, column);
  }

  return {
    state,
    profile,
    activeMember,
    playerPokemon,
    bossPokemon,
    dimensions,
    totalCells,
    cells,
    bossRemaining,
    bossDefeated,
    bossCaught,
    currentHp,
    canBattle,
    selectedMoveIndex,
    selectedMove,
    busy,
    message,
    operationError,
    catchAnimation,
    remoteLoading,
    remoteError,
    remoteReady,
    retry,
    retryRemote,
    clearOperationError,
    setSelectedMoveIndex,
    setMessage,
    attackMove: performMove,
    handleCatch,
    startNewEncounter,
    handleGridCell,
  };
}
