import type { Pokemon, PokemonMove, StatusEffect } from '@/types/game';

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
  is_legendary: boolean;
  is_mythical: boolean;
}

interface TypeApiResponse {
  pokemon: { pokemon: { url: string } }[];
}

interface MoveApiResponse {
  accuracy: number | null;
  damage_class: { name: string };
  meta: {
    ailment: { name: string } | null;
    ailment_chance: number;
  } | null;
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

function getStatusEffect(ailment: string | null | undefined): StatusEffect | null {
  switch (ailment) {
    case 'burn':
    case 'poison':
    case 'freeze':
    case 'paralysis':
    case 'sleep':
      return ailment;
    default:
      return null;
  }
}

function getStatusChance(move: MoveApiResponse, statusEffect: StatusEffect | null): number {
  if (!statusEffect) return 0;
  return move.meta && move.meta.ailment_chance > 0
    ? Math.min(100, move.meta.ailment_chance)
    : move.damage_class.name === 'status'
      ? 100
      : 0;
}

export async function fetchPokemon(id: number): Promise<Pokemon> {
  const response = await fetchJson<PokemonApiResponse>(`${API_BASE_URL}/pokemon/${id}`);
  const species = await fetchJson<SpeciesApiResponse>(response.species.url);
  const moves = await Promise.all(
    response.moves.slice(0, 4).map(async ({ move }) => {
      const details = await fetchJson<MoveApiResponse>(move.url);
      const power = details.power ?? 20;
      const statusEffect = getStatusEffect(details.meta?.ailment?.name);
      return {
        name: move.name,
        type: details.type.name,
        power,
        patternSize: getPatternSize(power),
        accuracy: details.accuracy,
        statusEffect,
        statusChance: getStatusChance(details, statusEffect),
      };
    })
  );

  return {
    id: response.id,
    name: response.name,
    types: response.types.map(({ type }) => type.name),
    isLegendary: species.is_legendary,
    isMythical: species.is_mythical,
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

export async function fetchPokemonIdsForTypes(types: string[]): Promise<number[]> {
  const typeResponses = await Promise.all(
    types.map((type) => fetchJson<TypeApiResponse>(`${API_BASE_URL}/type/${type}`))
  );
  const ids = new Set<number>();
  for (const response of typeResponses) {
    for (const entry of response.pokemon) {
      const match = entry.pokemon.url.match(/\/pokemon\/(\d+)\/?$/);
      const id = match ? Number(match[1]) : 0;
      if (id > 0 && id < 10000) ids.add(id);
    }
  }
  return [...ids];
}

export async function fetchPokemonClassification(
  id: number
): Promise<Pick<Pokemon, 'id' | 'types' | 'isLegendary' | 'isMythical'>> {
  const response = await fetchJson<PokemonApiResponse>(`${API_BASE_URL}/pokemon/${id}`);
  const species = await fetchJson<SpeciesApiResponse>(response.species.url);
  return {
    id: response.id,
    types: response.types.map(({ type }) => type.name),
    isLegendary: species.is_legendary,
    isMythical: species.is_mythical,
  };
}
