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
  moves: {
    move: { name: string; url: string };
    version_group_details: {
      level_learned_at: number;
      move_learn_method: { name: string };
      version_group: { url: string };
    }[];
  }[];
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
    category: { name: string } | null;
    max_hits: number | null;
  } | null;
  power: number | null;
  type: { name: string };
}

export interface LevelUpMove extends PokemonMove {
  learnedAtLevel: number;
}

export interface ShopLearnableMove extends PokemonMove {
  learnedAtLevel: number;
  learnMethod: 'level-up' | 'machine';
}

const API_BASE_URL = 'https://pokeapi.co/api/v2';
// PokeAPI also assigns later IDs to side games and retro releases.
const MAINLINE_VERSION_GROUP_IDS = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
  25, 26, 27,
]);
const NULL_POWER_MOVE_OVERRIDES = new Set([
  'counter',
  'flail',
  'night-shade',
  'sonic-boom',
  'seismic-toss',
  'dragon-rage',
  'super-fang',
  'psywave',
  'gyro-ball',
]);

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PokéAPI request failed (${response.status}): ${url}`);
  }
  return (await response.json()) as T;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(values[index]);
      }
    })
  );
  return results;
}

function getLatestMainlineVersionGroupId(
  pokemon: PokemonApiResponse,
  learnMethods: readonly string[]
): number | undefined {
  const versionGroupIds = pokemon.moves.flatMap(({ version_group_details }) =>
    version_group_details.flatMap((details) => {
      if (!learnMethods.includes(details.move_learn_method.name)) return [];
      const versionGroupId = Number(details.version_group.url.match(/\/(\d+)\/?$/)?.[1]);
      return MAINLINE_VERSION_GROUP_IDS.has(versionGroupId) ? [versionGroupId] : [];
    })
  );
  return versionGroupIds.length > 0 ? Math.max(...versionGroupIds) : undefined;
}

function getMoveMethodRecords(
  pokemon: PokemonApiResponse,
  learnMethod: 'level-up' | 'machine',
  versionGroupId: number
): Map<string, number> {
  const moves = new Map<string, number>();
  for (const entry of pokemon.moves) {
    for (const details of entry.version_group_details) {
      const id = Number(details.version_group.url.match(/\/(\d+)\/?$/)?.[1]);
      if (
        details.move_learn_method.name !== learnMethod ||
        id !== versionGroupId
      ) {
        continue;
      }
      const level = details.level_learned_at;
      if (!moves.has(entry.move.name) || level < moves.get(entry.move.name)!) {
        moves.set(entry.move.name, level);
      }
    }
  }
  return moves;
}

function getStat(stats: PokemonApiResponse['stats'], name: string): number {
  const stat = stats.find((entry) => entry.stat.name === name);
  if (!stat) {
    throw new Error(`PokéAPI response is missing the ${name} stat.`);
  }
  return stat.base_stat;
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

function getMove(move: MoveApiResponse, name: string): PokemonMove {
  const statusEffect = getStatusEffect(move.meta?.ailment?.name);
  return {
    name,
    type: move.type.name,
    power: move.power,
    damageClass: move.damage_class.name,
    category: move.meta?.category?.name ?? null,
    maxHits: move.meta?.max_hits ?? 1,
    accuracy: move.accuracy,
    statusEffect,
    statusChance: getStatusChance(move, statusEffect),
  };
}

function isSupportedMove(move: PokemonMove): boolean {
  return (
    move.damageClass === 'status' ||
    move.power !== null ||
    move.category === 'ohko' ||
    NULL_POWER_MOVE_OVERRIDES.has(move.name)
  );
}

export async function fetchPokemonMoves(moveNames: string[]): Promise<PokemonMove[]> {
  const uniqueNames = [...new Set(moveNames)];
  const moves = await mapWithConcurrency(uniqueNames, 8, async (name) => {
    const details = await fetchJson<MoveApiResponse>(`${API_BASE_URL}/move/${name}`);
    return getMove(details, name);
  });
  return moves.filter(isSupportedMove);
}

export async function fetchPokemonLevelUpMoves(
  pokemonId: number,
  level: number
): Promise<LevelUpMove[]> {
  const pokemon = await fetchJson<PokemonApiResponse>(`${API_BASE_URL}/pokemon/${pokemonId}`);
  const latestVersionGroupId = getLatestMainlineVersionGroupId(pokemon, ['level-up']);
  if (latestVersionGroupId === undefined) return [];
  const latestMoves = getMoveMethodRecords(pokemon, 'level-up', latestVersionGroupId);
  const eligibleMoves = [...latestMoves].filter(([, learnedAtLevel]) => learnedAtLevel <= level);
  const moves = await fetchPokemonMoves(eligibleMoves.map(([name]) => name));
  return moves
    .map((move) => ({
      ...move,
      learnedAtLevel: latestMoves.get(move.name) ?? 0,
    }))
    .sort((left, right) => left.learnedAtLevel - right.learnedAtLevel || left.name.localeCompare(right.name));
}

export async function fetchPokemonShopMoves(
  pokemonId: number,
  level: number
): Promise<ShopLearnableMove[]> {
  const pokemon = await fetchJson<PokemonApiResponse>(`${API_BASE_URL}/pokemon/${pokemonId}`);
  const latestLevelGroup = getLatestMainlineVersionGroupId(pokemon, ['level-up']);
  const latestMachineGroup = getLatestMainlineVersionGroupId(pokemon, ['machine']);
  const available = new Map<
    string,
    { learnedAtLevel: number; learnMethod: ShopLearnableMove['learnMethod'] }
  >();

  if (latestLevelGroup !== undefined) {
    for (const [name, learnedAtLevel] of getMoveMethodRecords(
      pokemon,
      'level-up',
      latestLevelGroup
    )) {
      if (learnedAtLevel <= level) {
        available.set(name, { learnedAtLevel, learnMethod: 'level-up' });
      }
    }
  }
  if (latestMachineGroup !== undefined) {
    for (const [name, learnedAtLevel] of getMoveMethodRecords(
      pokemon,
      'machine',
      latestMachineGroup
    )) {
      if (!available.has(name)) {
        available.set(name, { learnedAtLevel, learnMethod: 'machine' });
      }
    }
  }

  const moves = await fetchPokemonMoves([...available.keys()]);
  return moves
    .map((move) => ({
      ...move,
      ...available.get(move.name)!,
    }))
    .sort(
      (left, right) =>
        Number(left.learnMethod === 'machine') - Number(right.learnMethod === 'machine') ||
        left.learnedAtLevel - right.learnedAtLevel ||
        left.name.localeCompare(right.name)
    );
}

export async function fetchPokemon(
  id: number,
  moveNames: string[] = []
): Promise<Pokemon> {
  const response = await fetchJson<PokemonApiResponse>(`${API_BASE_URL}/pokemon/${id}`);
  const species = await fetchJson<SpeciesApiResponse>(response.species.url);
  const moves = await fetchPokemonMoves(moveNames);

  return {
    id: response.id,
    name: response.name,
    types: response.types.map(({ type }) => type.name),
    isLegendary: species.is_legendary,
    isMythical: species.is_mythical,
    stats: {
      hp: getStat(response.stats, 'hp'),
      attack: getStat(response.stats, 'attack'),
      specialAttack: getStat(response.stats, 'special-attack'),
      defense: getStat(response.stats, 'defense'),
      speed: getStat(response.stats, 'speed'),
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

export async function fetchPokemonStarterData(id: number): Promise<{
  id: number;
  name: string;
  types: string[];
  hp: number;
  spriteUrl: string | null;
}> {
  const response = await fetchJson<PokemonApiResponse>(`${API_BASE_URL}/pokemon/${id}`);
  return {
    id: response.id,
    name: response.name,
    types: response.types.map(({ type }) => type.name),
    hp: getStat(response.stats, 'hp'),
    spriteUrl: response.sprites.other?.['official-artwork']?.front_default ?? null,
  };
}
