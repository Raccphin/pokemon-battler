import { fetchPokemonStarterData } from '@/services/pokeapi';
import { chooseStarterCandidates, STARTER_SELECTION_CONFIG } from '@/services/starter-selection-rules';

export interface StarterOption {
  id: number;
  name: string;
  types: string[];
  hp: number;
  spriteUrl: string | null;
}

export async function fetchStarterOptions(): Promise<StarterOption[]> {
  const candidates = await Promise.all(
    STARTER_SELECTION_CONFIG.candidatePokemonIds.map((id) => fetchPokemonStarterData(id))
  );
  return chooseStarterCandidates(candidates);
}
