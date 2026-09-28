import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyFdTandemPodiumFromPoints,
  applyFdTandemPositions,
  sanitizeFdSeasonData,
  type FdEvent,
  type FdPilot,
  type FdSeasonData,
  type FdStageResult,
} from './formula-drift.js';

function stage(overrides: Partial<FdStageResult> & Pick<FdStageResult, 'eventSlug' | 'roundNumber'>): FdStageResult {
  return {
    qualifyingPosition: null,
    qualifyingPoints: null,
    qualScore100: null,
    tandemPosition: null,
    points: 0,
    ...overrides,
  };
}

describe('applyFdTandemPositions', () => {
  it('clears tandem place when multiple drivers share finish points', () => {
    const pilots: FdPilot[] = [
      {
        slug: 'a',
        fdDriverId: 1,
        firstName: 'A',
        lastName: 'A',
        nameAlias: 'A A',
        country: null,
        number: null,
        photoSourceUrl: null,
        team: null,
        stages: [stage({ eventSlug: 'fd-lb', roundNumber: 1, points: 70, tandemFinishPoints: 70 })],
      },
      {
        slug: 'b',
        fdDriverId: 2,
        firstName: 'B',
        lastName: 'B',
        nameAlias: 'B B',
        country: null,
        number: null,
        photoSourceUrl: null,
        team: null,
        stages: [stage({ eventSlug: 'fd-lb', roundNumber: 1, points: 70, tandemFinishPoints: 70 })],
      },
      {
        slug: 'c',
        fdDriverId: 3,
        firstName: 'C',
        lastName: 'C',
        nameAlias: 'C C',
        country: null,
        number: null,
        photoSourceUrl: null,
        team: null,
        stages: [stage({ eventSlug: 'fd-lb', roundNumber: 1, points: 100, tandemFinishPoints: 100 })],
      },
    ];
    applyFdTandemPositions(pilots, 2024, (s) => s.tandemFinishPoints ?? null);
    assert.equal(pilots[2]!.stages[0]!.tandemPosition, 1);
    assert.equal(pilots[0]!.stages[0]!.tandemPosition, null);
    assert.equal(pilots[1]!.stages[0]!.tandemPosition, null);
  });
});

describe('applyFdTandemPodiumFromPoints', () => {
  it('fills only missing P1–P3 from points and leaves lower tiers unset', () => {
    const event: FdEvent = {
      fdEventId: 1,
      slug: 'fd-lb',
      roundNumber: 1,
      name: 'LB',
      trackName: 'LB',
      startsAt: '2024-01-01T12:00:00.000Z',
      status: 'FINISHED',
    };
    const stage = (slug: string, points: number, tandem: number | null) => ({
      eventSlug: 'fd-lb',
      roundNumber: 1,
      qualifyingPosition: null,
      qualifyingPoints: null,
      qualScore100: null,
      tandemPosition: tandem,
      points,
    });
    const pilots: FdPilot[] = [
      {
        slug: 'a',
        fdDriverId: 1,
        firstName: 'A',
        lastName: 'A',
        nameAlias: 'A A',
        country: null,
        number: null,
        photoSourceUrl: null,
        team: null,
        stages: [stage('a', 100, 1)],
      },
      {
        slug: 'b',
        fdDriverId: 2,
        firstName: 'B',
        lastName: 'B',
        nameAlias: 'B B',
        country: null,
        number: null,
        photoSourceUrl: null,
        team: null,
        stages: [stage('b', 84, null)],
      },
      {
        slug: 'c',
        fdDriverId: 3,
        firstName: 'C',
        lastName: 'C',
        nameAlias: 'C C',
        country: null,
        number: null,
        photoSourceUrl: null,
        team: null,
        stages: [stage('c', 70, null)],
      },
      {
        slug: 'd',
        fdDriverId: 4,
        firstName: 'D',
        lastName: 'D',
        nameAlias: 'D D',
        country: null,
        number: null,
        photoSourceUrl: null,
        team: null,
        stages: [stage('d', 70, null)],
      },
    ];
    applyFdTandemPodiumFromPoints(pilots, [event]);
    assert.equal(pilots[0]!.stages[0]!.tandemPosition, 1);
    assert.equal(pilots[1]!.stages[0]!.tandemPosition, 2);
    assert.equal(pilots[2]!.stages[0]!.tandemPosition, 3);
    assert.equal(pilots[3]!.stages[0]!.tandemPosition, null);
  });
});

describe('sanitizeFdSeasonData', () => {
  it('strips qual fields for Wikipedia imports', () => {
    const data: FdSeasonData = {
      sourceUrl: 'https://en.wikipedia.org/wiki/2008_Formula_D_season',
      seasonYear: 2008,
      events: [],
      pilots: [
        {
          slug: 'x',
          fdDriverId: 1,
          firstName: 'X',
          lastName: 'Y',
          nameAlias: 'X Y',
          country: null,
          number: null,
          photoSourceUrl: null,
          team: null,
          stages: [
            stage({
              eventSlug: 'fd-lb',
              roundNumber: 1,
              qualifyingPosition: 3,
              qualScore100: 90,
              tandemPosition: 1,
              points: 100,
            }),
          ],
        },
      ],
    };
    sanitizeFdSeasonData(data);
    const s = data.pilots[0]!.stages[0]!;
    assert.equal(s.qualifyingPosition, null);
    assert.equal(s.qualScore100, null);
    assert.equal(s.tandemPosition, 1);
  });
});
