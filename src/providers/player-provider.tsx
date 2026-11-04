import * as SQLite from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import {
  consumeBall,
  applyHealingItem,
  openPlayerDatabase,
  persistPlayerProfile,
} from '@/services/player-database';
import type { BallType, HealingItem, PartyMember, PlayerProfile } from '@/types/game';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; profile: PlayerProfile };

interface PlayerContextValue {
  state: LoadState;
  operationError: string | null;
  clearOperationError: () => void;
  retry: () => void;
  updateOpponentCells: (cells: boolean[], complete?: boolean) => Promise<void>;
  damageActivePokemon: (damage: number) => Promise<void>;
  switchPokemon: (slot: number) => Promise<void>;
  applyItem: (item: HealingItem, slot: number) => Promise<void>;
  resolveCatch: (
    ball: BallType,
    success: boolean,
    pokemonId: number,
    maxHp: number
  ) => Promise<void>;
  resetEncounter: () => Promise<void>;
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

  const updateOpponentCells = useCallback(
    (cells: boolean[], complete = false) =>
      updateProfile((profile) => ({
        ...profile,
        opponentCells: cells,
        encounterComplete: complete,
      })),
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
            level: 5,
          };
          party = [...party, caught];
        }
        return {
          ...profile,
          inventory,
          party,
          encounterComplete: success,
        };
      }),
    [updateProfile]
  );

  const resetEncounter = useCallback(
    () =>
      updateProfile((profile) => ({
        ...profile,
        opponentCells: [],
        encounterComplete: false,
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
        updateOpponentCells,
        damageActivePokemon,
        switchPokemon,
        applyItem,
        resolveCatch,
        resetEncounter,
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
