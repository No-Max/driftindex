import * as cheerio from 'cheerio';
import type { FdSeasonData } from './formula-drift.js';
import { matchNewsPilot } from './formula-drift-2025-news.js';

const WAYBACK = 'https://web.archive.org/web';

export const FD_2025_RESULT_SNAPSHOTS = [
  { round: 1, slug: 'long-beach', timestamp: '20260512003719' },
  { round: 2, slug: 'atlanta', timestamp: '20260517055147' },
  { round: 3, slug: 'orlando', timestamp: '20260511233525' },
  { round: 4, slug: 'englishtown', timestamp: '20250709055737' },
  { round: 5, slug: 'st-louis', timestamp: '20260518035723' },
  { round: 6, slug: 'seattle', timestamp: '20260518034125' },
  { round: 7, slug: 'grantsville', timestamp: '20260420132134' },
  { round: 8, slug: 'long-beach2', timestamp: '20260516103301' },
] as const;

export interface FdBracketSeed {
  seed: number;
  name: string;
}

export function parseMainEventSeeds(html: string): FdBracketSeed[] {
  const $ = cheerio.load(html);
  const rows: FdBracketSeed[] = [];
  const seen = new Set<number>();

  $('.mainbracket .round-one li.team').each((_, element) => {
    const seed = Number.parseInt($(element).find('.qlfynum').first().text().trim(), 10);
    const name = $(element).find('a').first().text().replace(/\s+/g, ' ').trim();
    if (!Number.isFinite(seed) || seed < 1 || !name || seen.has(seed)) return;
    seen.add(seed);
    rows.push({ seed, name });
  });

  return rows.sort((a, b) => a.seed - b.seed);
}

async function fetchResultHtml(slug: string, timestamp: string): Promise<string> {
  const headers = { accept: 'text/html', 'user-agent': 'DriftIndexImporter/1.0' };
  const urls = [
    `${WAYBACK}/${timestamp}id_/https://www.formulad.com/results/2025/${slug}/pro`,
    `${WAYBACK}/${timestamp}/https://www.formulad.com/results/2025/${slug}/pro`,
  ];

  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        lastError = new Error(`${response.status} ${url}`);
        continue;
      }
      const html = await response.text();
      if (parseMainEventSeeds(html).length >= 16) return html;
      lastError = new Error(`No Top 32 seeds in ${url}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error(`Failed to fetch 2025/${slug} results`);
}

export async function enrichFormulaDrift2025QualSeeds(season: FdSeasonData): Promise<FdSeasonData> {
  const unmatched: string[] = [];

  for (const snapshot of FD_2025_RESULT_SNAPSHOTS) {
    const event = season.events.find((item) => item.roundNumber === snapshot.round);
    if (!event) throw new Error(`Missing Formula Drift 2025 event for round ${snapshot.round}`);

    const html = await fetchResultHtml(snapshot.slug, snapshot.timestamp);
    const seeds = parseMainEventSeeds(html);
    if (seeds.length < 16) {
      throw new Error(`Formula Drift 2025 R${snapshot.round} only has ${seeds.length} qual seeds`);
    }

    for (const row of seeds) {
      const pilot = matchNewsPilot(season.pilots, row.name);
      if (!pilot) {
        unmatched.push(`R${snapshot.round} Q${row.seed} ${row.name}`);
        continue;
      }
      const stage = pilot.stages.find((item) => item.roundNumber === event.roundNumber);
      if (stage) {
        stage.qualifyingPosition = row.seed;
        continue;
      }
      pilot.stages.push({
        eventSlug: event.slug,
        roundNumber: event.roundNumber,
        qualifyingPosition: row.seed,
        qualifyingPoints: null,
        qualScore100: null,
        tandemPosition: null,
        points: 0,
      });
    }

    console.log(`Formula Drift 2025 R${snapshot.round}: ${seeds.length} main-event qual seeds`);
  }

  if (unmatched.length > 0) {
    throw new Error(`Unmatched Formula Drift 2025 qual seeds:\n${unmatched.join('\n')}`);
  }

  for (const pilot of season.pilots) {
    pilot.stages.sort((a, b) => a.roundNumber - b.roundNumber);
  }

  return season;
}
