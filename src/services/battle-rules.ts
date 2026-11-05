import type { Pokemon, PokemonMove } from '@/types/game';
import { AREA_PROGRESSION_CONFIG } from '@/services/area-progression';

export interface GridDimensions {
  rows: number;
  columns: number;
}

export interface CatchResult {
  success: boolean;
  chance: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function getBossGridDimensions(pokemon: Pokemon, isAreaBoss = false): GridDimensions {
  const columns = 6;
  const rows = clamp(Math.ceil((pokemon.stats.hp + pokemon.stats.defense) / 45), 3, 6);
  return {
    rows: rows + (isAreaBoss ? AREA_PROGRESSION_CONFIG.bossExtraRows : 0),
    columns: columns + (isAreaBoss ? AREA_PROGRESSION_CONFIG.bossExtraColumns : 0),
  };
}

export function getPatternCells(
  row: number,
  column: number,
  size: PokemonMove['patternSize'],
  dimensions: GridDimensions
): number[] {
  const cells: number[] = [];
  for (let patternRow = 0; patternRow < size; patternRow += 1) {
    for (let patternColumn = 0; patternColumn < size; patternColumn += 1) {
      const targetRow = row + patternRow;
      const targetColumn = column + patternColumn;
      if (targetRow < dimensions.rows && targetColumn < dimensions.columns) {
        cells.push(targetRow * dimensions.columns + targetColumn);
      }
    }
  }
  return cells;
}

export function getBossAttack(
  pokemon: Pokemon,
  turn: number,
  isAreaBoss = false
): { move: PokemonMove; damage: number } {
  const move = pokemon.moves[turn % pokemon.moves.length];
  const attack = isAreaBoss
    ? pokemon.stats.attack * AREA_PROGRESSION_CONFIG.bossAttackMultiplier
    : pokemon.stats.attack;
  const damage = clamp(Math.ceil(attack / 15) + Math.ceil(move.power / 45), 4, 30);
  return { move, damage };
}

export function getPlayerMaxHp(baseHp: number): number {
  return Math.max(80, baseHp + 60);
}

export function calculateCatchResult(
  captureRate: number,
  remainingCells: number,
  totalCells: number,
  ballMultiplier: number,
  roll: number
): CatchResult {
  const healthRatio = totalCells === 0 ? 1 : remainingCells / totalCells;
  const chance = clamp(0.03 + (captureRate / 255) * ballMultiplier + (1 - healthRatio) * 0.45, 0.03, 0.9);
  return { success: roll < chance, chance };
}

export function getBallDetails(ball: 'pokeBall' | 'greatBall' | 'ultraBall') {
  switch (ball) {
    case 'greatBall':
      return { label: 'Great Ball', multiplier: 1.5, count: 2 };
    case 'ultraBall':
      return { label: 'Ultra Ball', multiplier: 2, count: 3 };
    default:
      return { label: 'Poké Ball', multiplier: 1, count: 1 };
  }
}

export function getMoveLabel(move: string): string {
  return move
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
