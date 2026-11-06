import * as SQLite from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import {
  consumeBall,
  applyHealingItem,
  loadPlayerProfile,
  openPlayerDatabaseConnection,
  persistPlayerProfile,
  resetPlayerSave,
} from '@/services/player-database';
import {
  AREA_PROGRESSION_CONFIG,
  getNextEncounterProgress,
  getOpponentProgressionLevel,
  getPlayerProgressionLevel,
} from '@/services/area-progression';
import {
  finishRunIfDefeated,
  replacePartyMemberWithCatch as replacePartyMember,
} from '@/services/run-rules';
import {
  awardEncounterReward,
  buyShopItem,
  MOVE_LEARNING_PRICE,
  SHOP_CONFIG,
} from '@/services/shop';
import type {
  BallType,
  HealingItem,
  PartyMember,
  PendingEvolution,
  PendingMoveUnlock,
  PlayerProfile,
  ShopItemKey,
} from '@/types/game';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; profile: PlayerProfile };

interface PlayerContextValue {
  state: LoadState;
  selectedMoveIndex: number | null;
  setSelectedMoveIndex: (index: number | null) => void;
  operationError: string | null;
  clearOperationError: () => void;
  retry: () => void;
  updateOpponentGrid: (
    cells: boolean[],
    statuses: PlayerProfile['opponentStatuses'],
    statusFresh: PlayerProfile['opponentStatusFresh'],
    complete?: boolean,
    gridVersion?: number
  ) => Promise<void>;
  damageActivePokemon: (damage: number, isPhysical: boolean) => Promise<void>;
  switchPokemon: (slot: number) => Promise<void>;
  selectStarter: (pokemonId: number, maxHp: number, moves: string[]) => Promise<void>;
  initializePartyMoves: (slot: number, moves: string[]) => Promise<void>;
  learnMove: (
    slot: number,
    moveName: string,
    replacedMoveName: string | null,
    source: 'level-up' | 'shop'
  ) => Promise<void>;
  skipMoveUnlock: (slot: number, moveName: string) => Promise<void>;
  evolvePokemon: (
    slot: number,
    targetPokemonId: number,
    maxHp: number,
    minimumLevel: number,
    source: 'level-up' | 'shop'
  ) => Promise<void>;
  deferEvolution: (slot: number, pokemonId: number) => Promise<void>;
  applyItem: (item: HealingItem, slot: number) => Promise<void>;
  purchaseItem: (item: ShopItemKey) => Promise<void>;
  resolveCatch: (
    ball: BallType,
    success: boolean,
    pokemonId: number,
    maxHp: number,
    moves: string[]
  ) => Promise<void>;
  replacePartyMemberWithCatch: (slot: number) => Promise<void>;
  advanceEncounter: (
    opponentId: number,
    isAreaBoss: boolean,
    nextAreaId: string,
    opponentMoves: string[],
    newlyUnlockedMoves: PendingMoveUnlock[],
    newlyUnlockedEvolutions: PendingEvolution[],
    specialBossId?: number,
    fromShop?: boolean
  ) => Promise<void>;
  debugAdvanceToBoss: (
    opponentId: number,
    opponentMoves: string[],
    specialBossId?: number
  ) => Promise<void>;
  initializeOpponentMoves: (moves: string[]) => Promise<void>;
  debugHealParty: () => Promise<void>;
  startNewRun: () => Promise<void>;
  debugWipeSaveData: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected save error occurred.';
}

