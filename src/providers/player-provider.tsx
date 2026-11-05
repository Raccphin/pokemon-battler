import * as SQLite from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import {
  consumeBall,
  applyHealingItem,
  openPlayerDatabase,
  persistPlayerProfile,
} from '@/services/player-database';
import { getNextEncounterProgress } from '@/services/area-progression';
import { awardEncounterReward, buyShopItem, SHOP_CONFIG } from '@/services/shop';
import type { BallType, HealingItem, PartyMember, PlayerProfile, ShopItemKey } from '@/types/game';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; profile: PlayerProfile };

interface PlayerContextValue {
  state: LoadState;
  operationError: string | null;
  clearOperationError: () => void;
  retry: () => void;
  updateOpponentGrid: (
    cells: boolean[],
    statuses: PlayerProfile['opponentStatuses'],
    statusFresh: PlayerProfile['opponentStatusFresh'],
    complete?: boolean
  ) => Promise<void>;
  damageActivePokemon: (damage: number) => Promise<void>;
  switchPokemon: (slot: number) => Promise<void>;
  applyItem: (item: HealingItem, slot: number) => Promise<void>;
  purchaseItem: (item: ShopItemKey) => Promise<void>;
  resolveCatch: (
    ball: BallType,
    success: boolean,
    pokemonId: number,
    maxHp: number
  ) => Promise<void>;
  advanceEncounter: (
    opponentId: number,
    isAreaBoss: boolean,
    nextAreaId: string,
    specialBossId?: number,
    fromShop?: boolean
  ) => Promise<void>;
  debugAdvanceToBoss: (opponentId: number, specialBossId?: number) => Promise<void>;
  debugHealParty: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected save error occurred.';
}

export function PlayerProvider({ children }: React.PropsWithChildren) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [operationError, setOperationError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const databaseRef = useRef<SQLite.SQLiteDatabase | null>(null);
  const profileRef = useRef<PlayerProfile | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    void openPlayerDatabase()
      .then(({ database, profile }) => {
        if (!active) return;
        databaseRef.current = database;
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
      complete = false
    ) =>
      updateProfile((profile) => {
        if (cells.length !== statuses.length || cells.length !== statusFresh.length) {
          throw new Error('The boss grid and its status effects do not match.');
        }
        const rewardedProfile = complete && !profile.encounterComplete ? awardEncounterReward(profile) : profile;
        return {
          ...rewardedProfile,
          opponentCells: cells,
          opponentStatuses: statuses,
          opponentStatusFresh: statusFresh,
          encounterComplete: complete,
        };
      }),
    [updateProfile]
  );

  const damageActivePokemon = useCallback(
    (damage: number) =>
      updateProfile((profile) => {
        const active = profile.party.find((member) => member.slot === profile.activeSlot);
        if (!active) throw new Error('The active Pokémon is missing from the party.');
        const party = profile.party.map((member) =>
          member.slot === active.slot
            ? { ...member, currentHp: Math.max(0, member.currentHp - damage) }
            : member
        );
        return { ...profile, party };
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

  const resolveCatch = useCallback(
    (ball: BallType, success: boolean, pokemonId: number, maxHp: number) =>
      updateProfile((profile) => {
        if (profile.encounterComplete) throw new Error('This encounter is already complete.');
        const inventory = consumeBall(profile.inventory, ball);
        let party = profile.party;
        if (success) {
          if (party.length >= 6) {
            throw new Error('Your party is full. Switch or release a Pokémon before catching more.');
          }
          const usedSlots = new Set(party.map((member) => member.slot));
          let slot = 0;
          while (usedSlots.has(slot)) slot += 1;
          const caught: PartyMember = {
            slot,
            pokemonId,
            currentHp: maxHp,
            maxHp,
            level: profile.opponentLevel,
          };
          party = [...party, caught];
        }
        const rewardedProfile = success ? awardEncounterReward({ ...profile, inventory, party, encounterComplete: true }) : { ...profile, inventory, party, encounterComplete: false };
        return {
          ...rewardedProfile,
          inventory: rewardedProfile.inventory,
          party: rewardedProfile.party,
          encounterComplete: success,
        };
      }),
    [updateProfile]
  );

  const advanceEncounter = useCallback(
    (
      opponentId: number,
      isAreaBoss: boolean,
      nextAreaId: string,
      specialBossId?: number,
      fromShop = false
    ) =>
      updateProfile((profile) => {
        if (!profile.encounterComplete) {
          throw new Error('Complete the current encounter before continuing.');
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
        const party =
          next.areaNumber > profile.areaNumber
            ? profile.party.map((member) => ({ ...member, level: next.opponentLevel }))
            : profile.party;
        return {
          ...profile,
          opponentId,
          opponentLevel: next.opponentLevel,
          opponentIsAreaBoss: next.isAreaBoss,
          opponentCells: [],
          opponentStatuses: [],
          opponentStatusFresh: [],
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
    (opponentId: number, specialBossId?: number) =>
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
          opponentIsAreaBoss: true,
          opponentCells: [],
          opponentStatuses: [],
          opponentStatusFresh: [],
          encounterComplete: false,
          encounterIndex: 9,
          usedSpecialBossIds: specialBossId
            ? [...new Set([...profile.usedSpecialBossIds, specialBossId])]
            : profile.usedSpecialBossIds,
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
        operationError,
        clearOperationError,
        retry,
        updateOpponentGrid,
        damageActivePokemon,
        switchPokemon,
        applyItem,
        purchaseItem,
        resolveCatch,
        advanceEncounter,
        debugAdvanceToBoss,
        debugHealParty,
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
