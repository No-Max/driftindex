import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatQualCell } from './formatQualCell.js';

describe('formatQualCell', () => {
  it('prefers a judged score over qualifying points', () => {
    assert.equal(formatQualCell(91.5, 4, 'en', 12), '91.5 (4th)');
  });

  it('shows seeding-bracket points with place when there is no score', () => {
    assert.equal(formatQualCell(null, 21, 'ru', 12), '12 (21-е)');
    assert.equal(formatQualCell(null, 21, 'en', 12), '12 (21st)');
  });

  it('shows zero qualifying points', () => {
    assert.equal(formatQualCell(null, 29, 'en', 0), '0 (29th)');
  });

  it('keeps locked-in place only when there are no qualifying points', () => {
    assert.equal(formatQualCell(null, 1, 'en'), '(1st)');
  });
});
