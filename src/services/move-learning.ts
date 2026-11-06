import type { LevelUpMove } from '@/services/pokeapi';

export function getInitialMoveNames(moves: LevelUpMove[]): string[] {
  return [...moves]
    .sort(
      (left, right) =>
        right.learnedAtLevel - left.learnedAtLevel ||
        left.name.localeCompare(right.name)
    )
    .slice(0, 4)
    .map((move) => move.name);
}

export function chooseOpponentMoveNames(
  moves: LevelUpMove[],
  random: () => number = Math.random
): string[] {
  const shuffled = [...moves];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.min(index, Math.floor(random() * (index + 1)));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled.slice(0, 4).map((move) => move.name);
}