export function PlayerProvider({ children }: React.PropsWithChildren) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const databaseRef = useRef<SQLite.SQLiteDatabase | null>(null);
  const profileRef = useRef<PlayerProfile | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    void openPlayerDatabaseConnection()
      .then(async (database) => {
        if (!active) return;
        databaseRef.current = database;
        const loadedProfile = await loadPlayerProfile(database);
        const profile = finishRunIfDefeated(loadedProfile);
        if (profile !== loadedProfile) {
          await persistPlayerProfile(database, profile);
        }
        if (!active) return;
        profileRef.current = profile;
        setState({ status: 'ready', profile });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: 'error', message: getErrorMessage(error) });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const updateProfile = useCallback((updater: (profile: PlayerProfile) => PlayerProfile) => {
    const operation = queueRef.current.then(async () => {
      const database = databaseRef.current;
      const current = profileRef.current;
      if (!database || !current) {
        throw new Error('The player save is not ready yet.');
      }
      if (current.runStatus === 'gameOver') {
        throw new Error('This run has ended. Start a new run to continue playing.');
      }
      const next = updater(current);
      await persistPlayerProfile(database, next);
      profileRef.current = next;
      setState({ status: 'ready', profile: next });
      setOperationError(null);
    });
    queueRef.current = operation.catch(() => undefined);
    void operation.catch((error: unknown) => setOperationError(getErrorMessage(error)));
    return operation;
  }, []);

  const updateOpponentGrid = useCallback(
    (
      cells: boolean[],
      statuses: PlayerProfile['opponentStatuses'],
      statusFresh: PlayerProfile['opponentStatusFresh'],
      complete?: boolean,
      gridVersion?: number
    ) =>
      updateProfile((profile) => {
        if (cells.length !== statuses.length || cells.length !== statusFresh.length) {
          throw new Error('The boss grid and its status effects do not match.');
        }
        const rewardedProfile =
          complete === true && !profile.encounterComplete
            ? awardEncounterReward(profile)
            : profile;
        return {
          ...rewardedProfile,
          opponentCells: cells,
          opponentStatuses: statuses,
          opponentStatusFresh: statusFresh,
          opponentGridVersion: gridVersion ?? profile.opponentGridVersion,
          encounterComplete: complete ?? profile.encounterComplete,
        };
      }),
    [updateProfile]
  );

  const damageActivePokemon = useCallback(
    (damage: number, isPhysical: boolean) =>
      updateProfile((profile) => {
        const active = profile.party.find((member) => member.slot === profile.activeSlot);
        if (!active) throw new Error('The active Pokémon is missing from the party.');
        const damageTaken = Math.min(active.currentHp, Math.max(0, damage));
        const party = profile.party.map((member) =>
          member.slot === active.slot
            ? {
                ...member,
                currentHp: active.currentHp - damageTaken,
                lastPhysicalDamageTaken:
                  isPhysical && damageTaken > 0
                    ? damageTaken
                    : member.lastPhysicalDamageTaken,
              }
            : member
        );
        return finishRunIfDefeated({ ...profile, party });
      }),
    [updateProfile]
  );

  const switchPokemon = useCallback(
    (slot: number) =>
      updateProfile((profile) => {
        const member = profile.party.find((pokemon) => pokemon.slot === slot);
        if (!member) throw new Error('That Pokémon is not in your party.');
        if (member.currentHp <= 0) throw new Error('A fainted Pokémon cannot be switched in.');
        return { ...profile, activeSlot: slot };
      }),
    [updateProfile]
  );

  const selectStarter = useCallback(
    (pokemonId: number, maxHp: number, moves: string[]) =>
      updateProfile((profile) => {
        if (profile.starterSelected || profile.party.length > 0) {
          throw new Error('A starter has already been selected for this run.');
        }
        if (!Number.isInteger(pokemonId) || pokemonId <= 0) {
          throw new Error('The selected Pokémon is invalid.');
        }
        if (!Number.isInteger(maxHp) || maxHp <= 0) {
          throw new Error('The selected Pokémon has invalid health data.');
        }
        const starter: PartyMember = {
          slot: 0,
          pokemonId,
          currentHp: maxHp,
          maxHp,
          level: 1,
          moves: [...new Set(moves)].slice(0, 4),
          movesInitialized: true,
          lastPhysicalDamageTaken: 0,
        };
        return {
          ...profile,
          starterSelected: true,
          activeSlot: starter.slot,
          party: [starter],
        };
      }),
    [updateProfile]
  );

  const initializePartyMoves = useCallback(
    (slot: number, moves: string[]) =>
      updateProfile((profile) => {
        const member = profile.party.find((pokemon) => pokemon.slot === slot);
        if (!member) throw new Error('That Pokémon is not in your party.');
        if (member.movesInitialized) return profile;
        return {
          ...profile,
          party: profile.party.map((pokemon) =>
            pokemon.slot === slot
              ? {
                  ...pokemon,
                  moves: [...new Set(moves)].slice(0, 4),
                  movesInitialized: true,
                }
              : pokemon
          ),
        };
      }),
    [updateProfile]
  );

  const applyItem = useCallback(
    (item: HealingItem, slot: number) =>
      updateProfile((profile) => {
        const member = profile.party.find((pokemon) => pokemon.slot === slot);
        if (!member) throw new Error('That Pokémon is not in your party.');
        const result = applyHealingItem(member, profile.inventory, item);
        return {
          ...profile,
          inventory: result.inventory,
          party: profile.party.map((pokemon) =>
            pokemon.slot === slot ? result.member : pokemon
          ),
        };
      }),
    [updateProfile]
  );

  const purchaseItem = useCallback(
    (item: ShopItemKey) =>
      updateProfile((profile) => buyShopItem(profile, item)),
    [updateProfile]
  );

  const learnMove = useCallback(
    (
      slot: number,
      moveName: string,
      replacedMoveName: string | null,
      source: 'level-up' | 'shop'
    ) =>
      updateProfile((profile) => {
        const member = profile.party.find((pokemon) => pokemon.slot === slot);
        if (!member) throw new Error('That Pokémon is not in your party.');
        if (member.moves.includes(moveName)) {
          throw new Error('That Pokémon already has this move equipped.');
        }
        const pending = profile.pendingMoveUnlocks.find(
          (unlock) => unlock.slot === slot && unlock.pokemonId === member.pokemonId
        );
        if (source === 'level-up' && !pending?.moves.includes(moveName)) {
          throw new Error('That move is not waiting to be learned.');
        }
        if (source === 'shop' && profile.money < MOVE_LEARNING_PRICE) {
          throw new Error(`You need ${MOVE_LEARNING_PRICE - profile.money} more coins to learn that move.`);
        }

        let moves = member.moves;
        if (moves.length >= 4) {
          if (!replacedMoveName || !moves.includes(replacedMoveName)) {
            throw new Error('Choose one of the Pokémon’s equipped moves to replace.');
          }
          moves = moves.filter((move) => move !== replacedMoveName);
        } else if (replacedMoveName) {
          throw new Error('Fill an empty move slot before replacing an equipped move.');
        }

        return {
          ...profile,
          party: profile.party.map((pokemon) =>
            pokemon.slot === slot ? { ...pokemon, moves: [...moves, moveName] } : pokemon
          ),
          pendingMoveUnlocks: profile.pendingMoveUnlocks
            .map((unlock) =>
              unlock.slot === slot && unlock.pokemonId === member.pokemonId
                ? { ...unlock, moves: unlock.moves.filter((move) => move !== moveName) }
                : unlock
            )
            .filter((unlock) => unlock.moves.length > 0),
          money: source === 'shop' ? profile.money - MOVE_LEARNING_PRICE : profile.money,
        };
      }),
    [updateProfile]
  );

  const evolvePokemon = useCallback(
    (
      slot: number,
      targetPokemonId: number,
      maxHp: number,
      minimumLevel: number,
      source: 'level-up' | 'shop'
    ) =>
      updateProfile((profile) => {
        const member = profile.party.find((pokemon) => pokemon.slot === slot);
        const offer = profile.pendingEvolutions.find(
          (evolution) => evolution.slot === slot && evolution.pokemonId === member?.pokemonId
        );
        if (!member) throw new Error('That Pokémon is no longer in the party.');
        const hasOfferedEvolution = offer?.options.some(
          (option) => option.pokemonId === targetPokemonId
        );
        const eligibleInShop =
          source === 'shop' &&
          Number.isInteger(minimumLevel) &&
          minimumLevel > 0 &&
          member.level >= minimumLevel;
        if (source === 'level-up' && !hasOfferedEvolution) {
          throw new Error('That evolution is no longer available.');
        }
        if (source === 'shop' && !hasOfferedEvolution && !eligibleInShop) {
          throw new Error('That evolution is not available for this Pokémon.');
        }
        if (!Number.isInteger(maxHp) || maxHp <= 0) {
          throw new Error('The evolved Pokémon has invalid health data.');
        }
        const damageTaken = member.maxHp - member.currentHp;
        return {
          ...profile,
          party: profile.party.map((pokemon) =>
            pokemon.slot === slot
              ? {
                  ...pokemon,
                  pokemonId: targetPokemonId,
                  maxHp,
                  currentHp: Math.max(0, Math.min(maxHp, maxHp - damageTaken)),
                }
              : pokemon
          ),
          pendingMoveUnlocks: profile.pendingMoveUnlocks.filter(
            (unlock) => unlock.slot !== slot
          ),
          pendingEvolutions: profile.pendingEvolutions.filter(
            (evolution) => evolution.slot !== slot
          ),
        };
      }),
    [updateProfile]
  );

  const deferEvolution = useCallback(
    (slot: number, pokemonId: number) =>
      updateProfile((profile) => {
        const offer = profile.pendingEvolutions.find(
          (evolution) =>
            evolution.slot === slot && evolution.pokemonId === pokemonId
        );
        if (!offer) throw new Error('That evolution prompt is no longer available.');
        return {
          ...profile,
          pendingEvolutions: profile.pendingEvolutions.map((evolution) =>
            evolution === offer ? { ...evolution, prompted: true } : evolution
          ),
        };
      }),
    [updateProfile]
  );

  const skipMoveUnlock = useCallback(
    (slot: number, moveName: string) =>
      updateProfile((profile) => ({
        ...profile,
        pendingMoveUnlocks: profile.pendingMoveUnlocks
          .map((unlock) =>
            unlock.slot === slot
              ? { ...unlock, moves: unlock.moves.filter((move) => move !== moveName) }
              : unlock
          )
          .filter((unlock) => unlock.moves.length > 0),
      })),
    [updateProfile]
  );

  const resolveCatch = useCallback(
    (ball: BallType, success: boolean, pokemonId: number, maxHp: number, moves: string[]) =>
      updateProfile((profile) => {
        if (profile.encounterComplete) throw new Error('This encounter is already complete.');
        if (profile.pendingCatch) throw new Error('Choose a Pokémon to release before continuing.');
        const inventory = consumeBall(profile.inventory, ball);
        let party = profile.party;
        let pendingCatch: PlayerProfile['pendingCatch'] = profile.pendingCatch;
        if (success) {
          const caught = {
            pokemonId,
            currentHp: maxHp,
            maxHp,
            level: getPlayerProgressionLevel(profile.areaNumber, profile.encounterIndex),
            moves: [...new Set(moves)].slice(0, 4),
            movesInitialized: true,
            lastPhysicalDamageTaken: 0,
          };
          if (party.length >= 6) {
            pendingCatch = caught;
          } else {
            const usedSlots = new Set(party.map((member) => member.slot));
            let slot = 0;
            while (usedSlots.has(slot)) slot += 1;
            party = [...party, { ...caught, slot }];
          }
        }
        const rewardedProfile = success
          ? awardEncounterReward({
              ...profile,
              inventory,
              party,
              pendingCatch,
              encounterComplete: true,
            })
          : { ...profile, inventory, party, encounterComplete: false };
        return {
          ...rewardedProfile,
          inventory: rewardedProfile.inventory,
          party: rewardedProfile.party,
          pendingCatch: rewardedProfile.pendingCatch,
          encounterComplete: success,
        };
      }),
    [updateProfile]
  );

  const replacePartyMemberWithCatch = useCallback(
    (slot: number) =>
      updateProfile((profile) => {
        return {
          ...profile,
          ...replacePartyMember(profile.party, profile.pendingCatch, slot),
          pendingEvolutions: profile.pendingEvolutions.filter(
            (evolution) => evolution.slot !== slot
          ),
        };
      }),
    [updateProfile]
  );

  const advanceEncounter = useCallback(
    (
      opponentId: number,
      isAreaBoss: boolean,
      nextAreaId: string,
      opponentMoves: string[],
      newlyUnlockedMoves: PendingMoveUnlock[],
      newlyUnlockedEvolutions: PendingEvolution[],
      specialBossId?: number,
      fromShop = false
    ) =>
      updateProfile((profile) => {
        if (!profile.encounterComplete) {
          throw new Error('Complete the current encounter before continuing.');
        }
        if (profile.pendingCatch) {
          throw new Error('Choose a Pokémon to release before continuing.');
        }
        if (profile.shopProgress >= SHOP_CONFIG.encountersPerShop && !fromShop) {
          throw new Error('Visit the shop before continuing to the next encounter.');
        }
        if (fromShop && profile.shopProgress < SHOP_CONFIG.encountersPerShop) {
          throw new Error('The shop is not ready to close yet.');
        }
        if (specialBossId !== undefined && (!isAreaBoss || specialBossId !== opponentId)) {
          throw new Error('The selected special boss does not match the next encounter.');
        }
        const next = getNextEncounterProgress(profile, nextAreaId);
        if (next.isAreaBoss !== isAreaBoss) {
          throw new Error('The next encounter does not match its saved progression stage.');
        }
        const usedSpecialBossIds = specialBossId
          ? [...new Set([...profile.usedSpecialBossIds, specialBossId])]
          : profile.usedSpecialBossIds;
        const playerLevel = getPlayerProgressionLevel(
          next.areaNumber,
          next.encounterIndex,
        );
        const party = profile.party.map((member) => ({
          ...member,
          level: playerLevel,
          lastPhysicalDamageTaken: 0,
        }));
        const existingPending = new Set(
          profile.pendingMoveUnlocks.flatMap((unlock) =>
            unlock.moves.map((move) => `${unlock.slot}:${move}`)
          )
        );
        const validUnlocks = newlyUnlockedMoves
          .map((unlock) => ({
            ...unlock,
            moves: unlock.moves.filter((move) => {
              const member = party.find((candidate) => candidate.slot === unlock.slot);
              const key = `${unlock.slot}:${move}`;
              return (
                member?.pokemonId === unlock.pokemonId &&
                !member.moves.includes(move) &&
                !existingPending.has(key)
              );
            }),
          }))
          .filter((unlock) => unlock.moves.length > 0);
        const pendingEvolutions = [...profile.pendingEvolutions];
        newlyUnlockedEvolutions.forEach((evolution) => {
          const member = party.find((candidate) => candidate.slot === evolution.slot);
          if (
            !member ||
            member.pokemonId !== evolution.pokemonId ||
            evolution.options.length === 0
          ) {
            return;
          }
          const existingIndex = pendingEvolutions.findIndex(
            (candidate) =>
              candidate.slot === evolution.slot &&
              candidate.pokemonId === evolution.pokemonId
          );
          if (existingIndex < 0) {
            pendingEvolutions.push({ ...evolution, prompted: false });
            return;
          }
          const existing = pendingEvolutions[existingIndex];
          pendingEvolutions[existingIndex] = {
            ...existing,
            options: [
              ...existing.options,
              ...evolution.options.filter(
                (option) =>
                  !existing.options.some(
                    (existingOption) => existingOption.pokemonId === option.pokemonId
                  )
              ),
            ],
            prompted: false,
          };
        });
        return {
          ...profile,
          pendingMoveUnlocks: [...profile.pendingMoveUnlocks, ...validUnlocks],
          pendingEvolutions,
          opponentId,
          opponentLevel: next.opponentLevel,
          opponentIsAreaBoss: next.isAreaBoss,
          opponentCells: [],
          opponentStatuses: [],
          opponentStatusFresh: [],
          opponentMoves: [...new Set(opponentMoves)].slice(0, 4),
          opponentMovesInitialized: true,
          encounterComplete: false,
          areaId: next.areaId,
          areaNumber: next.areaNumber,
          encounterIndex: next.encounterIndex,
          usedSpecialBossIds,
          shopProgress: fromShop ? 0 : profile.shopProgress,
          party,
        };
      }),
    [updateProfile]
  );

  const debugAdvanceToBoss = useCallback(
    (opponentId: number, opponentMoves: string[], specialBossId?: number) =>
      updateProfile((profile) => {
        if (profile.opponentIsAreaBoss) {
          throw new Error('You are already at this area’s boss.');
        }
        if (specialBossId !== undefined && specialBossId !== opponentId) {
          throw new Error('The selected special boss does not match the next encounter.');
        }
        return {
          ...profile,
          opponentId,
          opponentLevel: getOpponentProgressionLevel(
            profile.areaNumber,
            AREA_PROGRESSION_CONFIG.encountersPerArea - 1,
          ),
          opponentIsAreaBoss: true,
          opponentCells: [],
          opponentStatuses: [],
          opponentStatusFresh: [],
          opponentMoves: [...new Set(opponentMoves)].slice(0, 4),
          opponentMovesInitialized: true,
          encounterComplete: false,
          encounterIndex: 9,
          party: profile.party.map((member) => ({
            ...member,
            level: getPlayerProgressionLevel(profile.areaNumber, 9),
            lastPhysicalDamageTaken: 0,
          })),
          usedSpecialBossIds: specialBossId
            ? [...new Set([...profile.usedSpecialBossIds, specialBossId])]
            : profile.usedSpecialBossIds,
        };
      }),
    [updateProfile]
  );

  const initializeOpponentMoves = useCallback(
    (moves: string[]) =>
      updateProfile((profile) => {
        if (profile.opponentMovesInitialized) return profile;
        return {
          ...profile,
          opponentMoves: [...new Set(moves)].slice(0, 4),
          opponentMovesInitialized: true,
        };
      }),
    [updateProfile]
  );

  const debugHealParty = useCallback(
    () =>
      updateProfile((profile) => ({
        ...profile,
        party: profile.party.map((member) => ({
          ...member,
          currentHp: member.maxHp,
        })),
      })),
    [updateProfile]
  );

  const resetRun = useCallback(() => {
    const operation = queueRef.current.then(async () => {
      const database = databaseRef.current;
      if (!database) {
        throw new Error('The player save is not ready yet.');
      }
      const profile = await resetPlayerSave(database);
      profileRef.current = profile;
      setState({ status: 'ready', profile });
      setOperationError(null);
    });
    queueRef.current = operation.catch(() => undefined);
    void operation.catch((error: unknown) => setOperationError(getErrorMessage(error)));
    return operation;
  }, []);
  const startNewRun = resetRun;
  const debugWipeSaveData = resetRun;

  const clearOperationError = useCallback(() => setOperationError(null), []);
  const retry = useCallback(() => {
    setOperationError(null);
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        state,
        selectedMoveIndex,
        setSelectedMoveIndex,
        operationError,
        clearOperationError,
        retry,
        updateOpponentGrid,
        damageActivePokemon,
        switchPokemon,
        selectStarter,
        initializePartyMoves,
        learnMove,
        skipMoveUnlock,
        evolvePokemon,
        deferEvolution,
        applyItem,
        purchaseItem,
        resolveCatch,
        replacePartyMemberWithCatch,
        advanceEncounter,
        debugAdvanceToBoss,
        initializeOpponentMoves,
        debugHealParty,
        startNewRun,
        debugWipeSaveData,
      }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within a PlayerProvider.');
  return context;
}
