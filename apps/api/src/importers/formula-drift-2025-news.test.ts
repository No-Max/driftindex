import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  finishRowsFromTable,
  nameKey,
  parseProPodiumFromNewsText,
  roundNumberFromNewsTitle,
} from './formula-drift-2025-news.js';

describe('roundNumberFromNewsTitle', () => {
  it('reads explicit rounds and venue fallbacks', () => {
    assert.equal(
      roundNumberFromNewsTitle(
        'COMPETITION RESULTS FROM OPENING ROUND OF 2025 FORMULA DRIFT PRO CHAMPIONSHIP IN LONG BEACH',
      ),
      1,
    );
    assert.equal(
      roundNumberFromNewsTitle(
        '2025 FORMULA DRIFT PRO CHAMPIONSHIP COMPETITION RESULTS FROM FINAL ROUND 8 IN LONG BEACH',
      ),
      8,
    );
    assert.equal(
      roundNumberFromNewsTitle(
        'FORMULA DRIFT SEATTLE PRO CHAMPIONSHIP SEEDING BRACKET QUALIFYING RESULTS',
      ),
      6,
    );
    assert.equal(
      roundNumberFromNewsTitle(
        'FORMULA DRIFT PRO CHAMPIONSHIP SEEDING BRACKET QUALIFYING RESULTS FROM LONG BEACH FINAL',
      ),
      8,
    );
  });
});

describe('finishRowsFromTable', () => {
  it('drops a duplicated winner copied into the last row', () => {
    const rows = [
      ['POSITION', 'DRIVER'],
      ['1', 'James Deane'],
      ['2', 'Fredric Aasbo'],
      ['16', 'James Deane'],
    ];
    assert.deepEqual(finishRowsFromTable(rows), [
      { position: 1, name: 'James Deane' },
      { position: 2, name: 'Fredric Aasbo' },
    ]);
  });
});

describe('parseProPodiumFromNewsText', () => {
  it('reads modern PRO competition blocks and legacy event results', () => {
    const modern =
      'RESULTS FROM FD PRO COMPETITION 1. James Deane (Ireland) – Ford 2. Simen Olsen (Norway) – Nissan 3. Aurimas Bakchis (Lithuania) – Nissan NOTES';
    assert.deepEqual(parseProPodiumFromNewsText(modern).map((row) => row.name), [
      'James Deane',
      'Simen Olsen',
      'Aurimas Bakchis',
    ]);

    const legacy =
      'Round 7: Title Fight Event Results 1. Foust, Tanner Rockstar 1st Place 2. Gittin, Vaughn Monster 2nd Place 3. Takatori, Michihiro Nissan 3rd Place';
    assert.deepEqual(parseProPodiumFromNewsText(legacy).map((row) => row.name), [
      'Tanner Foust',
      'Vaughn Gittin',
      'Michihiro Takatori',
    ]);
  });
});

describe('nameKey', () => {
  it('ignores punctuation and junior suffixes', () => {
    assert.equal(nameKey("Connor O`Sullivan"), nameKey("Connor O'Sullivan"));
    assert.equal(nameKey('Vaughn Gittin Jr'), 'vaughn gittin');
  });
});
