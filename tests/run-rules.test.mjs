import assert from 'node:assert/strict';
import test from 'node:test';

import {
  finishRunIfDefeated,
  isPartyUnableToBattle,
  replacePartyMemberWithCatch,
} from '../src/services/run-rules.ts';

function createProfile(party) {
  return {
    areaId: 'forest',
    areaNumber: 2,
    encounterIndex: 3,
    opponentLevel: 6,
    opponentIsAreaBoss: false,
    party,
    runStatus: 'active',
    runSummary: null,
  };
}

test('only ends a run when every party member is unable to battle', () => {
  const activeProfile = createProfile([
    { slot: 0, pokemonId: 25, currentHp: 0, maxHp: 20, level: 1 },
    { slot: 1, pokemonId: 133, currentHp: 1, maxHp: 30, level: 1 },
  ]);
  const defeatedProfile = createProfile([
    { slot: 0, pokemonId: 25, currentHp: 0, maxHp: 20, level: 1 },
    { slot: 1, pokemonId: 133, currentHp: 0, maxHp: 30, level: 1 },
  ]);

  assert.equal(isPartyUnableToBattle([]), false);
  assert.equal(finishRunIfDefeated(activeProfile), activeProfile);
  assert.equal(finishRunIfDefeated(defeatedProfile).runStatus, 'gameOver');
});

test('captures an independent progress and team snapshot for game over', () => {
  const profile = createProfile([
    { slot: 0, pokemonId: 25, currentHp: 0, maxHp: 20, level: 6 },
  ]);
  const finished = finishRunIfDefeated(profile);

  assert.deepEqual(finished.runSummary, {
    areaId: 'forest',
    areaNumber: 2,
    encounterIndex: 3,
    opponentLevel: 6,
    opponentIsAreaBoss: false,
    party: [{ slot: 0, pokemonId: 25, currentHp: 0, maxHp: 20, level: 6 }],
  });
  profile.party[0].level = 99;
  assert.equal(finished.runSummary.party[0].level, 6);
});

test('does not replace a completed run summary', () => {
  const profile = {
    ...createProfile([
      { slot: 0, pokemonId: 25, currentHp: 0, maxHp: 20, level: 6 },
    ]),
    runStatus: 'gameOver',
    runSummary: { areaNumber: 1 },
  };

  assert.equal(finishRunIfDefeated(profile), profile);
});

test('replaces only the selected party member with the persisted catch', () => {
  const party = [
    { slot: 0, pokemonId: 25, currentHp: 0, maxHp: 20, level: 6 },
    { slot: 1, pokemonId: 133, currentHp: 10, maxHp: 30, level: 6 },
  ];
  const caught = {
    pokemonId: 1,
    currentHp: 40,
    maxHp: 40,
    level: 6,
  };
  const replacement = replacePartyMemberWithCatch(party, caught, 1);

  assert.deepEqual(replacement.party, [
    party[0],
    { slot: 1, ...caught },
  ]);
  assert.equal(replacement.pendingCatch, null);
  assert.equal(party[1].pokemonId, 133);
  assert.throws(() => replacePartyMemberWithCatch(party, caught, 9), /not in your party/);
});
