// Prototype candidate pool; tune it here without changing the selection rules.
export const STARTER_SELECTION_CONFIG = {
  choiceCount: 3,
  candidatePokemonIds: [
    1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501, 650, 653, 656, 722,
    725, 728, 810, 813, 816, 906, 909, 912, 25, 133,
  ],
} as const;

export interface StarterCandidate {
  id: number;
  types: string[];
}

export function chooseStarterCandidates<T extends StarterCandidate>(
  candidates: T[],
  random: () => number = Math.random
): T[] {
  const eligible = candidates.filter((candidate) => candidate.types.length > 0);
  const compatibleChoices: T[][] = [];

  function findCompatibleChoices(
    startIndex: number,
    chosen: T[],
    usedTypes: Set<string>
  ): void {
    if (chosen.length === STARTER_SELECTION_CONFIG.choiceCount) {
      compatibleChoices.push(chosen);
      return;
    }
    for (let index = startIndex; index < eligible.length; index += 1) {
      const candidate = eligible[index];
      if (candidate.types.some((type) => usedTypes.has(type))) continue;
      const nextTypes = new Set(usedTypes);
      candidate.types.forEach((type) => nextTypes.add(type));
      findCompatibleChoices(index + 1, [...chosen, candidate], nextTypes);
    }
  }

  findCompatibleChoices(0, [], new Set());
  if (compatibleChoices.length === 0) {
    throw new Error('Could not find three starter Pokémon with distinct types.');
  }
  const choiceIndex = Math.min(
    compatibleChoices.length - 1,
    Math.floor(random() * compatibleChoices.length)
  );
  return compatibleChoices[choiceIndex];
}
