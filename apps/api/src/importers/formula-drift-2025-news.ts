import * as cheerio from 'cheerio';
import type { FdEvent, FdPilot, FdSeasonData, FdStageResult } from './formula-drift.js';

const NEWS_API = 'https://news.formulad.com/wp-json/wp/v2/posts';

interface NewsPost {
  title: string;
  link: string;
  html: string;
}

export interface FdNewsFinishRow {
  position: number;
  name: string;
}

export interface FdNewsQualRow {
  position: number;
  name: string;
  points: number;
}

export interface FdNewsRoundMeta {
  roundNumber: number;
  startsAt: string | null;
  location: string | null;
  venue: string | null;
  eventTitle: string | null;
  finish: FdNewsFinishRow[];
  seeding: FdNewsQualRow[];
  sourceUrl: string;
}

export function nameKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[`'’]/g, '')
    .replace(/\b(jr|sr|ii|iii)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function roundNumberFromNewsTitle(title: string): number | null {
  const numbered = title.match(/(?:FINAL\s+)?ROUND\s+(\d+)/i);
  if (numbered) return Number.parseInt(numbered[1]!, 10);
  if (/OPENING ROUND/i.test(title)) return 1;

  const venueRounds: Array<[RegExp, number]> = [
    [/LONG BEACH FINAL|FINAL ROUND/i, 8],
    [/UTAH|GRANTSVILLE/i, 7],
    [/SEATTLE/i, 6],
    [/ST\.?\s*LOUIS/i, 5],
    [/NEW JERSEY|ENGLISHTOWN|GAUNTLET/i, 4],
    [/ORLANDO/i, 3],
    [/ATLANTA/i, 2],
    [/LONG BEACH/i, 1],
  ];
  for (const [pattern, roundNumber] of venueRounds) {
    if (pattern.test(title)) return roundNumber;
  }
  return null;
}

export function parseNewsDriverTable(html: string): string[][] {
  const $ = cheerio.load(html);
  const tables: string[][][] = [];
  $('table').each((_, table) => {
    const rows: string[][] = [];
    $(table)
      .find('tr')
      .each((__, row) => {
        const cells = $(row)
          .find('th,td')
          .toArray()
          .map((cell) => $(cell).text().replace(/\s+/g, ' ').trim())
          .filter(Boolean);
        if (cells.length > 0) rows.push(cells);
      });
    if (rows.length > 0) tables.push(rows);
  });

  const driverTable = tables.find((rows) => {
    const header = rows[0]?.map((cell) => cell.toUpperCase()) ?? [];
    return header.includes('POSITION') && (header.includes('DRIVER') || header.includes('NAME'));
  });
  return driverTable ?? [];
}

export function finishRowsFromTable(rows: string[][]): FdNewsFinishRow[] {
  const finish: FdNewsFinishRow[] = [];
  const seen = new Set<string>();
  for (const row of rows.slice(1)) {
    const position = Number.parseInt(row[0] ?? '', 10);
    const name = row[1]?.trim();
    if (!Number.isFinite(position) || !name) continue;
    const key = nameKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    finish.push({ position: finish.length + 1, name });
  }
  return finish;
}

export function seedingRowsFromTable(rows: string[][]): FdNewsQualRow[] {
  const seeding: FdNewsQualRow[] = [];
  for (const row of rows.slice(1)) {
    const position = Number.parseInt(row[0] ?? '', 10);
    const name = row[1]?.trim();
    const points = Number.parseInt((row[2] ?? '').replace(/[^\d-]/g, ''), 10);
    if (!Number.isFinite(position) || !name) continue;
    seeding.push({
      position,
      name,
      points: Number.isFinite(points) ? points : 0,
    });
  }
  return seeding;
}

function parseEventDetails(html: string): {
  startsAt: string | null;
  location: string | null;
  eventTitle: string | null;
} {
  const $ = cheerio.load(html);
  const text = $('body').text().replace(/\s+/g, ' ');
  const dateMatch = text.match(
    /Date:\s*(?:[A-Za-z]+,\s*)?([A-Za-z]+\s+\d{1,2},\s+\d{4})/,
  );
  const locationMatch = text.match(/Location:\s*([^.]{8,120}?)(?:\s+Event:|\s+RESULTS|\s+NOTES|$)/);
  const eventMatch = text.match(/Event:\s*(.+?)(?:\s+RESULTS|\s+NOTES|$)/);
  const parsedDate = dateMatch ? Date.parse(dateMatch[1]!) : Number.NaN;
  const eventLine = eventMatch?.[1]?.trim() ?? null;
  const namedRound = eventLine?.match(/:\s*([^:]{3,80})$/)?.[1]?.trim() ?? null;
  return {
    startsAt: Number.isFinite(parsedDate) ? new Date(parsedDate).toISOString() : null,
    location: locationMatch?.[1]?.trim() ?? null,
    eventTitle: namedRound && !/competition|results|heats/i.test(namedRound) ? namedRound : null,
  };
}

function venueFromLocation(location: string | null): string | null {
  if (!location) return null;
  const venue = location.split(',')[0]?.trim();
  return venue || null;
}

async function fetchNewsPosts(): Promise<NewsPost[]> {
  const posts: NewsPost[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const url = new URL(NEWS_API);
    url.searchParams.set('per_page', '100');
    url.searchParams.set('after', '2025-01-01T00:00:00');
    url.searchParams.set('before', '2026-01-01T00:00:00');
    url.searchParams.set('page', String(page));
    const response = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'DriftIndexImporter/1.0' },
    });
    if (response.status === 400) break;
    if (!response.ok) {
      throw new Error(`Failed to fetch Formula Drift news: ${response.status}`);
    }
    const payload = (await response.json()) as Array<{
      title: { rendered: string };
      link: string;
      content: { rendered: string };
    }>;
    if (payload.length === 0) break;
    for (const post of payload) {
      posts.push({
        title: post.title.rendered.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'),
        link: post.link,
        html: post.content.rendered,
      });
    }
    if (payload.length < 100) break;
  }
  return posts;
}

function isProspecOnly(title: string): boolean {
  return /PROSPEC/i.test(title) && !/PRO/i.test(title.replace(/PROSPEC/gi, ''));
}

function isProCompetitionPost(title: string): boolean {
  return /COMPETITION RESULTS/i.test(title) && !isProspecOnly(title) && !/SUPER DRIFT/i.test(title);
}

function isProSeedingPost(title: string): boolean {
  return /SEEDING/i.test(title) && !isProspecOnly(title) && !/COMPETITION RESULTS/i.test(title);
}

export async function loadFormulaDrift2025News(): Promise<Map<number, FdNewsRoundMeta>> {
  const posts = await fetchNewsPosts();
  const rounds = new Map<number, FdNewsRoundMeta>();

  const ensure = (roundNumber: number, sourceUrl: string): FdNewsRoundMeta => {
    const existing = rounds.get(roundNumber);
    if (existing) return existing;
    const created: FdNewsRoundMeta = {
      roundNumber,
      startsAt: null,
      location: null,
      venue: null,
      eventTitle: null,
      finish: [],
      seeding: [],
      sourceUrl,
    };
    rounds.set(roundNumber, created);
    return created;
  };

  for (const post of posts) {
    if (!isProCompetitionPost(post.title)) continue;
    const roundNumber = roundNumberFromNewsTitle(post.title);
    if (!roundNumber) continue;
    const round = ensure(roundNumber, post.link);
    const details = parseEventDetails(post.html);
    round.startsAt = details.startsAt ?? round.startsAt;
    round.location = details.location ?? round.location;
    round.venue = venueFromLocation(round.location);
    round.eventTitle = details.eventTitle ?? round.eventTitle;
    round.finish = finishRowsFromTable(parseNewsDriverTable(post.html));
    round.sourceUrl = post.link;
  }

  for (const post of posts) {
    if (!isProSeedingPost(post.title)) continue;
    const roundNumber = roundNumberFromNewsTitle(post.title);
    if (!roundNumber) continue;
    const round = ensure(roundNumber, post.link);
    round.seeding = seedingRowsFromTable(parseNewsDriverTable(post.html));
  }

  return rounds;
}

export function matchNewsPilot(pilots: FdPilot[], rawName: string): FdPilot | null {
  const key = nameKey(rawName);
  const exact = pilots.find((pilot) => {
    const full = nameKey(`${pilot.firstName} ${pilot.lastName}`);
    const alias = nameKey(pilot.nameAlias ?? '');
    return full === key || alias === key;
  });
  if (exact) return exact;

  const tokens = key.split(' ').filter(Boolean);
  if (tokens.length === 0) return null;
  if (tokens.length === 1) {
    const hits = pilots.filter(
      (pilot) => nameKey(pilot.lastName) === tokens[0] || nameKey(pilot.firstName) === tokens[0],
    );
    return hits.length === 1 ? hits[0]! : null;
  }

  const first = tokens[0]!;
  const last = tokens[tokens.length - 1]!;
  const hits = pilots.filter((pilot) => {
    const pilotFirst = nameKey(pilot.firstName);
    const pilotLast = nameKey(pilot.lastName);
    const lastOk = pilotLast === last;
    const firstOk =
      pilotFirst === first || pilotFirst.startsWith(first) || first.startsWith(pilotFirst);
    return lastOk && firstOk;
  });
  return hits.length === 1 ? hits[0]! : null;
}

function ensureStage(pilot: FdPilot, event: FdEvent): FdStageResult {
  const existing = pilot.stages.find((stage) => stage.roundNumber === event.roundNumber);
  if (existing) return existing;
  const stage: FdStageResult = {
    eventSlug: event.slug,
    roundNumber: event.roundNumber,
    qualifyingPosition: null,
    qualifyingPoints: null,
    qualScore100: null,
    tandemPosition: null,
    points: 0,
  };
  pilot.stages.push(stage);
  return stage;
}

export async function enrichFormulaDrift2025FromNews(season: FdSeasonData): Promise<FdSeasonData> {
  const news = await loadFormulaDrift2025News();
  const unmatched: string[] = [];

  for (const event of season.events) {
    const round = news.get(event.roundNumber);
    if (!round) {
      throw new Error(`Missing Formula Drift 2025 news for round ${event.roundNumber}`);
    }
    if (round.finish.length === 0) {
      throw new Error(`Missing Formula Drift 2025 finish order for round ${event.roundNumber}`);
    }

    if (round.eventTitle) event.name = round.eventTitle;
    else if (round.venue) event.name = round.venue;
    if (round.location) event.trackName = round.location;
    if (round.startsAt) event.startsAt = round.startsAt;

    const placed = new Set<string>();
    for (const row of round.finish) {
      const pilot = matchNewsPilot(season.pilots, row.name);
      if (!pilot) {
        unmatched.push(`R${event.roundNumber} finish ${row.position} ${row.name}`);
        continue;
      }
      const stage = ensureStage(pilot, event);
      stage.tandemPosition = row.position;
      placed.add(pilot.slug);
    }

    const missingFinishers = season.pilots.filter((pilot) => {
      if (placed.has(pilot.slug)) return false;
      const stage = pilot.stages.find((item) => item.roundNumber === event.roundNumber);
      return (stage?.points ?? 0) > 0;
    });
    if (missingFinishers.length === 1 && round.finish.length >= 15) {
      const pilot = missingFinishers[0]!;
      const stage = ensureStage(pilot, event);
      stage.tandemPosition = placed.size + 1;
      placed.add(pilot.slug);
      console.log(
        `Formula Drift 2025 R${event.roundNumber}: filled missing finisher ${pilot.nameAlias} as P${stage.tandemPosition}`,
      );
    }

    for (const row of round.seeding) {
      const pilot = matchNewsPilot(season.pilots, row.name);
      if (!pilot) {
        unmatched.push(`R${event.roundNumber} seeding ${row.position} ${row.name}`);
        continue;
      }
      const stage = ensureStage(pilot, event);
      stage.qualifyingPosition = row.position;
      if (stage.qualifyingPoints == null) stage.qualifyingPoints = row.points;
    }
  }

  if (unmatched.length > 0) {
    throw new Error(`Unmatched Formula Drift 2025 news names:\n${unmatched.join('\n')}`);
  }

  for (const pilot of season.pilots) {
    for (const stage of pilot.stages) {
      stage.points += stage.qualifyingPoints ?? 0;
    }
    pilot.stages.sort((a, b) => a.roundNumber - b.roundNumber);
  }

  return season;
}
