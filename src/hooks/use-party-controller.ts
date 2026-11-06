import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';

import { usePlayer } from '@/providers/player-provider';
import { fetchPokemon } from '@/services/pokeapi';

export function usePartyController() {
  const {
    state,
    operationError,
    switchPokemon,
    retry,
    debugWipeSaveData,
  } = usePlayer();
  const profile = state.status === 'ready' ? state.profile : null;
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const queries = useQueries({
    queries: (profile?.party ?? []).map((member) => ({
      queryKey: ['pokemon', member.pokemonId],
      queryFn: () => fetchPokemon(member.pokemonId),
    })),
  });
  const loading = queries.some((query) => query.isPending);
  const error = queries.find((query) => query.error)?.error;
  const members =
    profile?.party.map((member, index) => ({
      ...member,
      pokemon: queries[index]?.data,
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
    void Promise.all(queries.map((query) => query.refetch()));
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
