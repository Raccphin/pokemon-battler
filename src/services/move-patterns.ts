import type {
  MovePattern,
  MovePatternCell,
  PokemonMove,
} from '@/types/game';

export interface MovePatternContext {
  level: number;
  currentHp: number;
  maxHp: number;
  lastPhysicalDamageTaken: number;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashCell(moveName: string, row: number, column: number): number {
  return hashString(`${moveName}:${row}:${column}`);
}

function getCenterOffset(size: number): number {
  return size % 2 === 0 ? size / 2 - 1 : Math.floor(size / 2);
}

function getFootprintSize(stat: number): number {
  if (stat >= 130) return 5;
  if (stat >= 100) return 4;
  if (stat >= 70) return 3;
  if (stat >= 40) return 2;
  return 1;
}

function getFlailPower(currentHp: number, maxHp: number): number {
  const hpFraction = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 1;
  const powerIndex = Math.floor(64 * hpFraction);
  if (powerIndex <= 1) return 200;
  if (powerIndex <= 5) return 150;
  if (powerIndex <= 12) return 100;
  if (powerIndex <= 21) return 80;
  if (powerIndex <= 42) return 40;
  return 20;
}

export function getMovePatternPower(
  move: PokemonMove,
  context: MovePatternContext
): number | null {
  if (move.power !== null) return move.power;
  if (move.category === 'ohko') return 250;

  switch (move.name) {
    case 'counter':
      return context.lastPhysicalDamageTaken > 0
        ? context.lastPhysicalDamageTaken * 2
        : null;
    case 'flail':
      return getFlailPower(context.currentHp, context.maxHp);
    case 'night-shade':
    case 'seismic-toss':
    case 'psywave':
      return context.level;
    case 'sonic-boom':
    case 'gyro-ball':
      return 20;
    case 'dragon-rage':
      return 40;
    case 'super-fang':
      return 50;
    default:
      return move.damageClass === 'status' ? 0 : null;
  }
}

function getConnectedCells(
  moveName: string,
  size: number,
  count: number
): MovePatternCell[] {
  const center = getCenterOffset(size);
  const cells: MovePatternCell[] = [{ row: center, column: center }];
  const selected = new Set([center * size + center]);

  while (cells.length < count) {
    const adjacent: MovePatternCell[] = [];
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        const index = row * size + column;
        if (selected.has(index)) continue;
        if (
          !cells.some(
            (cell) =>
              Math.abs(cell.row - row) <= 1 &&
              Math.abs(cell.column - column) <= 1
          )
        ) {
          continue;
        }
        adjacent.push({ row, column });
      }
    }

    adjacent.sort((left, right) => {
      const leftRows = cells.map((cell) => cell.row).concat(left.row);
      const leftColumns = cells.map((cell) => cell.column).concat(left.column);
      const rightRows = cells.map((cell) => cell.row).concat(right.row);
      const rightColumns = cells.map((cell) => cell.column).concat(right.column);
      const leftHeight = Math.max(...leftRows) - Math.min(...leftRows) + 1;
      const leftWidth = Math.max(...leftColumns) - Math.min(...leftColumns) + 1;
      const rightHeight = Math.max(...rightRows) - Math.min(...rightRows) + 1;
      const rightWidth = Math.max(...rightColumns) - Math.min(...rightColumns) + 1;
      const leftSquarePenalty = Number(leftHeight === leftWidth);
      const rightSquarePenalty = Number(rightHeight === rightWidth);
      return (
        leftSquarePenalty - rightSquarePenalty ||
        hashCell(moveName, left.row, left.column) -
          hashCell(moveName, right.row, right.column)
      );
    });

    const next = adjacent[0];
    if (!next) break;
    cells.push(next);
    selected.add(next.row * size + next.column);
  }

  return cells;
}

export function getMovePattern(
  move: PokemonMove,
  attackingStats: { attack: number; specialAttack: number },
  context: MovePatternContext
): MovePattern {
  const statusMove = move.damageClass === 'status';
  const stat =
    move.damageClass === 'special'
      ? attackingStats.specialAttack
      : attackingStats.attack;
  const levelAdjustedStat = Math.floor((2 * stat * context.level) / 100) + 5;
  const footprintSize = statusMove ? 1 : getFootprintSize(levelAdjustedStat);
  const effectivePower = getMovePatternPower(move, context);

  if (effectivePower === null) {
    return { footprintSize, hitCells: [], effectivePower: null };
  }

  const targetCellCount = statusMove
    ? 1
    : Math.min(
        footprintSize * footprintSize,
        Math.max(1, Math.ceil((effectivePower * move.maxHits) / 10))
      );
  return {
    footprintSize,
    hitCells: getConnectedCells(move.name, footprintSize, targetCellCount),
    effectivePower,
  };
}

export function getPatternCells(
  row: number,
  column: number,
  pattern: MovePattern,
  dimensions: { rows: number; columns: number }
): number[] {
  const centerOffset = getCenterOffset(pattern.footprintSize);
  const top = row - centerOffset;
  const left = column - centerOffset;
  return pattern.hitCells.flatMap((cell) => {
    const targetRow = top + cell.row;
    const targetColumn = left + cell.column;
    if (
      targetRow < 0 ||
      targetRow >= dimensions.rows ||
      targetColumn < 0 ||
      targetColumn >= dimensions.columns
    ) {
      return [];
    }
    return [targetRow * dimensions.columns + targetColumn];
  });
}
