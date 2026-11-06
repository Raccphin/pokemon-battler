import assert from 'node:assert/strict';
import test from 'node:test';

import { getOpponentHpBlockCount } from '../src/services/opponent-health.ts';

test('status-marked intact tiles do not count toward opponent HP', () => {
  assert.equal(
    getOpponentHpBlockCount(
      [true, true, true, false],
      [null, 'burn', 'freeze', null]
    ),
    1
  );
});

test('unmarked intact tiles count toward opponent HP', () => {
  assert.equal(
    getOpponentHpBlockCount([true, true, false], [null, null, 'poison']),
    2
  );
});

test('rejects mismatched grid and status arrays', () => {
  assert.throws(
    () => getOpponentHpBlockCount([true], []),
    /grid and its status effects do not match/
  );
});
