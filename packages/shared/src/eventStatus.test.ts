import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolvePublicEventStatus } from './eventStatus.js';

describe('resolvePublicEventStatus', () => {
  const now = Date.parse('2026-06-15T12:00:00.000Z');

  it('keeps finished and cancelled', () => {
    assert.equal(
      resolvePublicEventStatus('FINISHED', '2026-01-01T00:00:00.000Z', now),
      'FINISHED',
    );
    assert.equal(
      resolvePublicEventStatus('CANCELLED', '2026-01-01T00:00:00.000Z', now),
      'CANCELLED',
    );
  });

  it('keeps future scheduled events as scheduled', () => {
    assert.equal(
      resolvePublicEventStatus('SCHEDULED', '2026-07-01T00:00:00.000Z', now),
      'SCHEDULED',
    );
  });

  it('maps past scheduled events to waiting results', () => {
    assert.equal(
      resolvePublicEventStatus('SCHEDULED', '2026-06-01T00:00:00.000Z', now),
      'WAITING_RESULTS',
    );
  });

  it('keeps scheduled when startsAt is missing', () => {
    assert.equal(resolvePublicEventStatus('SCHEDULED', null, now), 'SCHEDULED');
  });
});
