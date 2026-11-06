import type { StatusEffect } from '@/types/game';
import type { GridDimensions } from '@/services/battle-rules';

export const OPPONENT_GRID_LAYOUT_VERSION = 1;

export interface OpponentGridState {
  cells: boolean[];
  statuses: (StatusEffect | null)[];
  statusFresh: boolean[];
}

function normalizedPosition(position: number, size: number): number {
  return size > 1 ? position / (size - 1) : 0.5;
}

function distanceToPoint(
  x: number,
  y: number,
  centerX: number,
  centerY: number
): number {
  return Math.hypot(x - centerX, y - centerY);
}

function getPatternPriority(
  type: string,
  row: number,
  column: number,
  dimensions: GridDimensions
): number {
  const x = normalizedPosition(column, dimensions.columns);
  const y = normalizedPosition(row, dimensions.rows);
  const centerX = 0.5;
  const centerY = 0.5;
  const edgeDistance = Math.min(x, 1 - x, y, 1 - y);
  const clusterDistance = (centers: [number, number][]) =>
    Math.min(
      ...centers.map(([centerClusterX, centerClusterY]) =>
        distanceToPoint(x, y, centerClusterX, centerClusterY)
      )
    );

  switch (type) {
    case 'fire':
      return Math.abs(x - centerX) - y * 0.35;
    case 'water': {
      const waveCenter = centerX + Math.sin(y * Math.PI * 2) * 0.3;
      return Math.abs(x - waveCenter) + y * 0.05;
    }
    case 'electric': {
      const zigzagCenter =
        centerX + (Math.abs(((y * 4) % 2) - 1) - 0.5) * 0.7;
      return Math.abs(x - zigzagCenter);
    }
    case 'grass': {
      const branchCenter = y < 0.5 ? 0.5 - y * 0.55 : 0.225 + (y - 0.5) * 0.55;
      return Math.min(
        Math.abs(x - centerX),
        Math.abs(x - branchCenter),
        Math.abs(x - (1 - branchCenter))
      );
    }
    case 'ice':
      return Math.abs(x - centerX) + Math.abs(y - centerY);
    case 'fighting':
      return Math.min(Math.abs(x - centerX), Math.abs(y - centerY));
    case 'poison':
      return clusterDistance([
        [0.2, 0.25],
        [0.75, 0.35],
        [0.35, 0.8],
        [0.85, 0.8],
      ]);
    case 'ground':
      return 1 - y + Math.abs(x - centerX) * 0.2;
    case 'flying': {
      const wingSpread = (y - centerY) * 0.8;
      return Math.min(
        Math.abs(x - (centerX - wingSpread)),
        Math.abs(x - (centerX + wingSpread))
      );
    }
    case 'psychic': {
      const dx = x - centerX;
      const dy = y - centerY;
      const angle = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2);
      const radius = Math.hypot(dx, dy);
      return Math.abs(radius - angle * 0.35);
    }
    case 'bug':
      return clusterDistance([
        [0.25, 0.25],
        [0.75, 0.25],
        [0.5, 0.5],
        [0.25, 0.75],
        [0.75, 0.75],
      ]);
    case 'rock':
      return edgeDistance;
    case 'ghost': {
      const radius = Math.hypot(x - centerX, y - centerY);
      const angle = (Math.atan2(y - centerY, x - centerX) + Math.PI) / (Math.PI * 2);
      return Math.abs(radius - angle * 0.35) + (angle > 0.42 && angle < 0.58 ? 0.2 : 0);
    }
    case 'dragon': {
      const branch = Math.abs(y - centerY) * 0.65;
      return Math.min(
        Math.abs(x - centerX),
        Math.abs(x - (centerX - branch)),
        Math.abs(x - (centerX + branch))
      );
    }
    case 'dark': {
      const radius = Math.hypot(x - 0.35, y - centerY);
      const angle = Math.atan2(y - centerY, x - 0.35);
      return Math.abs(radius - 0.4) + (angle < -0.15 || angle > 0.15 ? 0 : 0.2);
    }
    case 'steel':
      return (
        Math.abs(((x * 4) % 1) - 0.5) +
        Math.abs(((y * 4) % 1) - 0.5)
      );
    case 'fairy':
      return clusterDistance([
        [0.5, 0.18],
        [0.82, 0.5],
        [0.5, 0.82],
        [0.18, 0.5],
      ]);
    case 'normal':
    default:
      return row * dimensions.columns + column;
  }
}

export function getOpponentGridBlockIndexes(
  types: readonly string[],
  dimensions: GridDimensions,
  blockCount: number
): number[] {
  const primaryType = types[0] ?? 'normal';
  const secondaryType = types[1];
  const indexes = Array.from(
    { length: dimensions.rows * dimensions.columns },
    (_, index) => index
  );
  indexes.sort((left, right) => {
    const leftRow = Math.floor(left / dimensions.columns);
    const leftColumn = left % dimensions.columns;
    const rightRow = Math.floor(right / dimensions.columns);
    const rightColumn = right % dimensions.columns;
    return (
      getPatternPriority(primaryType, leftRow, leftColumn, dimensions) -
        getPatternPriority(primaryType, rightRow, rightColumn, dimensions) ||
      left - right
    );
  });

  const selected = indexes.slice(
    0,
    Math.max(0, Math.min(blockCount, indexes.length))
  );
  if (!secondaryType) return selected;

  return selected.map((index) => {
    const row = Math.floor(index / dimensions.columns);
    const column = index % dimensions.columns;
    const flippedRow = dimensions.rows - row - 1;
    const flippedColumn = dimensions.columns - column - 1;
    return flippedRow * dimensions.columns + flippedColumn;
  });
}

export function createOpponentGrid(
  types: readonly string[],
  dimensions: GridDimensions,
  blockCount: number
): boolean[] {
  const cells = Array.from(
    { length: dimensions.rows * dimensions.columns },
    () => false
  );
  for (const index of getOpponentGridBlockIndexes(types, dimensions, blockCount)) {
    cells[index] = true;
  }
  return cells;
}

export function migrateOpponentGrid(
  oldCells: boolean[],
  oldStatuses: (StatusEffect | null)[],
  oldStatusFresh: boolean[],
  initialCells: boolean[]
): OpponentGridState {
  const cells = [...initialCells];
  const statuses = Array.from(
    { length: cells.length },
    (): StatusEffect | null => null
  );
  const statusFresh = Array.from({ length: cells.length }, () => false);
  const oldOccupied = oldCells.flatMap((occupied, index) =>
    occupied ? [index] : []
  );
  const newOccupied = cells.flatMap((occupied, index) =>
    occupied ? [index] : []
  );

  if (oldCells.length === 0 || oldOccupied.length === 0) {
    if (oldCells.length === 0) {
      return { cells, statuses, statusFresh };
    }
    return {
      cells: cells.map(() => false),
      statuses,
      statusFresh,
    };
  }

  const remainingCount = Math.min(
    newOccupied.length,
    Math.max(
      1,
      Math.round((oldOccupied.length / oldCells.length) * newOccupied.length)
    )
  );
  const retainedIndexes = newOccupied.slice(0, remainingCount);
  const migratedCells = cells.map(() => false);

  retainedIndexes.forEach((newIndex, index) => {
    const oldIndex = oldOccupied[index];
    migratedCells[newIndex] = true;
    statuses[newIndex] = oldStatuses[oldIndex] ?? null;
    statusFresh[newIndex] = oldStatusFresh[oldIndex] ?? false;
  });

  return {
    cells: migratedCells,
    statuses,
    statusFresh,
  };
}
