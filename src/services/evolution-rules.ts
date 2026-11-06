import type { EvolutionOption } from '@/types/game';

export interface EvolutionDetails {
  trigger: { name: string } | null;
  min_level: number | null;
  item: { name: string } | null;
  gender: number | null;
  held_item: { name: string } | null;
  known_move: { name: string } | null;
  known_move_type: { name: string } | null;
  location: { name: string } | null;
  min_happiness: number | null;
  min_beauty: number | null;
  min_affection: number | null;
  needs_overworld_rain: boolean;
  party_species: { name: string } | null;
  party_type: { name: string } | null;
  relative_physical_stats: number | null;
  time_of_day: string;
  trade_species: { name: string } | null;
  turn_upside_down: boolean;
}

const NON_LEVEL_REQUIREMENTS: (keyof EvolutionDetails)[] = [
  'item',
  'gender',
  'held_item',
  'known_move',
  'known_move_type',
  'location',
  'min_happiness',
  'min_beauty',
  'min_affection',
  'needs_overworld_rain',
  'party_species',
  'party_type',
  'relative_physical_stats',
  'time_of_day',
  'trade_species',
  'turn_upside_down',
];

export function getEvolutionMinimumLevel(details: EvolutionDetails): number {
  const hasNonLevelRequirement = NON_LEVEL_REQUIREMENTS.some((key) => {
    const value = details[key];
    return typeof value === 'boolean' ? value : value !== null && value !== '';
  });

  if (
    hasNonLevelRequirement ||
    details.trigger?.name !== 'level-up' ||
    details.min_level === null
  ) {
    return 30;
  }
  return details.min_level;
}

export function getNewlyUnlockedEvolutions(
  options: EvolutionOption[],
  previousLevel: number,
  currentLevel: number
): EvolutionOption[] {
  return options.filter(
    (option) =>
      option.minimumLevel > previousLevel &&
      option.minimumLevel <= currentLevel
  );
}
