import * as cheerio from 'cheerio';
import { englishNamesFromNameRu } from '../lib/transliterate.js';
import { enrichPilotsWithAlmanacCountries } from './almanac-pilot.js';
import type { RdsGpEvent, RdsGpPilot, RdsGpSeasonData, RdsGpStageResult } from './rds-gp.js';

const BASE = 'https://driftalmanac.ru';

export const RDS_ALMANAC_SEASONS = [2010, 2025] as const;

const RU_MONTHS: Record<string, number> = {
  января: 1,
  февраля: 2,
  марта: 3,
  апреля: 4,
  мая: 5,
  июня: 6,
  июля: 7,
  августа: 8,
  сентября: 9,
  октября: 10,
  ноября: 11,
  декабря: 12,
};

export function almanacRdsSeasonSlug(seasonYear: number): string {
  if (seasonYear === 2010 || seasonYear === 2025 || seasonYear === 2026) return String(seasonYear);
  if (seasonYear >= 2011 && seasonYear <= 2017) return `rds${seasonYear}`;
  if (seasonYear >= 2018 && seasonYear <= 2024) return `rdsgp${seasonYear}`;
  return String(seasonYear);
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { accept: 'text/html', 'user-agent': 'DriftIndexImporter/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

function parseRussianDate(text: string): string {
  const match = text.match(/(\d{1,2})(?:[–-]\d{1,2})?\s+([а-яё]+)\s+(\d{4})/i);
  if (!match) return new Date().toISOString();
  const day = Number.parseInt(match[1]!, 10);
  const month = RU_MONTHS[match[2]!.toLowerCase()];
  const year = Number.parseInt(match[3]!, 10);
  if (!month) return new Date().toISOString();
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
}

function parsePilotNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d+)/);
  return match ? Number.parseInt(match[1]!, 10) : null;
}

function splitRussianName(fullName: string): { firstName: string; lastName: string; nameAlias: string } {
  const nameAlias = fullName.trim();
  const english = englishNamesFromNameRu(nameAlias);
  return { ...english, nameAlias };
}

function parseResultCell(texts: string[]): { qualPosition: number | null; points: number | null } {
  if (texts.length < 2) return { qualPosition: null, points: null };
  const qualRaw = texts[0]!.trim();
  const pointsRaw = texts[1]!.trim();
  if (qualRaw === '—' || qualRaw === '–' || qualRaw === '-') {
    return { qualPosition: null, points: null };
  }
  const qualPosition = Number.parseInt(qualRaw, 10);
  const points = Number.parseInt(pointsRaw, 10);
  return {
    qualPosition: Number.isFinite(qualPosition) && qualPosition > 0 ? qualPosition : null,
    points: Number.isFinite(points) && points > 0 ? points : null,
  };
}

function eventSlugFromAlmanacId(eventId: string): string {
  return `da-e${eventId}`;
}

function pilotSlugFromAlmanacId(almanacPilotSlug: string): string {
  return almanacPilotSlug;
}

interface AlmanacEventMeta {
  id: string;
  roundNumber: number;
  nameRu: string;
  trackRu: string;
  trackEn: string;
  startsAt: string;
  status: 'FINISHED' | 'SCHEDULED' | 'CANCELLED';
}

function parseEventCards($: cheerio.CheerioAPI): AlmanacEventMeta[] {
  const events: AlmanacEventMeta[] = [];
  $('a[href*="/event/"]').each((_, element) => {
    const href = $(element).attr('href') ?? '';
    const id = href.match(/\/event\/(\d+)/)?.[1];
    if (!id) return;

    const cardText = $(element).text();
    if (!/этап/i.test(cardText)) return;
    if (events.some((event) => event.id === id)) return;

    const nameRu =
      $(element).find('.racing-title').first().text().trim() || `Этап ${events.length + 1}`;
    const locationLine =
      $(element)
        .find('.text-primary-gray')
        .first()
        .text()
        .trim() || '';
    const [trackRu = locationLine, city = ''] = locationLine.split('·').map((part) => part.trim());
    const trackLabel = [trackRu, city].filter(Boolean).join(', ') || trackRu;
    const dateText = $(element).find('span.racing-number.text-sm').last().text().trim();
    const finished = /заверш/i.test($(element).text());

    events.push({
      id,
      roundNumber: events.length + 1,
      nameRu,
      trackRu: trackLabel,
      trackEn: trackLabel,
      startsAt: parseRussianDate(dateText),
      status: finished ? 'FINISHED' : 'SCHEDULED',
    });
  });

  return events;
}

