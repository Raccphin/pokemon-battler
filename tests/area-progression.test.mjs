import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AREA_PROGRESSION_CONFIG,
  getNextEncounterProgress,
  getOpponentProgressionLevel,
  getPlayerProgressionLevel,
  getProgressionLevel,
} from '../src/services/area-progression.ts';

test('keeps the configured starting level and raises levels by area', () => {
  assert.equal(getProgressionLevel(1), AREA_PROGRESSION_CONFIG.startingLevel);
  assert.equal(
    getProgressionLevel(2),
    AREA_PROGRESSION_CONFIG.startingLevel +
      AREA_PROGRESSION_CONFIG.levelsPerArea,
  );
});

test('scales regular opponents and the area boss without changing the area step', () => {
  const areaBoss = getNextEncounterProgress({
    areaId: 'forest',
    areaNumber: 1,
    encounterIndex: AREA_PROGRESSION_CONFIG.encountersPerArea - 2,
  });
  const nextArea = getNextEncounterProgress(
    {
      areaId: 'forest',
      areaNumber: 1,
      encounterIndex: AREA_PROGRESSION_CONFIG.encountersPerArea - 1,
    },
    'beach',
  );

  assert.equal(areaBoss.encounterIndex, 9);
  assert.equal(areaBoss.isAreaBoss, true);
  assert.equal(areaBoss.opponentLevel, 4);
  assert.equal(nextArea.areaId, 'beach');
  assert.equal(nextArea.areaNumber, 2);
  assert.equal(nextArea.encounterIndex, 0);
  assert.equal(nextArea.opponentLevel, 6);
  assert.equal(nextArea.opponentLevel - areaBoss.opponentLevel, 2);
  assert.equal(
    getProgressionLevel(2) - getProgressionLevel(1),
    AREA_PROGRESSION_CONFIG.levelsPerArea,
  );
});

test('gains two levels across regular encounters and a final boss level', () => {
  assert.deepEqual(
    Array.from(
      { length: AREA_PROGRESSION_CONFIG.encountersPerArea },
      (_, encounterIndex) => getOpponentProgressionLevel(1, encounterIndex),
    ),
    [1, 1, 1, 1, 2, 2, 2, 2, 3, 4],
  );
});

test('distributes five player levels across the ten encounter stages', () => {
  assert.deepEqual(
    Array.from({ length: AREA_PROGRESSION_CONFIG.encountersPerArea }, (_, index) =>
      getPlayerProgressionLevel(1, index),
    ),
    [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
  );
  assert.equal(getPlayerProgressionLevel(2, 0), 6);
});
