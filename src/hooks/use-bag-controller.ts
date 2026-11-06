import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';

import { usePlayer } from '@/providers/player-provider';
import { fetchPokemon } from '@/services/pokeapi';
import type { HealingItem } from '@/types/game';

function canUseItem(
  member: { currentHp: number; maxHp: number },
  item: HealingItem
): boolean {
  return item === 'potion'
    ? member.currentHp > 0 && member.currentHp < member.maxHp
    : member.currentHp <= 0;
}

export function useBagController() {
  const { state, operationError, retry, applyItem, debugWipeSaveData } = usePlayer();
  const [selectedItem, setSelectedItem] = useState<HealingItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const members = state.status === 'ready' ? state.profile.party : [];
  const pokemonQueries = useQueries({
    queries: members.map((member) => ({
      queryKey: ['pokemon', member.pokemonId, member.moves],
      queryFn: () => fetchPokemon(member.pokemonId, member.moves),
      enabled: selectedItem !== null,
    })),
  });
  const pokemonNamesLoading = pokemonQueries.some((query) => query.isPending);
  const pokemonNamesError = pokemonQueries.some((query) => query.isError);
  const party = members.map((member, index) => ({
    ...member,
    pokemon: pokemonQueries[index]?.data,
    pokemonError: pokemonQueries[index]?.isError ?? false,
    eligible: selectedItem !== null && canUseItem(member, selectedItem),
  }));

  function selectItem(item: HealingItem) {
    setMessage(null);
    setSelectedItem((current) => (current === item ? null : item));
  }

  async function applySelectedItem(slot: number) {
    if (!selectedItem) return;
    try {
      await applyItem(selectedItem, slot);
      const memberIndex = members.findIndex((member) => member.slot === slot);
      const pokemonName = pokemonQueries[memberIndex]?.data?.name;
      const name = pokemonName
        ? pokemonName.charAt(0).toUpperCase() + pokemonName.slice(1)
        : 'Pokémon';
      setMessage(`${selectedItem === 'potion' ? 'Potion' : 'Revive'} used on ${name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The item could not be used.');
    }
  }

  function retryPokemonNames() {
    void Promise.all(pokemonQueries.map((query) => query.refetch()));
  }

  return {
    state,
    operationError,
    retry,
    debugWipeSaveData,
    selectedItem,
    selectItem,
    message,
    party,
    pokemonNamesLoading,
    pokemonNamesError,
    retryPokemonNames,
    applySelectedItem,
  };
}
