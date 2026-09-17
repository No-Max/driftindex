import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeRoyalDsStandings,
  parseRacingNumber,
  parseRoyalDsName,
  participatedStage,
  tandemRecordsFromBracket,
} from './royal-ds.js';

describe('parseRoyalDsName', () => {
  const cases: Array<[string, string, string, string, string]> = [
    ['Shabanov Artêm', 'ARTEM SHABANOV', 'shabanov-art-m-77', 'Artêm', 'Shabanov'],
    ['Grossman Maksim', 'MAKSIM GROSSMAN', 'grossman-maksim-44', 'Maksim', 'Grossman'],
    ['Fontijn Sebastian', 'SEBASTIAN FONTIJN', 'fontijn-sebastian-76', 'Sebastian', 'Fontijn'],
    ['Korpulinski Pawel', 'PAWEL KORPULINSKI', 'korpulinski-pawel-74', 'Pawel', 'Korpulinski'],
    ['Nilsen Ørjan', 'ØRJAN NILSEN', 'rjan-nilsen-12', 'Ørjan', 'Nilsen'],
    ['Shnayder Leonid', 'LEONID SHNAYDER', 'shnayder-leonid-7', 'Leonid', 'Shnayder'],
    ['Wang Qi', 'QI WANG', 'wang-qi-99', 'Qi', 'Wang'],
    ['Chen Junjian', 'JOHNSON CHEN', 'chen-junjian-770', 'Junjian', 'Chen'],
    ['Larner Mitchell John', 'MITCH LARNER', 'mitch-larner-111', 'Mitchell John', 'Larner'],
    ['KEVIN PESUR', 'KEVIN PESUR', 'kevin-pesur-33', 'Kevin', 'Pesur'],
    ['Keski-korpi Mika', 'MIKA KESKI-KORPI', 'mika-keski-korpi-46', 'Mika', 'Keski-korpi'],
    ['Chen Chi Yun', 'BRIAN CHEN', 'chen-chi-yun-95', 'Chi Yun', 'Chen'],
  ];

  for (const [fullName, nickname, slug, firstName, lastName] of cases) {
    it(`${fullName} → ${firstName} ${lastName}`, () => {
      assert.deepEqual(parseRoyalDsName(fullName, nickname, slug), { firstName, lastName });
    });
  }
});

describe('parseRacingNumber', () => {
  it('parses numeric strings', () => {
    assert.equal(parseRacingNumber('76'), 76);
    assert.equal(parseRacingNumber('360'), 360);
    assert.equal(parseRacingNumber(63), 63);
  });

  it('rejects empty values', () => {
    assert.equal(parseRacingNumber(''), null);
    assert.equal(parseRacingNumber(null), null);
    assert.equal(parseRacingNumber('n/a'), null);
  });
});

describe('participatedStage', () => {
  it('keeps official DNQ/DNS/zero and drops calendar placeholders', () => {
    assert.equal(
      participatedStage({
        eventSlug: 'r1-shanghai',
        roundNumber: 1,
        qualifyingPosition: 33,
        qualifyingPoints: null,
        tandemPoints: null,
        totalPoints: 0,
        position: null,
        status: 'dnq',
        official: true,
      }),
      true,
    );
    assert.equal(
      participatedStage({
        eventSlug: 'r4-zhengzhou',
        roundNumber: 4,
        qualifyingPosition: null,
        qualifyingPoints: null,
        tandemPoints: null,
        totalPoints: null,
        position: null,
        status: null,
        official: false,
      }),
      false,
    );
  });
});

describe('tandemRecordsFromBracket', () => {
  it('counts completed battles with both drivers', () => {
    const records = tandemRecordsFromBracket([
      {
        status: 'COMPLETED',
        top: { slug: 'a' },
        bottom: { slug: 'b' },
        winner: { slug: 'a' },
      },
      {
        status: 'COMPLETED',
        top: { slug: 'a' },
        bottom: { slug: 'c' },
        winner: { slug: 'c' },
      },
      {
        status: 'PENDING',
        top: { slug: 'a' },
        bottom: { slug: 'd' },
        winner: null,
      },
    ]);

    assert.deepEqual(records.get('a'), { battles: 2, wins: 1 });
    assert.deepEqual(records.get('b'), { battles: 1, wins: 0 });
    assert.deepEqual(records.get('c'), { battles: 1, wins: 1 });
    assert.equal(records.has('d'), false);
  });
});

describe('normalizeRoyalDsStandings', () => {
  it('keeps zero-point participants and team points, drops empty stages', () => {
    const data = normalizeRoyalDsStandings({
      standings: {
        season: { year: 2026 },
        events: [
          {
            slug: 'r1-shanghai',
            roundNumber: 1,
            titleEn: 'Round 1 - Shanghai',
            titleRu: 'Этап 1 - Шанхай',
            titleCn: null,
            cityEn: 'Shanghai',
            trackEn: null,
            phase: 'FINISHED',
            startsAt: '2026-06-04T00:00:00.000Z',
            official: true,
          },
        ],
        personal: [
          {
            totalPoints: 0,
            driverSlug: 'liu-liu-ge-1glc',
            fullNameEn: 'Liu Liu Ge',
            fullNameCn: '刘刘戈',
            nickname: 'LIU LIU GE',
            racingNumber: '32',
            countryCode: 'CN',
            photoPortraitUrl: null,
            team: '1087X DRIFT TEAM',
            stages: [
              {
                eventSlug: 'r1-shanghai',
                roundNumber: 1,
                qualifyingPosition: 40,
                qualifyingPoints: null,
                tandemPoints: null,
                totalPoints: 0,
                position: null,
                status: 'dnq',
                official: true,
              },
            ],
          },
        ],
        teams: [
          {
            position: 1,
            totalPoints: 454,
            teamSlug: 'timeup',
            teamLabel: 'TIMEUP',
            nameEn: 'TIMEUP',
            stages: [
              {
                eventSlug: 'r1-shanghai',
                roundNumber: 1,
                totalPoints: 454,
                official: true,
              },
            ],
          },
        ],
      },
    });

    assert.equal(data.pilots.length, 1);
    assert.equal(data.pilots[0]?.number, 32);
    assert.equal(data.pilots[0]?.firstName, 'Liu Ge');
    assert.equal(data.pilots[0]?.lastName, 'Liu');
    assert.equal(data.pilots[0]?.stages[0]?.points, 0);
    assert.equal(data.teams[0]?.totalPoints, 454);
    assert.equal(data.events[0]?.trackName, 'Round 1 - Shanghai');
  });
});
