import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getEvolutionMinimumLevel,
  getNewlyUnlockedEvolutions,
} from '../src/services/evolution-rules.ts';

function evolutionDetails(overrides = {}) {
  return {
    trigger: { name: 'level-up' },
    min_level: 16,
    item: null,
    gender: null,
    held_item: null,
    known_move: null,
    known_move_type: null,
    location: null,
    min_happiness: null,
    min_beauty: null,
    min_affection: null,
    needs_overworld_rain: false,
    party_species: null,
    party_type: null,
    relative_physical_stats: null,
    time_of_day: '',
    trade_species: null,
    turn_upside_down: false,
    ...overrides,
  };
}

test('preserves straightforward level-based evolution requirements', () => {
  assert.equal(getEvolutionMinimumLevel(evolutionDetails()), 16);
});

test('uses level 30 for item, friendship, time, and trade evolutions', () => {
  assert.equal(
    getEvolutionMinimumLevel(evolutionDetails({ trigger: { name: 'use-item' }, item: { name: 'fire-stone' } })),
    30
  );
  assert.equal(
    getEvolutionMinimumLevel(evolutionDetails({ min_happiness: 160 })),
    30
  );
  assert.equal(
    getEvolutionMinimumLevel(evolutionDetails({ time_of_day: 'night' })),
    30
  );
  assert.equal(
    getEvolutionMinimumLevel(evolutionDetails({ trigger: { name: 'trade' } })),
    30
  );
});

test('returns only evolution levels reached during the current level-up', () => {
  const options = [
    { pokemonId: 2, name: 'ivysaur', minimumLevel: 16 },
    { pokemonId: 3, name: 'venusaur', minimumLevel: 32 },
    { pokemonId: 25, name: 'pikachu', minimumLevel: 30 },
  ];

  assert.deepEqual(getNewlyUnlockedEvolutions(options, 15, 16), [options[0]]);
  assert.deepEqual(getNewlyUnlockedEvolutions(options, 29, 30), [options[2]]);
  assert.deepEqual(getNewlyUnlockedEvolutions(options, 30, 31), []);
});
