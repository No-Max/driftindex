import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  lookupByPilotSlug,
  pilotSlugLookupCandidates,
  stripSeriesPilotSlugPrefix,
} from './pilotSlug.js';

describe('stripSeriesPilotSlugPrefix', () => {
  it('removes series prefixes from pilot slugs', () => {
    assert.equal(stripSeriesPilotSlugPrefix('dm-james-deane'), 'james-deane');
    assert.equal(stripSeriesPilotSlugPrefix('fd-ryan-tuerck'), 'ryan-tuerck');
    assert.equal(stripSeriesPilotSlugPrefix('dk-pawel-trela'), 'pawel-trela');
    assert.equal(stripSeriesPilotSlugPrefix('d1-yokoi-masashi'), 'yokoi-masashi');
    assert.equal(stripSeriesPilotSlugPrefix('da-ivanov_ivan'), 'ivanov_ivan');
  });

  it('leaves event slugs, numeric orphans, and rds ids alone', () => {
    assert.equal(stripSeriesPilotSlugPrefix('dm-r1'), 'dm-r1');
    assert.equal(stripSeriesPilotSlugPrefix('dk-r4'), 'dk-r4');
    assert.equal(stripSeriesPilotSlugPrefix('d1-8'), 'd1-8');
    assert.equal(stripSeriesPilotSlugPrefix('rds-37718'), 'rds-37718');
    assert.equal(stripSeriesPilotSlugPrefix('james-deane'), 'james-deane');
  });
});

describe('pilotSlugLookupCandidates', () => {
  it('includes unprefixed and historical prefixed forms', () => {
    const candidates = pilotSlugLookupCandidates('dm-james-deane');
    assert.ok(candidates.includes('dm-james-deane'));
    assert.ok(candidates.includes('james-deane'));
    assert.ok(candidates.includes('fd-james-deane'));
  });
});

describe('lookupByPilotSlug', () => {
  it('finds a map entry from either prefixed or unprefixed slug', () => {
    const map = { 'james-deane': { firstName: 'James', lastName: 'Deane' } };
    assert.deepEqual(lookupByPilotSlug(map, 'dm-james-deane'), {
      firstName: 'James',
      lastName: 'Deane',
    });
    assert.deepEqual(lookupByPilotSlug(map, 'james-deane'), {
      firstName: 'James',
      lastName: 'Deane',
    });
  });
});
