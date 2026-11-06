import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createOpponentGrid,
  getOpponentGridBlockIndexes,
  migrateOpponentGrid,
} from '../src/services/opponent-grid-patterns.ts';

const TYPES = [
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
];

test('every type creates a stable layout with the requested number of HP blocks', () => {
  const dimensions = { rows: 8, columns: 8 };
  const layouts = new Set();

  for (const type of TYPES) {
    const first = createOpponentGrid([type], dimensions, 24);
    const second = createOpponentGrid([type], dimensions, 24);
    assert.equal(first.filter(Boolean).length, 24, `${type} block count`);
    assert.deepEqual(first, second, `${type} determinism`);
    layouts.add(first.map((occupied) => Number(occupied)).join(''));
  }

  assert.equal(layouts.size, TYPES.length, 'each type has a distinct motif');
});

test('secondary type rotates the primary type pattern by 180 degrees', () => {
  const dimensions = { rows: 7, columns: 9 };
  const primary = getOpponentGridBlockIndexes(['fire'], dimensions, 17);
  const dual = getOpponentGridBlockIndexes(['fire', 'water'], dimensions, 17);
  const rotated = primary.map((index) => {
    const row = Math.floor(index / dimensions.columns);
    const column = index % dimensions.columns;
    return (
      (dimensions.rows - row - 1) * dimensions.columns +
      dimensions.columns -
      column -
      1
    );
  });

  assert.deepEqual(new Set(dual), new Set(rotated));
});

test('grid migration halves old remaining health proportionally and keeps statuses', () => {
  const migrated = migrateOpponentGrid(
    [true, true, false, true, false, false],
    [null, 'burn', null, 'poison', null, null],
    [false, true, false, false, false, false],
    [true, true, true, true, true, true, true, true]
  );

  assert.equal(migrated.cells.filter(Boolean).length, 4);
  assert.equal(migrated.statuses.filter(Boolean).length, 2);
  assert.equal(migrated.statusFresh.filter(Boolean).length, 1);
});
