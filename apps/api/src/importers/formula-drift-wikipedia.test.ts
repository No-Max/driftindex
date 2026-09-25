import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  inferEventCountry,
  parseScheduleRounds,
  parseStandingsMatrix,
  parseWikiDate,
  parseWikiDriverName,
  parseWikipediaSeasonHtml,
  parseWikiPointsCell,
  slugifyPilotName,
  wikiNameKey,
} from './formula-drift-wikipedia.js';

describe('slugifyPilotName', () => {
  it('folds accents and drops junior suffixes', () => {
    assert.equal(slugifyPilotName('Fredric Aasbø'), 'fredric-aasbo');
    assert.equal(slugifyPilotName('Vaughn Gittin, Jr.'), 'vaughn-gittin');
    assert.equal(slugifyPilotName('Piotr Więcek'), 'piotr-wiecek');
    assert.equal(slugifyPilotName('Samuel Hübinette'), 'samuel-hubinette');
  });
});

describe('wikiNameKey', () => {
  it('matches schedule winners to standings names', () => {
    assert.equal(wikiNameKey('Vaughn Gittin Jr.'), wikiNameKey('Vaughn Gittin, Jr.'));
    assert.equal(wikiNameKey('Fredric Aasbø[2]'), wikiNameKey('Fredric Aasbo'));
  });
});

describe('parseWikiDriverName', () => {
  it('splits first and last names', () => {
    assert.deepEqual(parseWikiDriverName('Samuel Hübinette'), {
      firstName: 'Samuel',
      lastName: 'Hübinette',
    });
    assert.deepEqual(parseWikiDriverName('Vaughn Gittin, Jr.'), {
      firstName: 'Vaughn',
      lastName: 'Gittin Jr',
    });
  });
});

describe('parseWikiDate', () => {
  it('reads single days and ranges', () => {
    assert.equal(parseWikiDate('April 12', 2008), '2008-04-12T12:00:00.000Z');
    assert.equal(parseWikiDate('April 6–7', 2012), '2012-04-06T12:00:00.000Z');
    assert.equal(parseWikiDate('May 31 – June 1', 2013), '2013-05-31T12:00:00.000Z');
    assert.equal(parseWikiDate('March 31 – April 1', 2017), '2017-03-31T12:00:00.000Z');
  });
});

describe('parseWikiPointsCell', () => {
  it('treats blanks as DNP and keeps participation zeros', () => {
    assert.equal(parseWikiPointsCell(''), null);
    assert.equal(parseWikiPointsCell('—'), null);
    assert.equal(parseWikiPointsCell('0.25'), 0.25);
    assert.equal(parseWikiPointsCell('48.5'), 48.5);
  });
});

describe('inferEventCountry', () => {
  it('marks Saint-Eustache as Canada', () => {
    assert.equal(inferEventCountry('St.Eustache, QC, Canada'), 'Canada');
    assert.equal(inferEventCountry('Long Beach, California'), 'United States');
  });
});

describe('parseScheduleRounds', () => {
  it('accepts Rnd headers and skips non-championship rows', () => {
    const rounds = parseScheduleRounds([
      ['Rnd', 'Title', 'Venue', 'Location', 'Date', 'Winner', 'Car'],
      ['1', 'Streets of Long Beach', 'Streets of Long Beach', 'Long Beach, CA', 'April 4 – 5', 'Chris Forsberg[2]', 'Nissan 370Z'],
      ['nc', 'Red Bull All-Star', 'Port of Long Beach', 'Long Beach, CA', 'November 16', 'Rhys Millen', 'Pontiac'],
      ['2', 'Road to the Championship', 'Road Atlanta', 'Braselton, GA', 'May 9 – 10', 'Vaughn Gittin Jr.', 'Ford Mustang'],
    ]);
    assert.deepEqual(
      rounds.map((round) => ({ round: round.roundNumber, winner: round.winner })),
      [
        { round: 1, winner: 'Chris Forsberg' },
        { round: 2, winner: 'Vaughn Gittin Jr.' },
      ],
    );
  });
});

