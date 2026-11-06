export function getMoveLabel(move: string): string {
  return move
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
