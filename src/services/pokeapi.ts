import type { Pokemon, PokemonMove } from '@/types/game';

interface PokemonApiResponse {
  id: number;
  name: string;
  types: { type: { name: string } }[];
  stats: { base_stat: number; stat: { name: string } }[];
  species: { url: string };
  sprites: {
    other?: {
      'official-artwork'?: {
        front_default: string | null;
      };
    };
  };
  moves: { move: { name: string; url: string } }[];
}

interface SpeciesApiResponse {
  capture_rate: number;
}

interface MoveApiResponse {
  power: number | null;
  type: { name: string };
}

const API_BASE_URL = 'https://pokeapi.co/api/v2';

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PokéAPI request failed (${response.status}): ${url}`);
  }
  return (await response.json()) as T;
}

function getStat(stats: PokemonApiResponse['stats'], name: string): number {
  const stat = stats.find((entry) => entry.stat.name === name);
  if (!stat) {
    throw new Error(`PokéAPI response is missing the ${name} stat.`);
  }
  return stat.base_stat;
}

function getPatternSize(power: number): PokemonMove['patternSize'] {
  if (power >= 90) return 3;
  if (power >= 45) return 2;
  return 1;
}

export async function fetchPokemon(id: number): Promise<Pokemon> {
  const response = await fetchJson<PokemonApiResponse>(`${API_BASE_URL}/pokemon/${id}`);
  const species = await fetchJson<SpeciesApiResponse>(response.species.url);
  const moves = await Promise.all(
    response.moves.slice(0, 4).map(async ({ move }) => {
      const details = await fetchJson<MoveApiResponse>(move.url);
      const power = details.power ?? 20;
      return {
        name: move.name,
        type: details.type.name,
        power,
        patternSize: getPatternSize(power),
      };
    })
  );

  return {
    id: response.id,
    name: response.name,
    types: response.types.map(({ type }) => type.name),
    stats: {
      hp: getStat(response.stats, 'hp'),
      attack: getStat(response.stats, 'attack'),
      defense: getStat(response.stats, 'defense'),
    },
    captureRate: species.capture_rate,
    spriteUrl: response.sprites.other?.['official-artwork']?.front_default ?? null,
    moves,
  };
}
