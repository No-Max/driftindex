import type { Pilot } from '@prisma/client';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeStandings } from './standings.js';

function fakePilot(overrides: Partial<Pilot>): Pilot {
  return {
    id: 'pilot-1',
    slug: 'daniel-stuke',
    firstName: 'Daniel',
    lastName: 'Stuke',
    country: 'US',
    number: 527,
    photoUrl: null,
    photoSourceUrl: null,
    photoUpdatedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

describe('computeStandings', () => {
  it('keeps seeding-bracket qualifying points on each event cell', () => {
    const pilot = fakePilot({});
    const rows = computeStandings([
      {
        id: 'event-1',
        slug: 'fd-long-beach',
        roundNumber: 1,
        name: 'Streets of Long Beach',
        status: 'FINISHED',
        startsAt: new Date('2025-04-05T00:00:00Z'),
        results: [
          {
            pilotId: pilot.id,
            points: 22,
            number: 527,
            qualPosition: 21,
            qualPoints: 12,
            qualScore100: null,
            tandemPosition: 5,
            pilot,
          },
        ],
      },
    ]);

    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0]?.eventQual[0], {
      qualPosition: 21,
      qualScore100: null,
      qualPoints: 12,
    });
  });
});
