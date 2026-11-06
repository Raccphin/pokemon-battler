import { useQueries } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { usePlayer } from '@/providers/player-provider';
import { fetchPokemon, fetchPokemonLevelUpMoves } from '@/services/pokeapi';
import { getInitialMoveNames } from '@/services/move-learning';
import { getMovePattern } from '@/services/move-patterns';
import { getMoveLabel } from '@/utils/labels';

export function usePartyController() {
  const {
    state,
    operationError,
    switchPokemon,
    initializePartyMoves,
    retry,
    debugWipeSaveData,
  } = usePlayer();
  const profile = state.status === 'ready' ? state.profile : null;
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const queries = useQueries({
    queries: (profile?.party ?? []).map((member) => ({
      queryKey: ['pokemon', member.pokemonId, member.moves],
      queryFn: () => fetchPokemon(member.pokemonId, member.moves),
    })),
  });
  const membersToInitialize = useMemo(
    () => profile?.party.filter((member) => !member.movesInitialized) ?? [],
    [profile?.party]
  );
  const initializationQueries = useQueries({
    queries: (profile?.party ?? []).map((member) => ({
      queryKey: ['pokemon-level-up-moves', member.pokemonId, member.level],
      queryFn: () => fetchPokemonLevelUpMoves(member.pokemonId, member.level),
      enabled: !member.movesInitialized,
    })),
  });
  const loading =
    queries.some((query) => query.isPending) ||
    membersToInitialize.some((member) => {
      const index = profile?.party.findIndex((candidate) => candidate.slot === member.slot) ?? -1;
      return initializationQueries[index]?.isPending ?? false;
    });
  const error =
    queries.find((query) => query.error)?.error ??
    initializationQueries.find((query) => query.error)?.error;
  useEffect(() => {
    membersToInitialize.forEach((member) => {
      const index = profile?.party.findIndex((candidate) => candidate.slot === member.slot) ?? -1;
      const moveQuery = initializationQueries[index];
      if (!member.movesInitialized && moveQuery?.data) {
        void initializePartyMoves(member.slot, getInitialMoveNames(moveQuery.data)).catch(
          () => undefined
        );
      }
    });
  }, [initializePartyMoves, initializationQueries, membersToInitialize, profile?.party]);
  const members =
    profile?.party.map((member, index) => ({
      ...member,
      pokemon: queries[index]?.data,
      movePreviews: queries[index]?.data?.moves.map((move) => ({
        move,
        label: getMoveLabel(move.name),
        pattern: queries[index]?.data
          ? getMovePattern(move, queries[index].data.stats, {
              level: member.level,
              currentHp: member.currentHp,
              maxHp: member.maxHp,
              lastPhysicalDamageTaken: member.lastPhysicalDamageTaken,
            })
          : null,
      })) ?? [],
    })) ?? [];
  const selectedMember =
    members.find((member) => member.slot === selectedSlot) ??
    members.find((member) => member.slot === profile?.activeSlot) ??
    members[0];

  async function switchSelected() {
    if (!selectedMember || selectedMember.currentHp <= 0) return;
    try {
      await switchPokemon(selectedMember.slot);
    } catch {
      // The player provider exposes persistence and validation errors to the screen.
    }
  }

  function retryPokemonData() {
    void Promise.all([
      ...queries.map((query) => query.refetch()),
      ...initializationQueries.map((query) => query.refetch()),
    ]);
  }

  return {
    state,
    profile,
    operationError,
    retry,
    debugWipeSaveData,
    loading,
    error,
    members,
    selectedMember,
    selectMember: setSelectedSlot,
    switchSelected,
    retryPokemonData,
  };
}