describe('parseStandingsMatrix', () => {
  it('reads rowspan ties and prefers the table with more event columns', () => {
    const pro = parseStandingsMatrix([
      ['Pos', 'Driver', 'LBH', 'ATL', 'ORL', 'WTS', 'ASE', 'EVS', 'TEX', 'IRW', 'Points'],
      ['1', 'Chris Forsberg', '32.00', '68.00', '68.00', '84.00', '83.00', '84.00', '84.00', '36.00', '539.00'],
      ['Kristaps Blušs', '35.00', '35.00', '69.00', '68.00', '86.00', '36.00', '36.00', '34.00', '399.00'],
    ]);
    assert.equal(pro?.events.length, 8);
    assert.equal(pro?.drivers.length, 2);
    assert.equal(pro?.drivers[1]?.name, 'Kristaps Blušs');
    assert.equal(pro?.drivers[1]?.scores[0], 35);

    const prospec = parseStandingsMatrix([
      ['Pos', 'Driver', 'ATL', 'ORL', 'TEX', 'PHX', 'Points'],
      ['1', 'Marc Landreville', '86.00', '106.00', '104.00', '106.00', '402.00'],
    ]);
    assert.equal(prospec?.events.length, 4);

    const ties = parseStandingsMatrix([
      ['Pos', 'Driver', 'LBH', 'ATL', 'ENG', 'LVS', 'EVS', 'SON', 'IRW', 'Points'],
      ['31=', 'Ross Petty', '0.25', '0.25', '55', '0', '0.25', '0.25', '', '56'],
    ]);
    assert.equal(ties?.drivers[0]?.name, 'Ross Petty');
    assert.equal(ties?.drivers[0]?.scores[0], 0.25);
  });
});