function scaleStagePoints(stages: RdsGpStageResult[], seasonTotal: number): void {
  const rawTotal = stages.reduce((sum, stage) => sum + stage.points, 0);
  if (rawTotal <= 0 || seasonTotal <= 0 || rawTotal === seasonTotal) return;

  let assigned = 0;
  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index]!;
    if (index === stages.length - 1) {
      stage.points = seasonTotal - assigned;
      continue;
    }
    const scaled = Math.round((stage.points / rawTotal) * seasonTotal);
    stage.points = scaled;
    assigned += scaled;
  }
}

function parseStandingsTable(
  $: cheerio.CheerioAPI,
  events: AlmanacEventMeta[],
): RdsGpPilot[] {
  const pilotMap = new Map<string, RdsGpPilot>();
  const table = $('table').first();

  table.find('tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < events.length + 3) return;

    const pilotLink = $(cells.eq(1)).find('a[href*="/pilot/"]').first();
    const almanacPilotSlug = pilotLink.attr('href')?.match(/\/pilot\/([^/?#]+)/)?.[1];
    const pilotName = pilotLink.text().trim();
    if (!almanacPilotSlug || !pilotName) return;

    const seasonTotal = Number.parseInt($(cells.eq(cells.length - 1)).text().trim(), 10);
    if (!Number.isFinite(seasonTotal) || seasonTotal <= 0) return;

    const slug = pilotSlugFromAlmanacId(almanacPilotSlug);
    const number = parsePilotNumber($(cells.eq(1)).text());
    const { firstName, lastName, nameAlias } = splitRussianName(pilotName);

    const stages: RdsGpStageResult[] = [];
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index]!;
      const cell = cells.eq(index + 2);
      const values: string[] = [];
      cell.find('span.tabular-nums').each((__, span) => {
        values.push($(span).text().trim());
      });
      const parsed = parseResultCell(values);
      if (parsed.points == null && parsed.qualPosition == null) continue;

      stages.push({
        eventSlug: eventSlugFromAlmanacId(event.id),
        roundNumber: event.roundNumber,
        qualifyingPosition: parsed.qualPosition,
        qualifyingPoints: parsed.qualPosition,
        qualScore100: null,
        tandemPosition: null,
        points: parsed.points ?? 0,
      });
    }

    if (stages.length === 0) return;
    scaleStagePoints(stages, seasonTotal);

    pilotMap.set(slug, {
      slug,
      firstName,
      lastName,
      nameAlias,
      country: null,
      number,
      photoSourceUrl: null,
      team: null,
      stages,
    });
  });

  return [...pilotMap.values()];
}

export async function listAlmanacRdsEvents(
  seasonYear: number,
): Promise<Array<{ almanacEventId: string; roundNumber: number }>> {
  const seasonSlug = almanacRdsSeasonSlug(seasonYear);
  const sourceUrl = `${BASE}/championship/rds/${seasonSlug}`;
  const html = await fetchHtml(sourceUrl);
  const $ = cheerio.load(html);
  return parseEventCards($).map((meta) => ({
    almanacEventId: meta.id,
    roundNumber: meta.roundNumber,
  }));
}

export async function fetchRdsAlmanacSeason(seasonYear: number): Promise<RdsGpSeasonData> {
  const seasonSlug = almanacRdsSeasonSlug(seasonYear);
  const sourceUrl = `${BASE}/championship/rds/${seasonSlug}`;
  const html = await fetchHtml(sourceUrl);
  const $ = cheerio.load(html);

  const eventMetas = parseEventCards($);
  if (eventMetas.length === 0) {
    throw new Error(`No events found on Drift Almanac for RDS GP ${seasonYear}`);
  }

  const events: RdsGpEvent[] = eventMetas.map((meta) => ({
    slug: eventSlugFromAlmanacId(meta.id),
    roundNumber: meta.roundNumber,
    name: meta.nameRu,
    trackName: meta.trackEn,
    startsAt: meta.startsAt,
    status: meta.status,
  }));

  const pilots = parseStandingsTable($, eventMetas);
  await enrichPilotsWithAlmanacCountries(pilots);

  return {
    sourceUrl,
    seasonYear,
    events,
    pilots,
  };
}
