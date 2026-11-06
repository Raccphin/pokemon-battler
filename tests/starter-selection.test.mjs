import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chooseStarterCandidates,
  STARTER_SELECTION_CONFIG,
} from '../src/services/starter-selection-rules.ts';

test('returns exactly three choices without any shared types', () => {
  const choices = chooseStarterCandidates([
    { id: 1, types: ['grass', 'flying'] },
    { id: 2, types: ['fire'] },
    { id: 3, types: ['flying'] },
    { id: 4, types: ['water', 'ice'] },
    { id: 5, types: ['ice'] },
  ]);
  const usedTypes = new Set();

  assert.equal(choices.length, 3);
  for (const choice of choices) {
    for (const type of choice.types) {
      assert.equal(usedTypes.has(type), false);
      usedTypes.add(type);
    }
  }
});

test('can reroll a different starter set for a new run', () => {
  const candidates = [
    { id: 1, types: ['grass'] },
    { id: 2, types: ['fire'] },
    { id: 3, types: ['water'] },
    { id: 4, types: ['electric'] },
    { id: 5, types: ['psychic'] },
    { id: 6, types: ['rock'] },
  ];

  const firstRun = chooseStarterCandidates(candidates, () => 0);
  const secondRun = chooseStarterCandidates(candidates, () => 0.99);

  assert.notDeepEqual(firstRun, secondRun);
});

test('keeps Pikachu and Eevee eligible without requiring either to appear', () => {
  assert.ok(STARTER_SELECTION_CONFIG.candidatePokemonIds.includes(25));
  assert.ok(STARTER_SELECTION_CONFIG.candidatePokemonIds.includes(133));
  const candidates = [
    { id: 25, types: ['electric'] },
    { id: 133, types: ['normal'] },
    { id: 1, types: ['grass'] },
    { id: 4, types: ['fire'] },
    { id: 7, types: ['water'] },
  ];
  const choicesWithSpecials = chooseStarterCandidates(candidates, () => 0);
  const choicesWithoutSpecials = chooseStarterCandidates(candidates, () => 1);
  assert.ok(choicesWithSpecials.some(({ id }) => id === 25));
  assert.ok(choicesWithSpecials.some(({ id }) => id === 133));
  assert.ok(choicesWithoutSpecials.every(({ id }) => id !== 25 && id !== 133));
});

test('fails explicitly when three type-distinct choices are unavailable', () => {
  assert.throws(
    () =>
      chooseStarterCandidates([
        { id: 1, types: ['grass'] },
        { id: 2, types: ['grass', 'poison'] },
      ]),
    /Could not find three starter Pokémon with distinct types/
  );
});