describe('parseWikipediaSeasonHtml', () => {
  it('zips a clean schedule, sets the winner, and skips empty cells', () => {
    const html = `
      <table>
        <tr><th>Round</th><th>Title</th><th>Circuit</th><th>Location</th><th>Date</th><th>Winner</th><th>Car</th></tr>
        <tr><td>1</td><td>Streets of Long Beach</td><td>Streets of Long Beach</td><td>Long Beach, California</td><td>April 12</td><td>Chris Forsberg</td><td>Nissan 350Z</td></tr>
        <tr><td>2</td><td>Feel the Heat</td><td>Road Atlanta</td><td>Braselton, Georgia</td><td>May 10</td><td>Rhys Millen</td><td>Pontiac Solstice</td></tr>
        <tr><td>3</td><td>The Gauntlet</td><td>Englishtown Raceway Park</td><td>Englishtown, New Jersey</td><td>June 14</td><td>Tanner Foust</td><td>Nissan 350Z</td></tr>
        <tr><td>4</td><td>High Stakes</td><td>Las Vegas Motor Speedway</td><td>Las Vegas, Nevada</td><td>July 12</td><td>Toshiki Yoshioka</td><td>Toyota AE86</td></tr>
        <tr><td>5</td><td>Breaking Point</td><td>Evergreen Speedway</td><td>Monroe, Washington</td><td>August 9</td><td>Rhys Millen</td><td>Pontiac Solstice</td></tr>
        <tr><td>6</td><td>Locked and Loaded</td><td>Infineon Raceway</td><td>Sonoma, California</td><td>September 13</td><td>Tanner Foust</td><td>Nissan 350Z</td></tr>
        <tr><td>7</td><td>Final Fight</td><td>Toyota Speedway</td><td>Irwindale, California</td><td>October 11</td><td>Vaughn Gittin, Jr.</td><td>Ford Mustang</td></tr>
        <tr><td>nc</td><td>Red Bull Drifting World Championship</td><td>Purpose-built</td><td>Port of Long Beach, California</td><td>November 16</td><td>Rhys Millen</td><td>Pontiac Solstice</td></tr>
      </table>
      <table>
        <tr><th>Pos</th><th>Driver</th><th>LBH</th><th>ATL</th><th>ENG</th><th>LVS</th><th>EVS</th><th>SON</th><th>IRW</th><th>Points</th></tr>
        <tr><td>1</td><td>Tanner Foust</td><td>83</td><td>69</td><td>107</td><td>62</td><td>76</td><td>107</td><td>95</td><td>599</td></tr>
        <tr><td>2</td><td>Chris Forsberg</td><td>106</td><td></td><td>64</td><td>56</td><td>56</td><td>65</td><td>56</td><td>403</td></tr>
        <tr><td>3</td><td>Tyler McQuarrie</td><td>48.5</td><td>0.25</td><td>85</td><td>69.5</td><td>82</td><td>49</td><td>89</td><td>423.25</td></tr>
      </table>
    `;

    const season = parseWikipediaSeasonHtml(html, 2008);
    assert.equal(season.events.length, 7);
    assert.equal(season.events[0]?.name, 'Streets of Long Beach');
    assert.equal(season.events[0]?.startsAt, '2008-04-12T12:00:00.000Z');
    assert.equal(season.events[0]?.country, 'United States');
    assert.equal(season.events[1]?.name, 'Feel the Heat');

    const forsberg = season.pilots.find((pilot) => pilot.slug === 'chris-forsberg');
    assert.ok(forsberg);
    assert.equal(forsberg.stages.length, 6);
    assert.equal(forsberg.stages[0]?.tandemPosition, 1);
    assert.equal(forsberg.stages[0]?.points, 106);
    assert.ok(!forsberg.stages.some((stage) => stage.roundNumber === 2));

    const mcquarrie = season.pilots.find((pilot) => pilot.slug === 'tyler-mcquarrie');
    assert.equal(mcquarrie?.stages[0]?.points, 49);
    assert.equal(mcquarrie?.stages[1]?.points, 0);
  });

  it('fills missing 2015-style venues from event codes', () => {
    const html = `
      <table>
        <tr><th>Round</th><th>Title</th><th>Venue</th><th>Location</th><th>Date</th><th>Winner</th></tr>
        <tr><td>1</td><td>Streets of Long Beach</td><td>Streets of Long Beach</td><td>Long Beach, CA</td><td>April 10 – 11</td><td>Fredric Aasbø</td></tr>
        <tr><td>2</td><td>Road to the Championship</td><td>Road Atlanta</td><td>Braselton, GA</td><td>May 8 – 9</td><td>Aurimas Bakchis</td></tr>
        <tr><td>3</td><td>Uncharted Territory</td><td></td><td></td><td>June 5 – 6</td><td>Ryan Tuerck</td></tr>
        <tr><td>4</td><td>The Gauntlet</td><td>Wall Township Speedway</td><td>Wall Township, NJ</td><td>June 26 – 27</td><td>Fredric Aasbø</td></tr>
        <tr><td>5</td><td>Throwdown</td><td></td><td></td><td>July 24 – 25</td><td>Fredric Aasbø</td></tr>
        <tr><td>6</td><td>Showdown</td><td></td><td></td><td>August 21 – 22</td><td>Masashi Yokoi</td></tr>
        <tr><td>7</td><td>Title Fight</td><td></td><td></td><td>October 9 – 10</td><td>Fredric Aasbø</td></tr>
      </table>
      <table>
        <tr><th>Pos</th><th>Driver</th><th>LBH</th><th>ATL</th><th>ORL</th><th>WTS</th><th>EVS</th><th>TEX</th><th>IRW</th><th>Points</th></tr>
        <tr><td>1</td><td>Fredric Aasbø</td><td>105</td><td>38</td><td>19</td><td>106</td><td>105</td><td>55</td><td>104</td><td>532</td></tr>
      </table>
    `;

    const season = parseWikipediaSeasonHtml(html, 2015);
    assert.equal(season.events[2]?.name, 'Uncharted Territory');
    assert.equal(season.events[2]?.trackName, 'Orlando Speed World');
    assert.equal(season.events[4]?.trackName, 'Evergreen Speedway');
    assert.equal(season.pilots[0]?.stages.filter((stage) => stage.tandemPosition === 1).length, 4);
  });
});
