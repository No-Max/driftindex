import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { parseLegacyStandingsHtml } from './formula-drift-legacy-standings.js';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

describe('parseLegacyStandingsHtml', () => {
  it('parses archived 2006 standings.php table', () => {
    const html = readFileSync(join(fixtureDir, 'formula-drift-2006-standings.wayback.html'), 'utf8');
    const season = parseLegacyStandingsHtml(html, 2006);

    assert.equal(season.seasonYear, 2006);
    assert.equal(season.events.length, 7);
    assert.equal(season.events[0]?.trackName, 'Streets of Long Beach');
    assert.equal(season.events[6]?.trackName, 'Irwindale Speedway');

    const hubinette = season.pilots.find((pilot) => pilot.slug === 'samuel-hubinette');
    assert.ok(hubinette);
    assert.equal(hubinette.stages.length, 7);
    assert.equal(hubinette.stages[0]?.points, 104);
    assert.equal(hubinette.stages.reduce((sum, stage) => sum + stage.points, 0), 629);

    const millen = season.pilots.find((pilot) => pilot.slug === 'rhys-millen');
    assert.equal(millen?.stages.reduce((sum, stage) => sum + stage.points, 0), 596);
  });

  it('parses reconstructed 2005 standings fixture (six rounds)', () => {
    const html = readFileSync(join(fixtureDir, 'formula-drift-2005-standings.wayback.html'), 'utf8');
    const season = parseLegacyStandingsHtml(html, 2005);

    assert.equal(season.seasonYear, 2005);
    assert.equal(season.events.length, 6);
    assert.equal(season.events[0]?.trackName, 'Wall Speedway');
    assert.equal(season.events[5]?.trackName, 'Irwindale Speedway');
    assert.equal(season.pilots.length, 32);

    const millen = season.pilots.find((pilot) => pilot.slug === 'rhys-millen');
    assert.ok(millen);
    assert.equal(millen.stages.length, 6);
    assert.ok((millen.stages.reduce((sum, stage) => sum + stage.points, 0) ?? 0) >= 490);

    const hubinette = season.pilots.find((pilot) => pilot.slug === 'samuel-hubinette');
    assert.ok(hubinette);
    assert.ok((hubinette.stages.reduce((sum, stage) => sum + stage.points, 0) ?? 0) >= 470);
  });

  it('parses reconstructed 2004 standings fixture (four rounds)', () => {
    const html = readFileSync(join(fixtureDir, 'formula-drift-2004-standings.wayback.html'), 'utf8');
    const season = parseLegacyStandingsHtml(html, 2004);

    assert.equal(season.seasonYear, 2004);
    assert.equal(season.events.length, 4);
    assert.equal(season.events[0]?.trackName, 'Road Atlanta');
    assert.equal(season.events[3]?.trackName, 'Irwindale Speedway');
    assert.equal(season.pilots.length, 26);

    const hubinette = season.pilots.find((pilot) => pilot.slug === 'samuel-hubinette');
    assert.ok(hubinette);
    assert.equal(hubinette.stages.length, 4);
    assert.equal(hubinette.stages.reduce((sum, stage) => sum + stage.points, 0), 373);
  });
});
