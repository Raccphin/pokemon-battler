import type { PlayerProfile } from "@/types/game";

export interface AreaDefinition {
  id: string;
  name: string;
  favoredTypes: string[];
  startingPokemonId: number;
  specialBossCandidateIds: number[];
}

export const AREA_PROGRESSION_CONFIG = {
  encountersPerArea: 10,
  startingLevel: 1,
  levelsPerArea: 5,
  regularOpponentLevelsPerArea: 2,
  bossOpponentLevelBonus: 1,
  specialBossChance: 0.5,
  bossAttackMultiplier: 1.25,
  bossExtraRows: 1,
  bossExtraColumns: 1,
} as const;

export const AREAS: AreaDefinition[] = [
  {
    id: "forest",
    name: "Forest",
    favoredTypes: ["grass", "bug", "fairy"],
    startingPokemonId: 10,
    specialBossCandidateIds: [251, 492, 649, 716, 787, 801],
  },
  {
    id: "jungle",
    name: "Jungle",
    favoredTypes: ["grass", "bug", "poison"],
    startingPokemonId: 13,
    specialBossCandidateIds: [251, 492, 649, 787],
  },
  {
    id: "cave",
    name: "Cave",
    favoredTypes: ["rock", "ground", "dark"],
    startingPokemonId: 74,
    specialBossCandidateIds: [377, 383, 491, 645, 717, 718, 720],
  },
  {
    id: "volcano",
    name: "Volcano",
    favoredTypes: ["fire", "rock", "ground"],
    startingPokemonId: 4,
    specialBossCandidateIds: [146, 244, 250, 383, 485, 645, 721],
  },
  {
    id: "mountain",
    name: "Mountain",
    favoredTypes: ["rock", "flying", "ice"],
    startingPokemonId: 41,
    specialBossCandidateIds: [144, 377, 378, 641, 646],
  },
  {
    id: "desert",
    name: "Desert",
    favoredTypes: ["ground", "rock", "fire"],
    startingPokemonId: 27,
    specialBossCandidateIds: [244, 377, 383, 485, 645],
  },
  {
    id: "beach",
    name: "Beach",
    favoredTypes: ["water", "ground", "flying"],
    startingPokemonId: 7,
    specialBossCandidateIds: [245, 249, 382, 641, 645, 788],
  },
  {
    id: "ocean",
    name: "Icy Ocean",
    favoredTypes: ["water", "ice"],
    startingPokemonId: 90,
    specialBossCandidateIds: [144, 245, 378, 382, 484, 489, 490, 647],
  },
  {
    id: "river",
    name: "River",
    favoredTypes: ["water", "grass"],
    startingPokemonId: 43,
    specialBossCandidateIds: [251, 489, 490, 492, 787],
  },
  {
    id: "swamp",
    name: "Swamp / Bog",
    favoredTypes: ["water", "poison", "grass"],
    startingPokemonId: 43,
    specialBossCandidateIds: [251, 489, 490, 492, 649],
  },
  {
    id: "snowfield",
    name: "Snowfield",
    favoredTypes: ["ice", "water"],
    startingPokemonId: 86,
    specialBossCandidateIds: [144, 378, 382, 646, 896],
  },
  {
    id: "ruins",
    name: "Ruins",
    favoredTypes: ["psychic", "ghost", "rock"],
    startingPokemonId: 92,
    specialBossCandidateIds: [150, 151, 377, 385, 386, 480, 481, 482, 487],
  },
  {
    id: "graveyard",
    name: "Graveyard",
    favoredTypes: ["ghost", "dark"],
    startingPokemonId: 92,
    specialBossCandidateIds: [487, 491, 717, 720, 792, 802, 897],
  },
  {
    id: "city",
    name: "City",
    favoredTypes: ["normal", "electric", "steel"],
    startingPokemonId: 19,
    specialBossCandidateIds: [145, 243, 486, 493, 649, 801, 888, 1008],
  },
  {
    id: "power-plant",
    name: "Power Plant",
    favoredTypes: ["electric", "steel"],
    startingPokemonId: 100,
    specialBossCandidateIds: [
      145, 243, 638, 642, 644, 649, 801, 808, 809, 1008,
    ],
  },
  {
    id: "laboratory",
    name: "Laboratory",
    favoredTypes: ["psychic", "poison", "steel"],
    startingPokemonId: 81,
    specialBossCandidateIds: [150, 151, 386, 491, 649, 801, 809],
  },
  {
    id: "fairy-grove",
    name: "Fairy Grove",
    favoredTypes: ["fairy", "grass", "psychic"],
    startingPokemonId: 35,
    specialBossCandidateIds: [151, 251, 385, 492, 716, 719, 786, 787, 788, 801],
  },
  {
    id: "dragon-cave",
    name: "Dragon Cave",
    favoredTypes: ["dragon", "rock", "ground"],
    startingPokemonId: 147,
    specialBossCandidateIds: [
      377, 383, 384, 643, 644, 645, 646, 718, 799, 1007, 1008,
    ],
  },
  {
    id: "space",
    name: "Space / Outer Space",
    favoredTypes: ["psychic", "steel", "electric"],
    startingPokemonId: 63,
    specialBossCandidateIds: [
      150, 151, 385, 386, 483, 484, 649, 801, 808, 809, 1008,
    ],
  },
  {
    id: "ancient-ruins",
    name: "Ancient Ruins",
    favoredTypes: ["ghost", "psychic", "steel"],
    startingPokemonId: 201,
    specialBossCandidateIds: [
      150, 151, 385, 386, 480, 481, 482, 483, 487, 493, 649, 801, 809,
    ],
  },
  {
    id: "dojo",
    name: "Dojo",
    favoredTypes: ["fighting", "psychic", "steel"],
    startingPokemonId: 66,
    specialBossCandidateIds: [385, 386, 638, 639, 640, 647, 802, 888, 889],
  },
];

