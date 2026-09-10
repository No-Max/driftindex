import * as cheerio from 'cheerio';
import { almanacRdsSeasonSlug } from './rds-almanac.js';
import { enrichBattleNumbers, normalizeBattleName, type BattlePilotRef } from '../lib/battleMatch.js';

const BASE = 'https://driftalmanac.ru';

export interface AlmanacEventBattles {
  almanacEventId: string;
  roundNumber: number;
  duels: Array<[BattlePilotRef, BattlePilotRef]>;
}

async function fetchHtml(url: string): Promise<string | null> {
  const response = await fetch(url, {
    headers: { accept: 'text/html', 'user-agent': 'DriftIndexImporter/1.0' },
  });
  if (!response.ok) return null;
  return response.text();
}

function parsePilotRow($row: cheerio.Cheerio<any>): Omit<BattlePilotRef, 'isWinner'> | null {
  const name = $row.find('.truncate').first().text().trim();
  if (!name || name === '—') return null;
  return { name, number: null };
}

function isWinnerRow($row: cheerio.Cheerio<any>): boolean {
  const cls = $row.attr('class') ?? '';
  return cls.includes('font-semibold') || $row.text().includes('🥇');
}

/** Parse Drift Almanac /event/{id}/battles bracket cards. */
export function parseAlmanacBattlesHtml(html: string): Array<[BattlePilotRef, BattlePilotRef]> {
  const $ = cheerio.load(html);
  const duels: Array<[BattlePilotRef, BattlePilotRef]> = [];

  $('*').each((_, element) => {
    const cls = $(element).attr('class') ?? '';
    if (!cls.includes('rounded-[16px]') || !cls.includes('border-light-gray') || !cls.includes('bg-primary-white')) {
      return;
    }

    const pilots: BattlePilotRef[] = [];
    const card = $(element);

    const grid = card.find('div[class*="grid-cols"]').first();
    if (grid.length > 0) {
      const numbers = grid
        .find('span.racing-number')
        .map((__, node) => {
          const text = $(node).text().trim();
          if (text === '—') return null;
          const parsed = Number.parseInt(text, 10);
          return Number.isFinite(parsed) ? parsed : null;
        })
        .get();

      grid.find('span.flex.items-center').each((index, row) => {
        const parsed = parsePilotRow($(row));
        if (!parsed) return;
        pilots.push({
          ...parsed,
          number: numbers[index] ?? parsed.number,
          isWinner: isWinnerRow($(row)),
        });
      });
    } else {
      card.find('span.flex.items-center').each((__, row) => {
        const parsed = parsePilotRow($(row));
        if (!parsed) return;
        pilots.push({ ...parsed, isWinner: isWinnerRow($(row)) });
      });
    }

    if (pilots.length === 2) {
      duels.push([pilots[0]!, pilots[1]!]);
    }
  });

  return duels;
}

interface AlmanacSeasonEventMeta {
  almanacEventId: string;
  roundNumber: number;
}

function parseSeasonEventList(html: string): AlmanacSeasonEventMeta[] {
  const $ = cheerio.load(html);
  const events: AlmanacSeasonEventMeta[] = [];

  $('a[href*="/event/"]').each((_, element) => {
    const href = $(element).attr('href') ?? '';
    const almanacEventId = href.match(/\/event\/(\d+)/)?.[1];
    if (!almanacEventId || events.some((event) => event.almanacEventId === almanacEventId)) return;

    const cardText = $(element).text();
    if (!/этап/i.test(cardText)) return;

    events.push({
      almanacEventId,
      roundNumber: events.length + 1,
    });
  });

  return events;
}

export async function fetchAlmanacSeasonBattles(seasonYear: number): Promise<AlmanacEventBattles[]> {
  const seasonSlug = almanacRdsSeasonSlug(seasonYear);
  const seasonUrl = `${BASE}/championship/rds/${seasonSlug}`;
  const seasonHtml = await fetchHtml(seasonUrl);
  if (!seasonHtml) return [];

  const eventMetas = parseSeasonEventList(seasonHtml);
  const results: AlmanacEventBattles[] = [];

  for (const meta of eventMetas) {
    const battlesUrl = `${BASE}/event/${meta.almanacEventId}/battles`;
    const battlesHtml = await fetchHtml(battlesUrl);
    if (!battlesHtml) continue;

    const duels = parseAlmanacBattlesHtml(battlesHtml);
    if (duels.length === 0) continue;

    results.push({
      almanacEventId: meta.almanacEventId,
      roundNumber: meta.roundNumber,
      duels,
    });
  }

  return results;
}

function ambiguousNameNumbers(duels: Array<[BattlePilotRef, BattlePilotRef]>): Set<string> {
  const numbersByName = new Map<string, Set<number>>();
  for (const duel of duels) {
    for (const pilot of duel) {
      if (pilot.number == null) continue;
      const key = normalizeBattleName(pilot.name);
      const numbers = numbersByName.get(key) ?? new Set<number>();
      numbers.add(pilot.number);
      numbersByName.set(key, numbers);
    }
  }
  return new Set(
    [...numbersByName.entries()]
      .filter(([, numbers]) => numbers.size > 1)
      .map(([name]) => name),
  );
}

export function aggregatePilotBattles(
  duels: Array<[BattlePilotRef, BattlePilotRef]>,
): Map<string, { battles: number; wins: number; number: number | null; name: string }> {
  const enriched = enrichBattleNumbers(duels);
  const ambiguous = ambiguousNameNumbers(enriched);
  const totals = new Map<string, { battles: number; wins: number; number: number | null; name: string }>();

  for (const duel of enriched) {
    for (const pilot of duel) {
      const nameKey = normalizeBattleName(pilot.name);
      if (pilot.number == null && ambiguous.has(nameKey)) continue;

      const key = `${pilot.number ?? ''}|${nameKey}`;
      const current = totals.get(key) ?? {
        battles: 0,
        wins: 0,
        number: pilot.number,
        name: pilot.name,
      };
      if (pilot.number != null) current.number = pilot.number;
      current.battles += 1;
      if (pilot.isWinner) current.wins += 1;
      totals.set(key, current);
    }
  }

  return totals;
}
