import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AREA_PROGRESSION_CONFIG,
  chooseRegularOpponentId,
  getAreaGridTargetBlocks,
  getNextEncounterProgress,
  getOpponentGridHpBlockCount,
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

test('regular opponent selection skips Legendary and Mythical Pokémon', async () => {
  const classifiedIds = [];
  const selectedId = await chooseRegularOpponentId(
    [1, 2, 3],
    [],
    async (pokemonId) => {
      classifiedIds.push(pokemonId);
      return {
        isLegendary: pokemonId === 1,
        isMythical: pokemonId === 2,
      };
    },
    () => 0
  );

  assert.equal(selectedId, 3);
  assert.deepEqual(classifiedIds, [1, 2, 3]);
});

test('regular opponent selection skips previously used special Pokémon', async () => {
  const classifiedIds = [];
  const selectedId = await chooseRegularOpponentId(
    [1, 2],
    [1],
    async (pokemonId) => {
      classifiedIds.push(pokemonId);
      return { isLegendary: false, isMythical: false };
    },
    () => 0
  );

  assert.equal(selectedId, 2);
  assert.deepEqual(classifiedIds, [2]);
});

test('returns no regular opponent when every candidate is Legendary or Mythical', async () => {
  const selectedId = await chooseRegularOpponentId(
    [1, 2],
    [],
    async (pokemonId) => ({
      isLegendary: pokemonId === 1,
      isMythical: pokemonId === 2,
    }),
    () => 0
  );

  assert.equal(selectedId, undefined);
});

test('area grid block targets interpolate for regular and boss encounters', () => {
  assert.equal(getAreaGridTargetBlocks(1, false), 1);
  assert.equal(getAreaGridTargetBlocks(7, false), 16);
  assert.equal(getAreaGridTargetBlocks(10, false), 81);
  assert.equal(getAreaGridTargetBlocks(1, true), 9);
  assert.equal(getAreaGridTargetBlocks(7, true), 25);
  assert.equal(getAreaGridTargetBlocks(10, true), 144);
  assert.equal(getAreaGridTargetBlocks(4, true), 17);
  assert.equal(getAreaGridTargetBlocks(20, true), 144);
});

test('opponent HP block counts use half of scaled board capacity, rounded up', () => {
  assert.equal(getOpponentGridHpBlockCount(1), 1);
  assert.equal(getOpponentGridHpBlockCount(9), 5);
  assert.equal(getOpponentGridHpBlockCount(25), 13);
  assert.equal(getOpponentGridHpBlockCount(144), 72);
});
