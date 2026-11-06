import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { usePlayer } from '@/providers/player-provider';
import { getPlayerMaxHp } from '@/services/battle-rules';
import { getInitialMoveNames } from '@/services/move-learning';
import { fetchPokemonLevelUpMoves } from '@/services/pokeapi';
import { fetchStarterOptions, type StarterOption } from '@/services/starter-selection';

export function useStarterSelectionController() {
  const { state, selectStarter, retry, debugWipeSaveData } = usePlayer();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const starterQuery = useQuery({
    queryKey: ['starter-options'],
    queryFn: fetchStarterOptions,
    enabled: state.status === 'ready' && !state.profile.starterSelected,
  });
  const selectedPokemon =
    starterQuery.data?.find((pokemon) => pokemon.id === selectedId) ?? null;

  async function confirmSelection(pokemon: StarterOption): Promise<boolean> {
    setConfirming(true);
    setConfirmError(null);
    try {
      const learnableMoves = await fetchPokemonLevelUpMoves(pokemon.id, 1);
      await selectStarter(
        pokemon.id,
        getPlayerMaxHp(pokemon.hp),
        getInitialMoveNames(learnableMoves)
      );
      return true;
    } catch (error) {
      setConfirmError(
        error instanceof Error ? error.message : 'The starter could not be saved. Try again.'
      );
      return false;
    } finally {
      setConfirming(false);
    }
  }

  function chooseStarter(id: number) {
    setSelectedId(id);
    setConfirmError(null);
  }

  return {
    state,
    retry,
    debugWipeSaveData,
    starterOptions: starterQuery.data,
    starterLoading: starterQuery.isPending,
    starterError: starterQuery.error,
    retryStarters: () => {
      void starterQuery.refetch();
    },
    selectedId,
    selectedPokemon,
    chooseStarter,
    confirming,
    confirmError,
    confirmSelection,
  };
}
