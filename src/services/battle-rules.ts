import type { Pokemon, PokemonMove, StatusEffect } from '@/types/game';
import { AREA_PROGRESSION_CONFIG } from '@/services/area-progression';
import { getMovePatternPower } from '@/services/move-patterns';

export interface GridDimensions {
  rows: number;
  columns: number;
}

export interface CatchResult {
  success: boolean;
  chance: number;
}

export interface StatusTurnResult {
  cells: boolean[];
  statuses: (StatusEffect | null)[];
  statusFresh: boolean[];
  opponentSkipped: boolean;
}

export interface GridAttackResult {
  cells: boolean[];
  statuses: (StatusEffect | null)[];
  statusFresh: boolean[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const STATUS_OUTCOME_CHANCE = 1 / 3;

export function getMoveStatusChance(move: PokemonMove): number {
  return (move.accuracy ?? 100) * move.statusChance / 100;
}

export function doesMoveHit(move: PokemonMove, random: () => number = Math.random): boolean {
  const accuracy = (move.accuracy ?? 100) / 100;
  return accuracy >= 1 || (accuracy > 0 && random() < accuracy);
}

export function applyMovePattern(
  cells: boolean[],
  statuses: (StatusEffect | null)[],
  statusFresh: boolean[],
  hitCells: number[],
  move: PokemonMove,
  random: () => number = Math.random
): GridAttackResult {
  if (cells.length !== statuses.length || cells.length !== statusFresh.length) {
    throw new Error('The boss grid and its status effects do not match.');
  }

  const nextCells = [...cells];
  const nextStatuses = [...statuses];
  const nextStatusFresh = [...statusFresh];
  const intactHitCells = hitCells.filter((index) => cells[index]);
  const chance = move.statusChance / 100;
  const appliesStatus =
    move.statusEffect !== null &&
    (chance >= 1 || (chance > 0 && random() < chance));

  for (const index of intactHitCells) {
    if (appliesStatus) {
      nextStatuses[index] = move.statusEffect;
      nextStatusFresh[index] = true;
    } else {
      nextCells[index] = false;
      nextStatuses[index] = null;
      nextStatusFresh[index] = false;
    }
  }

  return {
    cells: nextCells,
    statuses: nextStatuses,
    statusFresh: nextStatusFresh,
  };
}

function getAdjacentCells(index: number, dimensions: GridDimensions): number[] {
  const row = Math.floor(index / dimensions.columns);
  const column = index % dimensions.columns;
  const adjacent: number[] = [];
  if (row > 0) adjacent.push(index - dimensions.columns);
  if (row < dimensions.rows - 1) adjacent.push(index + dimensions.columns);
  if (column > 0) adjacent.push(index - 1);
  if (column < dimensions.columns - 1) adjacent.push(index + 1);
  return adjacent;
}

export function resolveStatusTurn(
  cells: boolean[],
  statuses: (StatusEffect | null)[],
  dimensions: GridDimensions,
  statusFresh: boolean[],
  random: () => number = Math.random
): StatusTurnResult {
  if (
    cells.length !== statuses.length ||
    cells.length !== statusFresh.length ||
    cells.length !== dimensions.rows * dimensions.columns
  ) {
    throw new Error('The saved boss grid and its status effects do not match.');
  }

  const nextCells = [...cells];
  const nextStatuses = [...statuses];
  const wasFresh = [...statusFresh];
  const nextStatusFresh = Array.from({ length: statuses.length }, () => false);

  for (let index = 0; index < statuses.length; index += 1) {
    const status = statuses[index];
    if (
      !cells[index] ||
      wasFresh[index] ||
      (status !== 'burn' && status !== 'poison')
    ) {
      continue;
    }

    const outcome = random();
    if (outcome < STATUS_OUTCOME_CHANCE) continue;
    if (outcome < STATUS_OUTCOME_CHANCE * 2) {
      const adjacentHpCells = getAdjacentCells(index, dimensions).filter(
        (adjacent) => nextCells[adjacent] && nextStatuses[adjacent] === null
      );
      if (adjacentHpCells.length > 0) {
        const target = adjacentHpCells[Math.floor(random() * adjacentHpCells.length)];
        nextCells[target] = false;
        nextStatuses[target] = status;
        nextStatusFresh[target] = true;
      }
      continue;
    }

    nextCells[index] = false;
    nextStatuses[index] = null;
    nextStatusFresh[index] = false;
  }

  const stallingTileCount = nextStatuses.filter(
    (status, index) =>
      nextCells[index] &&
      (status === 'freeze' || status === 'paralysis' || status === 'sleep')
  ).length;
  const skipChance = 1 - (1 - STATUS_OUTCOME_CHANCE) ** stallingTileCount;
  const opponentSkipped = stallingTileCount > 0 && random() < skipChance;

  return {
    cells: nextCells,
    statuses: nextStatuses,
    statusFresh: nextStatusFresh,
    opponentSkipped,
  };
}

export function getBossGridDimensions(pokemon: Pokemon, isAreaBoss = false): GridDimensions {
  const columns = 6;
  const rows = clamp(Math.ceil((pokemon.stats.hp + pokemon.stats.defense) / 45), 3, 6);
  return {
    rows: rows + (isAreaBoss ? AREA_PROGRESSION_CONFIG.bossExtraRows : 0),
    columns: columns + (isAreaBoss ? AREA_PROGRESSION_CONFIG.bossExtraColumns : 0),
  };
}

export function getBossAttack(
  pokemon: Pokemon,
  random: () => number = Math.random,
  isAreaBoss = false,
  currentGridHp = 1,
  maximumGridHp = 1,
  level = 1
): { move: PokemonMove | null; damage: number } {
  if (pokemon.moves.length === 0) return { move: null, damage: 0 };
  const index = Math.min(
    pokemon.moves.length - 1,
    Math.floor(random() * pokemon.moves.length)
  );
  const move = pokemon.moves[index];
  const attack = isAreaBoss
    ? pokemon.stats.attack * AREA_PROGRESSION_CONFIG.bossAttackMultiplier
    : pokemon.stats.attack;
  const power = getMovePatternPower(move, {
    level,
    currentHp: currentGridHp,
    maxHp: maximumGridHp,
    lastPhysicalDamageTaken: 0,
  });
  const damage =
    power === null
      ? 0
      : clamp(Math.ceil(attack / 15) + Math.ceil(power / 45), 4, 30);
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
