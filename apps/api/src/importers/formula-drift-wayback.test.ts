import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  namesFromWaybackDriverSlug,
  parseFormulaDrift2007StandingsHtml,
  parseWaybackPointsCell,
} from './formula-drift-wayback.js';

describe('namesFromWaybackDriverSlug', () => {
  it('expands archived last-name links', () => {
    assert.deepEqual(namesFromWaybackDriverSlug('tanner-foust'), {
      firstName: 'Tanner',
      lastName: 'Foust',
      nameAlias: 'Tanner Foust',
    });
    assert.deepEqual(namesFromWaybackDriverSlug('vaughn-gittin-jr'), {
      firstName: 'Vaughn',
      lastName: 'Gittin Jr',
      nameAlias: 'Vaughn Gittin Jr',
    });
    assert.deepEqual(namesFromWaybackDriverSlug('doug-van-den-brink'), {
      firstName: 'Doug',
      lastName: 'Van Den Brink',
      nameAlias: 'Doug Van Den Brink',
    });
  });
});

describe('parseWaybackPointsCell', () => {
  it('reads leading-dot tenths from the 2007 table', () => {
    assert.equal(parseWaybackPointsCell('.25'), 0.25);
    assert.equal(parseWaybackPointsCell(''), null);
    assert.equal(parseWaybackPointsCell('100'), 100);
  });
});

describe('parseFormulaDrift2007StandingsHtml', () => {
  it('pairs qualifying and competition columns into combined points', () => {
    const html = `
      <table>
        ${'<tr><td></td></tr>'.repeat(20)}
        <tr>
          <td></td><td>1</td><td>34</td>
          <td><a href="/drivers/tanner-foust.html">Foust</a></td>
          <td>8</td><td>88</td>
          <td>8</td><td>78</td>
          <td>7</td><td>88</td>
          <td>8</td><td>61</td>
          <td>8</td><td>61</td>
          <td>7</td><td>78</td>
          <td>8</td><td>100</td>
          <td></td><td>608</td>
        </tr>
        <tr>
          <td></td><td>5</td><td>1</td>
          <td><a href="/drivers/samuel-hubinette.html">Hubinette</a></td>
          <td>3</td><td>61</td>
          <td>.25</td><td>0</td>
          <td>3</td><td>100</td>
          <td>7</td><td>61</td>
          <td>5</td><td>61</td>
          <td>3</td><td>54</td>
          <td>5</td><td>54</td>
          <td></td><td>417.25</td>
        </tr>
      </table>
    `;

    const season = parseFormulaDrift2007StandingsHtml(html);
    assert.equal(season.seasonYear, 2007);
    assert.equal(season.events.length, 7);
    assert.equal(season.events[2]?.trackName, 'Summit Point Raceway');

    const foust = season.pilots.find((pilot) => pilot.slug === 'tanner-foust');
    assert.ok(foust);
    assert.equal(foust.number, 34);
    assert.equal(foust.stages.reduce((sum, stage) => sum + stage.points, 0), 608);
    assert.equal(foust.stages.at(-1)?.tandemPosition, 1);
    assert.equal(foust.stages[0]?.qualifyingPoints, 8);

    const hubinette = season.pilots.find((pilot) => pilot.slug === 'samuel-hubinette');
    assert.equal(hubinette?.stages[1]?.qualifyingPoints, 0.25);
    assert.equal(hubinette?.stages[1]?.points, 0);
    assert.equal(hubinette?.stages[2]?.tandemPosition, 1);
  });
});
