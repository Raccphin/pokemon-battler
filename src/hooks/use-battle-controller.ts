import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

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
  getPlayerMaxHp,
  resolveStatusTurn,
} from '@/services/battle-rules';
import { getMovePattern, getPatternCells } from '@/services/move-patterns';
import { rumble } from '@/services/haptics';
import {
  fetchPokemon,
  fetchPokemonClassification,
  fetchPokemonIdsForTypes,
  fetchPokemonLevelUpMoves,
} from '@/services/pokeapi';
import { chooseOpponentMoveNames, getInitialMoveNames } from '@/services/move-learning';
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
    operationError,
    clearOperationError,
    retry,
    updateOpponentGrid,
    damageActivePokemon,
    resolveCatch,
    advanceEncounter,
    debugAdvanceToBoss,
    debugHealParty,
    debugWipeSaveData: resetSaveData,
    initializePartyMoves,
    initializeOpponentMoves,
    learnMove,
    skipMoveUnlock,
  } = usePlayer();
  const profile = state.status === 'ready' ? state.profile : null;
  const activeMember = profile?.party.find((member) => member.slot === profile.activeSlot);
  const activePokemonId = activeMember?.pokemonId;
  const bossId = profile?.opponentId;

  const playerQuery = useQuery({
    queryKey: ['pokemon', activePokemonId, activeMember?.moves],
    queryFn: () => {
      if (!activePokemonId) throw new Error('No active Pokémon is selected.');
      return fetchPokemon(activePokemonId, activeMember?.moves ?? []);
    },
    enabled: activePokemonId !== undefined && Boolean(activeMember?.movesInitialized),
  });
  const bossQuery = useQuery({
    queryKey: ['pokemon', bossId, profile?.opponentMoves],
    queryFn: () => {
      if (!bossId) throw new Error('No raid boss is selected.');
      return fetchPokemon(bossId, profile?.opponentMoves ?? []);
    },
    enabled: bossId !== undefined && Boolean(profile?.opponentMovesInitialized),
  });
  const playerLearnsetQuery = useQuery({
    queryKey: ['pokemon-level-up-moves', activePokemonId, activeMember?.level],
    queryFn: () => {
      if (!activePokemonId || !activeMember) throw new Error('No active Pokémon is selected.');
      return fetchPokemonLevelUpMoves(activePokemonId, activeMember.level);
    },
    enabled: activePokemonId !== undefined && !activeMember?.movesInitialized,
  });
  const bossLearnsetQuery = useQuery({
    queryKey: ['pokemon-level-up-moves', bossId, profile?.opponentLevel],
    queryFn: () => {
      if (!bossId || !profile) throw new Error('No raid boss is selected.');
      return fetchPokemonLevelUpMoves(bossId, profile.opponentLevel);
    },
    enabled: bossId !== undefined,
  });
  const initializingOpponent = useRef<string | null>(null);
  useEffect(() => {
    if (
      activeMember &&
      !activeMember.movesInitialized &&
      playerLearnsetQuery.data
    ) {
      void initializePartyMoves(
        activeMember.slot,
        getInitialMoveNames(playerLearnsetQuery.data)
      ).catch(() => undefined);
    }
  }, [activeMember, initializePartyMoves, playerLearnsetQuery.data]);
  useEffect(() => {
    if (!profile || profile.opponentMovesInitialized || !bossLearnsetQuery.data) return;
    const key = `${profile.opponentId}:${profile.opponentLevel}`;
    if (initializingOpponent.current === key) return;
    initializingOpponent.current = key;
    void initializeOpponentMoves(
      chooseOpponentMoveNames(bossLearnsetQuery.data)
    )
      .then(() => {
        if (initializingOpponent.current === key) initializingOpponent.current = null;
      })
      .catch((error: unknown) => {
        initializingOpponent.current = null;
        setMessage(error instanceof Error ? error.message : 'Opponent moves could not be saved.');
      });
  }, [
    bossLearnsetQuery.data,
    initializeOpponentMoves,
    profile,
  ]);
  const area = profile ? getAreaById(profile.areaId) : null;
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number | null>(null);
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
  const movePatternContext = {
    level: activeMember?.level ?? 1,
    currentHp: activeMember?.currentHp ?? 0,
    maxHp: activeMember?.maxHp ?? 1,
    lastPhysicalDamageTaken: activeMember?.lastPhysicalDamageTaken ?? 0,
  };
  const playerMovePatterns =
    playerPokemon?.moves.map((move) =>
      getMovePattern(move, playerPokemon.stats, movePatternContext)
    ) ?? [];
  const selectedPattern = playerMovePatterns[selectedMoveIndex ?? -1];
  const remoteLoading =
    playerQuery.isPending ||
    bossQuery.isPending ||
    bossLearnsetQuery.isPending ||
    (!activeMember?.movesInitialized && playerLearnsetQuery.isPending);
  const remoteError =
    playerQuery.error ??
    bossQuery.error ??
    bossLearnsetQuery.error ??
    (!activeMember?.movesInitialized ? playerLearnsetQuery.error : null);
  const remoteReady = Boolean(
    playerPokemon &&
      bossPokemon &&
      dimensions &&
      activeMember?.movesInitialized &&
      profile?.opponentMovesInitialized
  );
  const bossRemaining = cells.filter(Boolean).length;
  const bossDefeated = Boolean(profile?.encounterComplete && bossRemaining === 0);
  const bossCaught = Boolean(profile?.encounterComplete && bossRemaining > 0);
  const currentHp = activeMember?.currentHp ?? 0;
  const canBattle = Boolean(
    !busy &&
      profile &&
      dimensions &&
      !profile.encounterComplete &&
      profile.pendingMoveUnlocks.length === 0 &&
      currentHp > 0 &&
      bossRemaining > 0 &&
      cells.length === totalCells &&
      statuses.length === totalCells &&
      statusFresh.length === totalCells
  );
  async function performMove(move: PokemonMove, row: number, column: number) {
    if (!canBattle || !dimensions || !profile || !bossPokemon || !playerPokemon) return;
    const pattern = getMovePattern(move, playerPokemon.stats, movePatternContext);
    const hitCells = getPatternCells(row, column, pattern, dimensions);
    const hitAnything = hitCells.some((index) => cells[index]);
    if (pattern.effectivePower !== null && !hitAnything) {
      setMessage('That part of the grid is already clear.');
      return;
    }

    setBusy(true);
    clearOperationError();
    try {
      const moveHits = doesMoveHit(move);
      const attackedGrid = moveHits
        ? pattern.effectivePower !== null
          ? applyMovePattern(cells, statuses, statusFresh, hitCells, move)
          : { cells, statuses, statusFresh }
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
      const moveMessage = !moveHits
        ? `${getMoveLabel(move.name)} missed.`
        : pattern.effectivePower === null
          ? `${getMoveLabel(move.name)} failed because no physical hit has been recorded.`
          : `${getMoveLabel(move.name)} cleared ${clearedByMove} block(s).`;
      await updateOpponentGrid(
        nextCells,
        statusTurn.statuses,
        statusTurn.statusFresh,
        defeated
      );
      if (clearedByMove + clearedByStatuses > 0) rumble();
      if (defeated) {
        setMessage(`${capitalize(bossPokemon.name)} fainted! The raid is complete.`);
      } else if (statusTurn.opponentSkipped) {
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
        const counterattack = getBossAttack(
          bossPokemon,
          Math.random,
          profile.opponentIsAreaBoss,
          bossRemaining,
          totalCells,
          profile.opponentLevel
        );
        if (!counterattack.move) {
          setMessage(`${moveMessage} ${capitalize(bossPokemon.name)} has no move available at this level.`);
        } else if (!doesMoveHit(counterattack.move)) {
          setMessage(
            `${moveMessage} ${capitalize(bossPokemon.name)} used ${getMoveLabel(counterattack.move.name)}, but it missed.`
          );
        } else {
          if (counterattack.damage > 0) {
            await damageActivePokemon(
              counterattack.damage,
              counterattack.move.damageClass === 'physical'
            );
            rumble();
          }
          setMessage(
            `${moveMessage} ` +
              `${clearedByStatuses > 0 ? `${clearedByStatuses} additional block(s) were cleared by status effects. ` : ''}` +
              `${capitalize(bossPokemon.name)} used ${getMoveLabel(counterattack.move.name)}` +
              `${counterattack.damage > 0 ? ` for ${counterattack.damage} damage.` : ', but it failed.'}`
          );
        }
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
        getPlayerMaxHp(bossPokemon.stats.hp),
        getInitialMoveNames(bossLearnsetQuery.data ?? [])
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

  async function startNewEncounter(fromShop = false): Promise<boolean> {
    if (!profile || !area || !profile.encounterComplete) return false;
    try {
      setBusy(true);
      await Promise.all(
        profile.party.map(async (member) => {
          if (member.movesInitialized) return;
          const learnset = await queryClient.fetchQuery({
            queryKey: ['pokemon-level-up-moves', member.pokemonId, member.level],
            queryFn: () => fetchPokemonLevelUpMoves(member.pokemonId, member.level),
          });
          await initializePartyMoves(
            member.slot,
            getInitialMoveNames(learnset)
          );
        })
      );
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
      const [opponentLearnset, newlyUnlockedMovesByMember] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ['pokemon-level-up-moves', opponentId, next.opponentLevel],
          queryFn: () => fetchPokemonLevelUpMoves(opponentId, next.opponentLevel),
        }),
        Promise.all(
          profile.party.map(async (member) => {
            if (next.opponentLevel <= member.level) return null;
            const learnset = await queryClient.fetchQuery({
              queryKey: ['pokemon-level-up-moves', member.pokemonId, next.opponentLevel],
              queryFn: () =>
                fetchPokemonLevelUpMoves(member.pokemonId, next.opponentLevel),
            });
            const moves = learnset
              .filter((move) => move.learnedAtLevel > member.level)
              .map((move) => move.name);
            return moves.length > 0
              ? { slot: member.slot, pokemonId: member.pokemonId, moves }
              : null;
          })
        ),
      ]);
      await advanceEncounter(
        opponentId,
        next.isAreaBoss,
        nextArea.id,
        chooseOpponentMoveNames(opponentLearnset),
        newlyUnlockedMovesByMember.filter(
          (unlock): unlock is NonNullable<typeof unlock> => unlock !== null
        ),
        specialBossId,
        fromShop
      );
      setMessage(
        `${nextArea.name} · Encounter ${next.encounterIndex + 1} of ${AREA_PROGRESSION_CONFIG.encountersPerArea}.`
      );
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
      const bossLearnset = await queryClient.fetchQuery({
        queryKey: ['pokemon-level-up-moves', opponentId, profile.opponentLevel],
        queryFn: () => fetchPokemonLevelUpMoves(opponentId, profile.opponentLevel),
      });
      await debugAdvanceToBoss(
        opponentId,
        chooseOpponentMoveNames(bossLearnset),
        specialBossId
      );
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
      ...(!activeMember?.movesInitialized ? [playerLearnsetQuery.refetch()] : []),
      bossLearnsetQuery.refetch(),
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
    playerMovePatterns,
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
    selectedPattern,
    learnMove,
    skipMoveUnlock,
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
    debugDefeatCurrent,
    debugGoToAreaBoss,
    debugHealEntireParty,
    debugWipeSaveData,
    handleGridCell,
  };
}
