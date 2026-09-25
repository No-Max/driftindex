import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseMainEventSeeds } from './formula-drift-2025-brackets.js';

describe('parseMainEventSeeds', () => {
  it('reads Top 32 seed numbers from the main bracket', () => {
    const html = `
      <section class="bracket-wrapper mainbracket">
        <div class="round round-one">
          <ul class="matchup">
            <li class="team team-top"><span class="qlfynum">1</span><a>James Deane</a></li>
            <li class="team team-bottom"><span class="qlfynum">32</span><a>Ryan Litteral</a></li>
          </ul>
          <ul class="matchup">
            <li class="team team-top"><span class="qlfynum">16</span><a>Trenton Beechum</a></li>
            <li class="team team-bottom"><span class="qlfynum">17</span><a></a></li>
          </ul>
        </div>
      </section>
    `;
    assert.deepEqual(parseMainEventSeeds(html), [
      { seed: 1, name: 'James Deane' },
      { seed: 16, name: 'Trenton Beechum' },
      { seed: 32, name: 'Ryan Litteral' },
    ]);
  });
});
