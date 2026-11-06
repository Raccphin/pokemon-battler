import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { usePlayer } from '@/providers/player-provider';
import { AREA_PROGRESSION_CONFIG, AREAS } from '@/services/area-progression';
import { fetchPokemon } from '@/services/pokeapi';

export function useGameOverController() {
  const queryClient = useQueryClient();
  const { state, retry, startNewRun, debugWipeSaveData } = usePlayer();
  const summary = state.status === 'ready' ? state.profile.runSummary : null;
  const pokemonQueries = useQueries({
    queries: (summary?.party ?? []).map((member) => ({
      queryKey: ['pokemon', member.pokemonId],
      queryFn: () => fetchPokemon(member.pokemonId),
    })),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const area = summary
    ? AREAS.find((candidate) => candidate.id === summary.areaId) ?? null
    : null;
  const pokemonError = pokemonQueries.find((query) => query.error)?.error;
  const loadingTeam = pokemonQueries.some((query) => query.isPending);
  const party = (summary?.party ?? []).map((member, index) => ({
    ...member,
    pokemon: pokemonQueries[index]?.data,
  }));
  const clearedEncounters = summary
    ? (summary.areaNumber - 1) * AREA_PROGRESSION_CONFIG.encountersPerArea +
      summary.encounterIndex
    : 0;
  const encounterNumber = summary ? summary.encounterIndex + 1 : 0;

  function retryPokemonData() {
    void Promise.all(pokemonQueries.map((query) => query.refetch()));
  }

  async function beginNewRun(): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      queryClient.removeQueries({ queryKey: ['starter-options'] });
      await startNewRun();
      return true;
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : 'A new run could not be started.'
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function wipeRun(): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      queryClient.removeQueries({ queryKey: ['starter-options'] });
      await debugWipeSaveData();
      return true;
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : 'The saved run could not be wiped.'
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  return {
    state,
    retry,
    debugWipeSaveData,
    summary,
    party,
    pokemonError,
    loadingTeam,
    area,
    encountersPerArea: AREA_PROGRESSION_CONFIG.encountersPerArea,
    clearedEncounters,
    encounterNumber,
    retryPokemonData,
    busy,
    error,
    beginNewRun,
    wipeRun,
  };
}
