import type { StatusEffect } from '@/types/game';

export function getOpponentHpBlockCount(
  cells: boolean[],
  statuses: (StatusEffect | null)[]
): number {
  if (cells.length !== statuses.length) {
    throw new Error('The boss grid and its status effects do not match.');
  }
  return cells.filter((cell, index) => cell && statuses[index] === null).length;
}