export interface NextEncounterProgress {
  areaId: string;
  areaNumber: number;
  encounterIndex: number;
  opponentLevel: number;
  isAreaBoss: boolean;
}

export function getAreaById(areaId: string): AreaDefinition {
  const area = AREAS.find((candidate) => candidate.id === areaId);
  if (!area) throw new Error(`Unknown area: ${areaId}`);
  return area;
}

export function getRandomArea(randomValue = Math.random()): AreaDefinition {
  const index = Math.min(
    AREAS.length - 1,
    Math.floor(randomValue * AREAS.length),
  );
  return AREAS[index];
}

export function getProgressionLevel(areaNumber: number): number {
  return (
    AREA_PROGRESSION_CONFIG.startingLevel +
    (areaNumber - 1) * AREA_PROGRESSION_CONFIG.levelsPerArea
  );
}

export function getOpponentProgressionLevel(
  areaNumber: number,
  encounterIndex: number,
): number {
  const regularEncounters = AREA_PROGRESSION_CONFIG.encountersPerArea - 1;
  const lastRegularEncounterIndex = regularEncounters - 1;
  const regularLevelOffset = Math.floor(
    (Math.min(encounterIndex, lastRegularEncounterIndex) *
      AREA_PROGRESSION_CONFIG.regularOpponentLevelsPerArea) /
      lastRegularEncounterIndex,
  );
  const bossLevelOffset =
    encounterIndex >= regularEncounters
      ? AREA_PROGRESSION_CONFIG.bossOpponentLevelBonus
      : 0;
  return (
    getProgressionLevel(areaNumber) + regularLevelOffset + bossLevelOffset
  );
}

export function getPlayerProgressionLevel(
  areaNumber: number,
  encounterIndex: number,
): number {
  const encounterLevelOffset = Math.floor(
    (encounterIndex * AREA_PROGRESSION_CONFIG.levelsPerArea) /
      AREA_PROGRESSION_CONFIG.encountersPerArea,
  );
  return getProgressionLevel(areaNumber) + encounterLevelOffset;
}

export function getNextEncounterProgress(
  profile: Pick<PlayerProfile, "areaId" | "areaNumber" | "encounterIndex">,
  nextAreaId = profile.areaId,
): NextEncounterProgress {
  const nextArea =
    profile.encounterIndex + 1 >= AREA_PROGRESSION_CONFIG.encountersPerArea;
  const areaNumber = profile.areaNumber + Number(nextArea);
  const encounterIndex = nextArea ? 0 : profile.encounterIndex + 1;
  return {
    areaId: nextArea ? nextAreaId : profile.areaId,
    areaNumber,
    encounterIndex,
    opponentLevel: getOpponentProgressionLevel(areaNumber, encounterIndex),
    isAreaBoss:
      encounterIndex === AREA_PROGRESSION_CONFIG.encountersPerArea - 1,
  };
}

export function chooseRandom<T>(
  values: readonly T[],
  randomValue = Math.random(),
): T | undefined {
  if (values.length === 0) return undefined;
  const index = Math.min(
    values.length - 1,
    Math.floor(randomValue * values.length),
  );
  return values[index];
}
