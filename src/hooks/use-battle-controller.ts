import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  AREA_PROGRESSION_CONFIG,
  chooseRandom,
  getAreaById,
  getNextEncounterProgress,
  getRandomArea,
} from '@/services/area-progression';
import {
  calculateCatchResult,
  applyMovePattern,
  doesMoveHit,
  getBallDetails,
  getBossAttack,
  getBossGridDimensions,
  getMoveLabel,
  getPatternCells,
  getPlayerMaxHp,
  resolveStatusTurn,
} from '@/services/battle-rules';
import { rumble } from '@/services/haptics';
import {
  fetchPokemon,
  fetchPokemonClassification,
  fetchPokemonIdsForTypes,
} from '@/services/pokeapi';
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
  const queryClient = useQueryClient();
  const {
    state,
    selectedMoveIndex,
    setSelectedMoveIndex,
    operationError,
    clearOperationError,
    retry,
    updateOpponentGrid,
    damageActivePokemon,
    resolveCatch,
    replacePartyMemberWithCatch,
    advanceEncounter,
    debugAdvanceToBoss,
    debugHealParty,
    debugWipeSaveData: resetSaveData,
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
  const area = profile ? getAreaById(profile.areaId) : null;
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Choose a move to view its attack pattern.');
  const [catchAnimation, setCatchAnimation] = useState<{ positions: number[] } | null>(null);
  const playerPokemon = playerQuery.data;
  const bossPokemon = bossQuery.data;
  const dimensions = bossPokemon
    ? getBossGridDimensions(bossPokemon, profile?.opponentIsAreaBoss)
    : null;
  const totalCells = dimensions ? dimensions.rows * dimensions.columns : 0;
  const savedCells = profile?.opponentCells ?? [];
  const savedStatuses = profile?.opponentStatuses ?? [];
  const savedStatusFresh = profile?.opponentStatusFresh ?? [];

  useEffect(() => {
    if (
      profile &&
      dimensions &&
      (savedCells.length !== totalCells ||
        savedStatuses.length !== totalCells ||
        savedStatusFresh.length !== totalCells) &&
      !profile.encounterComplete
    ) {
      void updateOpponentGrid(
        Array.from({ length: totalCells }, () => true),
        Array.from({ length: totalCells }, () => null),
        Array.from({ length: totalCells }, () => false)
      ).catch((error: unknown) => {
        setMessage(
          error instanceof Error ? error.message : 'The boss grid could not be initialized.'
        );
      });
    }
  }, [
    dimensions,
    profile,
    savedCells.length,
    savedStatuses.length,
    savedStatusFresh.length,
    totalCells,
    updateOpponentGrid,
  ]);

  const cells =
    profile && dimensions
      ? profile.opponentCells.length === totalCells
        ? profile.opponentCells
        : Array.from({ length: totalCells }, () => true)
      : [];
  const statuses =
    profile && dimensions
      ? profile.opponentStatuses.length === totalCells
        ? profile.opponentStatuses
        : Array.from({ length: totalCells }, () => null)
      : [];
  const statusFresh =
    profile && dimensions
      ? profile.opponentStatusFresh.length === totalCells
        ? profile.opponentStatusFresh
        : Array.from({ length: totalCells }, () => false)
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
      profile.runStatus === 'active' &&
      !profile.encounterComplete &&
      !profile.pendingCatch &&
      currentHp > 0 &&
      bossRemaining > 0 &&
      cells.length === totalCells &&
      statuses.length === totalCells &&
      statusFresh.length === totalCells
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
    try {
      const moveHits = doesMoveHit(move);
      const attackedGrid = moveHits
        ? applyMovePattern(cells, statuses, statusFresh, hitCells, move)
        : { cells, statuses, statusFresh };
      const statusTurn = attackedGrid.cells.some(Boolean)
        ? resolveStatusTurn(
            attackedGrid.cells,
            attackedGrid.statuses,
            dimensions,
            attackedGrid.statusFresh
          )
        : {
            cells: attackedGrid.cells,
            statuses: attackedGrid.statuses,
            statusFresh: attackedGrid.statusFresh,
            opponentSkipped: false,
          };
      const nextCells = statusTurn.cells;
      const defeated = nextCells.every((cell) => !cell);
      const clearedByStatuses =
        attackedGrid.cells.filter(Boolean).length - nextCells.filter(Boolean).length;
      const clearedByMove =
        cells.filter(Boolean).length - attackedGrid.cells.filter(Boolean).length;
      const moveMessage = moveHits
        ? `${getMoveLabel(move.name)} cleared ${clearedByMove} block(s).`
        : `${getMoveLabel(move.name)} missed.`;
      await updateOpponentGrid(
        nextCells,
        statusTurn.statuses,
        statusTurn.statusFresh,
        defeated
      );
      rumble();
      if (defeated) {
        setMessage(`${capitalize(bossPokemon.name)} fainted! The raid is complete.`);
      } else if (statusTurn.opponentSkipped) {
        setRound((turn) => turn + 1);
        const statusTiles = statusTurn.statuses.filter(
          (status, index) =>
            statusTurn.cells[index] &&
            (status === 'freeze' || status === 'paralysis' || status === 'sleep')
        ).length;
        const statusMessage =
          clearedByStatuses > 0
            ? ` ${clearedByStatuses} additional block(s) were cleared by status effects.`
            : '';
        setMessage(
          `${moveMessage}${statusMessage} ${capitalize(bossPokemon.name)} skipped its turn because of ${statusTiles} stalling status tile(s).`
        );
      } else {
        const counterattack = getBossAttack(bossPokemon, round, profile.opponentIsAreaBoss);
        await damageActivePokemon(counterattack.damage);
        rumble();
        setRound((turn) => turn + 1);
        setMessage(
          `${moveMessage} ` +
            `${clearedByStatuses > 0 ? `${clearedByStatuses} additional block(s) were cleared by status effects. ` : ''}` +
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
          ? profile.party.length >= 6
            ? `${capitalize(bossPokemon.name)} was caught. Choose a teammate to release and make room.`
            : `${capitalize(bossPokemon.name)} was caught and added to your party!`
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

  async function replacePartyMember(slot: number) {
    try {
      await replacePartyMemberWithCatch(slot);
      setMessage('Your new Pokémon joined the party.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The party could not be updated.');
    }
  }

  async function startNewEncounter(fromShop = false): Promise<boolean> {
    if (!profile || !area || !profile.encounterComplete) return false;
    try {
      setBusy(true);
      const areaChanges =
        profile.encounterIndex + 1 >= AREA_PROGRESSION_CONFIG.encountersPerArea;
      const nextArea = areaChanges ? getRandomArea() : area;
      const next = getNextEncounterProgress(profile, nextArea.id);
      const { opponentId, specialBossId } = next.isAreaBoss
        ? await chooseAreaBoss(nextArea.id, profile.usedSpecialBossIds)
        : {
            opponentId: chooseRandom(
              (await loadAreaPool(nextArea.id)).filter(
                (id) => !profile.usedSpecialBossIds.includes(id)
              )
            ),
            specialBossId: undefined,
          };
      if (opponentId === undefined) {
        throw new Error(`No eligible Pokémon were found for the ${nextArea.name}.`);
      }
      await advanceEncounter(opponentId, next.isAreaBoss, nextArea.id, specialBossId, fromShop);
      setMessage(
        `${nextArea.name} · Encounter ${next.encounterIndex + 1} of ${AREA_PROGRESSION_CONFIG.encountersPerArea}.`
      );
      setRound(0);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The next encounter could not be loaded.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function loadAreaPool(areaId: string): Promise<number[]> {
    const encounterArea = getAreaById(areaId);
    return queryClient.fetchQuery({
      queryKey: ['area-encounter-pool', encounterArea.id],
      queryFn: () => fetchPokemonIdsForTypes(encounterArea.favoredTypes),
    });
  }

  async function chooseAreaBoss(
    areaId: string,
    usedSpecialBossIds: number[]
  ): Promise<{ opponentId: number | undefined; specialBossId: number | undefined }> {
    const bossArea = getAreaById(areaId);
    if (Math.random() < AREA_PROGRESSION_CONFIG.specialBossChance) {
      const classifications = await Promise.all(
        bossArea.specialBossCandidateIds.map((id) =>
          queryClient.fetchQuery({
            queryKey: ['pokemon-classification', id],
            queryFn: () => fetchPokemonClassification(id),
          })
        )
      );
      const candidates = classifications.filter(
        (pokemon) =>
          (pokemon.isLegendary || pokemon.isMythical) &&
          !usedSpecialBossIds.includes(pokemon.id) &&
          pokemon.types.some((type) => bossArea.favoredTypes.includes(type))
      );
      const specialBossId = chooseRandom(candidates)?.id;
      if (specialBossId !== undefined) {
        return { opponentId: specialBossId, specialBossId };
      }
    }

    const regularBossId = chooseRandom(
      (await loadAreaPool(bossArea.id)).filter((id) => !usedSpecialBossIds.includes(id))
    );
    return { opponentId: regularBossId, specialBossId: undefined };
  }

  async function debugDefeatCurrent() {
    if (!profile || !totalCells || busy || profile.encounterComplete) return;
    try {
      setBusy(true);
      clearOperationError();
      await updateOpponentGrid(
        Array.from({ length: totalCells }, () => false),
        Array.from({ length: totalCells }, () => null),
        Array.from({ length: totalCells }, () => false),
        true
      );
      setMessage(`${capitalize(bossPokemon?.name ?? 'Opponent')} was defeated (debug).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The opponent could not be defeated.');
    } finally {
      setBusy(false);
    }
  }

  async function debugGoToAreaBoss() {
    if (!profile || !area || busy || profile.opponentIsAreaBoss) return;
    try {
      setBusy(true);
      clearOperationError();
      const { opponentId, specialBossId } = await chooseAreaBoss(
        area.id,
        profile.usedSpecialBossIds
      );
      if (opponentId === undefined) {
        throw new Error(`No eligible boss Pokémon were found for the ${area.name}.`);
      }
      await debugAdvanceToBoss(opponentId, specialBossId);
      setRound(0);
      setMessage(`Skipped to the ${area.name} area boss (debug).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load the area boss.');
    } finally {
      setBusy(false);
    }
  }

  async function debugHealEntireParty() {
    if (busy) return;
    try {
      setBusy(true);
      clearOperationError();
      await debugHealParty();
      setMessage('The entire party was revived and fully healed (debug).');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The party could not be healed.');
    } finally {
      setBusy(false);
    }
  }

  async function debugWipeSaveData() {
    if (busy) return;
    try {
      setBusy(true);
      clearOperationError();
      await resetSaveData();
      setMessage('Save data wiped. Choose a new starter to begin.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save data could not be wiped.');
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
    area,
    totalCells,
    cells,
    statuses,
    statusFresh,
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
    replacePartyMember,
    startNewEncounter,
    debugDefeatCurrent,
    debugGoToAreaBoss,
    debugHealEntireParty,
    debugWipeSaveData,
    handleGridCell,
  };
}
