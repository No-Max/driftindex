import * as cheerio from 'cheerio';

const BASE = 'https://www.formulad.com';

type ArchiveColumnKind = 'qual' | 'finish' | 'seed' | 'skip';

interface ArchiveEventColumn {
  roundNumber: number;
  name: string;
  slug: string;
  kind: ArchiveColumnKind;
}

interface ArchiveTableLayout {
  events: ArchiveEventColumn[];
}

export interface FdStageResult {
  eventSlug: string;
  roundNumber: number;
  qualifyingPosition: number | null;
  qualifyingPoints: number | null;
  qualScore100: number | null;
  tandemPosition: number | null;
  points: number;
}

export interface FdPilot {
  slug: string;
  fdDriverId: number;
  firstName: string;
  lastName: string;
  nameAlias: string | null;
  country: string | null;
  number: number | null;
  photoSourceUrl: string | null;
  team: string | null;
  stages: FdStageResult[];
}

export interface FdEvent {
  fdEventId: number;
  slug: string;
  roundNumber: number;
  name: string;
  trackName: string;
  startsAt: string;
  status: 'FINISHED' | 'SCHEDULED' | 'CANCELLED';
  country?: string | null;
}

export interface FdSeasonData {
  sourceUrl: string;
  seasonYear: number;
  events: FdEvent[];
  pilots: FdPilot[];
}

interface FdStandingsDoc {
  year: number;
  entries: Array<{
    rank: number;
    driver: number;
    points: number;
    rounds: Array<{
      event: number;
      rank: number;
      qualifyingPoints: number;
      competitionPoints: number;
      points: number;
    }>;
  }>;
}

interface ParsedDriver {
  fdDriverId: number;
  driverSlug: string;
  name: string;
  country: string | null;
  number: number | null;
  photoSourceUrl: string | null;
}

interface ParsedEventMeta {
  fdEventId: number;
  slug: string;
  roundNumber: number;
  roundName: string;
  location: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface ParsedQualEntry {
  fdEventId: number;
  fdDriverId: number | null;
  driverSlug: string | null;
  driverName: string | null;
  qualPosition: number;
  qualScore100: number | null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'DriftIndexImporter/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json() as Promise<T>;
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

function decodeRscChunk(raw: string): string {
  return raw
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function extractRscChunks(html: string): string[] {
  return [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"])*)"\]\)/g)].map(
    (match) => match[1]!,
  );
}

async function fetchRscText(url: string): Promise<string> {
  const html = await fetchHtml(url);
  const chunks = extractRscChunks(html);
  if (chunks.length === 0) {
    throw new Error(`No RSC payload in ${url}`);
  }
  return chunks.map((chunk) => decodeRscChunk(chunk)).join('');
}

async function fetchLargestRscText(url: string): Promise<string> {
  const html = await fetchHtml(url);
  const chunks = extractRscChunks(html);
  if (chunks.length === 0) {
    throw new Error(`No RSC payload in ${url}`);
  }
  const largest = chunks.reduce((best, chunk) => (chunk.length > best.length ? chunk : best), '');
  return decodeRscChunk(largest);
}

function parseDriverName(rawName: string): { firstName: string; lastName: string } {
  const parts = rawName.trim().split(/\s+/);
  if (parts.length === 1) {
    const only = titleCase(parts[0]!);
    return { firstName: only, lastName: only };
  }
  return {
    firstName: titleCase(parts[0]!),
    lastName: titleCase(parts.slice(1).join(' ')),
  };
}

function titleCase(value: string): string {
  return value
    .split(/([\s-'])/)
    .map((part) => {
      if (/^[A-Z]{2,3}$/.test(part)) return part;
      const lower = part.toLowerCase();
      return /^[a-z]/i.test(part) ? lower.charAt(0).toUpperCase() + lower.slice(1) : part;
    })
    .join('');
}

function eventSlug(slug: string): string {
  return `fd-${slug}`;
}

function pilotSlug(driverSlug: string): string {
  return driverSlug;
}

function absoluteMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

function mapEventStatus(status: string, endDate: string): FdEvent['status'] {
  if (status === 'completed' || status === 'finished') return 'FINISHED';
  if (status === 'cancelled') return 'CANCELLED';
  const end = Date.parse(endDate);
  if (Number.isFinite(end) && end < Date.now()) return 'FINISHED';
  return 'SCHEDULED';
}

function parseEventSlugsFromStandingsPage(rscText: string, seasonYear: number): string[] {
  const pattern = new RegExp(`href":"/results/${seasonYear}/([^/]+)/pro"`, 'g');
  const slugs: string[] = [];
  for (const match of rscText.matchAll(pattern)) {
    const slug = match[1]!;
    if (!slugs.includes(slug)) slugs.push(slug);
  }
  return slugs;
}

const NON_PORTRAIT_MEDIA =
  /vehicle|background|highlights|event-nav|header|1200x630|1400x934|1920x|cta|splash|podium|stf-header/i;

function isExcludedMedia(path: string): boolean {
  if (/portrait_banner/i.test(path)) return false;
  if (/banner/i.test(path)) return true;
  return NON_PORTRAIT_MEDIA.test(path);
}

function driverSlugInFilename(driverSlug: string, filename: string): boolean {
  const norm = driverSlug.replace(/-/g, '').toLowerCase();
  const file = filename.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (file.includes(norm)) return true;

  const parts = driverSlug.split('-').filter(Boolean);
  const lastName = parts.at(-1) ?? '';
  const firstName = parts[0] ?? '';
  if (lastName.length < 4) return false;
  return file.includes(lastName) && file.includes(firstName.slice(0, Math.min(4, firstName.length)));
}

function pickPortraitFromPaths(paths: string[], driverSlug: string): string | null {
  const portrait = paths.filter((path) => !isExcludedMedia(path));
  if (portrait.length === 0) return null;

  const named = portrait.filter((path) => driverSlugInFilename(driverSlug, path));
  const candidates = named.length > 0 ? named : portrait;

  const preferred =
    candidates.find(
      (path) =>
        driverSlugInFilename(driverSlug, path) &&
        /^[A-Za-z0-9_-]+\.(?:png|jpg|webp)$/i.test(path) &&
        !/banner/i.test(path),
    ) ??
    candidates.find((path) =>
      /-(?:2[56789]\d|3\d{2})x(?:2[56789]\d|3\d{2})\.(?:png|jpg|webp)$/i.test(path),
    ) ??
    candidates.find((path) => /portrait_banner/i.test(path)) ??
    candidates.find((path) => /portrait/i.test(path)) ??
    candidates.find((path) => /^[A-Za-z0-9_-]+\.(?:png|jpg|webp)$/i.test(path)) ??
    candidates[0];

  return preferred ? absoluteMediaUrl(`/api/media/file/${preferred}`) : null;
}

function pickPortraitPhoto(rscText: string, startIndex: number, driverSlug: string): string | null {
  const paths = [
    ...rscText
      .slice(Math.max(0, startIndex - 1500), startIndex + 6500)
      .matchAll(/"\/api\/media\/file\/([^"]+\.(?:png|jpg|webp))"/gi),
  ].map((match) => match[1]!);

  return pickPortraitFromPaths(paths, driverSlug);
}

function parseMediaPathsFromHtml(html: string): string[] {
  return [...html.matchAll(/\/api\/media\/file\/([^"'\\]+\.(?:png|jpg|webp))/gi)].map(
    (match) => match[1]!,
  );
}

async function fetchDriverProfilePhoto(driverSlug: string): Promise<string | null> {
  try {
    const html = await fetchHtml(`${BASE}/drivers/${driverSlug}`);
    return pickPortraitFromPaths(parseMediaPathsFromHtml(html), driverSlug);
  } catch {
    return null;
  }
}

function photoMatchesDriverSlug(photoSourceUrl: string | null, driverSlug: string): boolean {
  if (!photoSourceUrl) return false;
  const filename = photoSourceUrl.split('/').pop() ?? '';
  return driverSlugInFilename(driverSlug, filename);
}

async function enrichDriverPhotos(drivers: Map<number, ParsedDriver>): Promise<void> {
  const slugsNeedingPhoto = new Set<string>();

  for (const driver of drivers.values()) {
    if (!photoMatchesDriverSlug(driver.photoSourceUrl, driver.driverSlug)) {
      slugsNeedingPhoto.add(driver.driverSlug);
    }
  }

  if (slugsNeedingPhoto.size === 0) return;

  const profilePhotos = new Map<string, string>();
  for (const driverSlug of slugsNeedingPhoto) {
    const photoSourceUrl = await fetchDriverProfilePhoto(driverSlug);
    if (photoSourceUrl) profilePhotos.set(driverSlug, photoSourceUrl);
  }

  for (const [fdDriverId, driver] of drivers) {
    if (photoMatchesDriverSlug(driver.photoSourceUrl, driver.driverSlug)) continue;
    const photoSourceUrl = profilePhotos.get(driver.driverSlug) ?? null;
    if (photoSourceUrl) {
      drivers.set(fdDriverId, { ...driver, photoSourceUrl });
    }
  }
}

function parseDriverPhotosBySlug(rscText: string): Map<string, string> {
  const photos = new Map<string, string>();

  for (const match of rscText.matchAll(/"driverSlug":"([^"]+)"/g)) {
    const driverSlug = match[1]!;
    if (photos.has(driverSlug)) continue;
    const photoSourceUrl = pickPortraitPhoto(rscText, match.index ?? 0, driverSlug);
    if (photoSourceUrl) photos.set(driverSlug, photoSourceUrl);
  }

  return photos;
}

function parseDriversFromRsc(rscText: string, photosBySlug = parseDriverPhotosBySlug(rscText)): ParsedDriver[] {
  const drivers = new Map<number, ParsedDriver>();
  const pattern =
    /"id":(\d+),"driverSlug":"([^"]+)","rookie":(?:true|false),"isComingSoon":(?:true|false),"name":"([^"]+)"/g;

  for (const match of rscText.matchAll(pattern)) {
    const fdDriverId = Number.parseInt(match[1]!, 10);
    const driverSlug = match[2]!;
    const name = match[3]!;

    const window = rscText.slice(match.index ?? 0, (match.index ?? 0) + 2500);
    const countryMatch = window.match(
      /"nationality":\{"id":\d+,"name":"[^"]*","code":"([^"]+)"/,
    );
    const numberMatch = window.match(/"number":(\d+)/);

    drivers.set(fdDriverId, {
      fdDriverId,
      driverSlug,
      name,
      country: countryMatch?.[1] ?? null,
      number: numberMatch ? Number.parseInt(numberMatch[1]!, 10) : null,
      photoSourceUrl: photosBySlug.get(driverSlug) ?? null,
    });
  }

  return [...drivers.values()];
}

function parseQualScoresByPosition(rscText: string): Map<number, number> {
  const scores = new Map<number, number>();

  for (const match of rscText.matchAll(
    /"position":(\d+),"seedNumber":(\d+),"totalScore":([\d.]+)/g,
  )) {
    const position = Number.parseInt(match[1]!, 10);
    const seedNumber = Number.parseInt(match[2]!, 10);
    if (position !== seedNumber) continue;
    scores.set(position, Number.parseFloat(match[3]!));
  }

  return scores;
}

function parseEventMetaFromResultsRsc(rscText: string): ParsedEventMeta | null {
  const match = rscText.match(
    /"event":\{"id":(\d+),"year":(\d+),"slug":"([^"]+)","status":"([^"]+)","hashtag":"[^"]*","roundName":"([^"]*)","leagues":\[[^\]]*\],"startDate":"([^"]+)","endDate":"([^"]+)","location":"([^"]*)","roundNumber":"(\d+)"/,
  );
  if (!match) return null;

  return {
    fdEventId: Number.parseInt(match[1]!, 10),
    slug: match[3]!,
    roundNumber: Number.parseInt(match[9]!, 10),
    roundName: match[5]!,
    location: match[8]!,
    startDate: match[6]!,
    endDate: match[7]!,
    status: match[4]!,
  };
}

function parseQualifyingEntries(
  rscText: string,
  fdEventId: number,
  scoresByPosition: Map<number, number>,
): ParsedQualEntry[] {
  const entries: ParsedQualEntry[] = [];

  for (const match of rscText.matchAll(/"displayTitle":"([^"]*?) Q(\d+)"/g)) {
    const qualPosition = Number.parseInt(match[2]!, 10);
    const titleBody = match[1]!;
    const titleParts = titleBody
      .split(/\s*(?:\u2014|â\u0080\u0094|—|--|-)\s*/g)
      .map((part) => part.trim())
      .filter(Boolean);
    const titleName = titleParts.length >= 3 ? titleParts.at(-1)! : null;
    const window = rscText.slice(match.index ?? 0, (match.index ?? 0) + 8000);

    let fdDriverId: number | null = null;
    let driverSlug: string | null = null;
    const driverObject = window.match(/"driver":\{"id":(\d+),"driverSlug":"([^"]+)"/);
    if (driverObject) {
      fdDriverId = Number.parseInt(driverObject[1]!, 10);
      driverSlug = driverObject[2]!;
    } else {
      const driverNumber = window.match(/"driver":(\d+),"position":(\d+)/);
      if (driverNumber) {
        fdDriverId = Number.parseInt(driverNumber[1]!, 10);
      }
    }

    entries.push({
      fdEventId,
      fdDriverId,
      driverSlug,
      driverName: titleName ?? null,
      qualPosition,
      qualScore100: scoresByPosition.get(qualPosition) ?? null,
    });
  }

  return entries.filter(
    (entry) => entry.fdDriverId != null || entry.driverSlug != null || entry.driverName != null,
  );
}

function cleanCellText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseIntCell(value: string): number | null {
  const trimmed = cleanCellText(value);
  if (!trimmed || trimmed === '—' || trimmed === '–' || trimmed === '-' || trimmed === '*') {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function slugifyEventName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function uniqueEventSlug(name: string, usedSlugs: Set<string>): string {
  const base = slugifyEventName(name) || 'event';
  let slug = base;
  let suffix = 2;
  while (usedSlugs.has(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  usedSlugs.add(slug);
  return slug;
}

function fdDriverIdFromSlug(driverSlug: string): number {
  let hash = 0;
  for (const char of driverSlug) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) || 1;
}

function getCompetitionPointsMap(seasonYear: number): Record<number, number> {
  if (seasonYear <= 2019) {
    return { 100: 1, 80: 2, 64: 3, 48: 5, 32: 9, 16: 17 };
  }
  if (seasonYear <= 2021) {
    return { 100: 1, 91: 2, 80: 3, 67: 4, 52: 5, 35: 6 };
  }
  if (seasonYear <= 2024) {
    return { 100: 1, 84: 2, 70: 3, 56: 4, 42: 5, 28: 6, 14: 7 };
  }
  if (seasonYear === 2025) {
    return { 50: 1, 40: 2, 30: 3, 20: 4, 10: 5 };
  }
  return {};
}

function competitionPointsToPosition(points: number, seasonYear: number): number | null {
  if (points <= 0) return null;
  return getCompetitionPointsMap(seasonYear)[points] ?? null;
}

function parseArchiveTableLayout($: cheerio.CheerioAPI, seasonYear: number): ArchiveTableLayout {
  const headerRows = $('table.table-standings thead tr').toArray();
  if (headerRows.length < 2) {
    throw new Error(`Archive standings table header missing for ${seasonYear}`);
  }

  const eventGroups: Array<{ name: string; colspan: number }> = [];
  $(headerRows[0]!)
    .find('th')
    .each((index, element) => {
      if (index < 3) return;
      const name = cleanCellText($(element).text());
      if (!name || name === '\u00a0' || /^total$/i.test(name)) return;
      eventGroups.push({
        name,
        colspan: Number.parseInt($(element).attr('colspan') ?? '1', 10),
      });
    });

  const labels = $(headerRows[1]!)
    .find('th')
    .slice(3)
    .toArray()
    .map((element) => cleanCellText($(element).text()))
    .filter((label) => label && !/^total$/i.test(label));

  if (eventGroups.length === 0 || labels.length === 0) {
    throw new Error(`Failed to parse archive standings columns for ${seasonYear}`);
  }

  if (labels.length % eventGroups.length !== 0) {
    throw new Error(
      `Unexpected archive standings shape for ${seasonYear}: ${eventGroups.length} events, ${labels.length} columns`,
    );
  }

  const colsPerEvent = labels.length / eventGroups.length;
  const usedSlugs = new Set<string>();
  const events: ArchiveEventColumn[] = [];

  for (let eventIndex = 0; eventIndex < eventGroups.length; eventIndex += 1) {
    const group = eventGroups[eventIndex]!;
    const roundNumber = eventIndex + 1;
    const slug = uniqueEventSlug(group.name, usedSlugs);

    for (let subIndex = 0; subIndex < colsPerEvent; subIndex += 1) {
      const label = labels[eventIndex * colsPerEvent + subIndex]?.toUpperCase() ?? 'F';
      const kind: ArchiveColumnKind =
        label === 'Q' ? 'qual' : label === 'SB' ? 'seed' : 'finish';

      events.push({
        roundNumber,
        name: group.name,
        slug,
        kind,
      });
    }
  }

  return { events };
}

export function hasArchiveStandingsTable(html: string): boolean {
  const $ = cheerio.load(html);
  return $('table.table-standings').length > 0;
}

export function parseArchiveStandingsHtml(html: string, seasonYear: number): FdSeasonData {
  const $ = cheerio.load(html);
  const layout = parseArchiveTableLayout($, seasonYear);
  const finishColumns = layout.events.filter((event) => event.kind === 'finish');

  const eventRecords: FdEvent[] = [];
  const seenRounds = new Set<number>();
  for (const column of finishColumns) {
    if (seenRounds.has(column.roundNumber)) continue;
    seenRounds.add(column.roundNumber);
    eventRecords.push({
      fdEventId: column.roundNumber,
      slug: eventSlug(column.slug),
      roundNumber: column.roundNumber,
      name: column.name,
      trackName: column.name,
      startsAt: new Date(`${seasonYear}-${String(column.roundNumber).padStart(2, '0')}-01T12:00:00Z`).toISOString(),
      status: 'FINISHED',
    });
  }

  const pilots = new Map<string, FdPilot>();
  const rows = $('table.table-standings tbody tr').toArray();

  for (const row of rows) {
    const cells = $(row)
      .find('td')
      .toArray()
      .map((cell) => cleanCellText($(cell).text()));

    if (cells.length < 4) continue;

    const driverLink = $(row).find('a[href*="/drivers/"]').first();
    const driverHref = driverLink.attr('href') ?? '';
    const driverSlug = driverHref.match(/\/drivers\/([^/?#]+)/)?.[1];
    const driverName = cleanCellText(driverLink.text()) || cells[2] || '';
    if (!driverSlug || !driverName) continue;

    const { firstName, lastName } = parseDriverName(driverName);
    const carNumber = parseIntCell(cells[1] ?? '');
    const pilotKey = driverSlug;
    const pilot =
      pilots.get(pilotKey) ??
      ({
        slug: pilotSlug(driverSlug),
        fdDriverId: fdDriverIdFromSlug(driverSlug),
        firstName,
        lastName,
        nameAlias: driverName,
        country: null,
        number: carNumber,
        photoSourceUrl: null,
        team: null,
        stages: [],
      } satisfies FdPilot);

    pilot.number = pilot.number ?? carNumber;

    let cellIndex = 3;
    const stageByRound = new Map<number, FdStageResult>();

    for (const column of layout.events) {
      const rawValue = cells[cellIndex] ?? '';
      cellIndex += 1;

      if (column.kind === 'seed') {
        const seedPoints = parseIntCell(rawValue);
        if (seedPoints == null) continue;
        const event = eventRecords.find((item) => item.roundNumber === column.roundNumber);
        if (!event) continue;
        const stage =
          stageByRound.get(column.roundNumber) ??
          ({
            eventSlug: event.slug,
            roundNumber: event.roundNumber,
            qualifyingPosition: null,
            qualifyingPoints: null,
            qualScore100: null,
            tandemPosition: null,
            points: 0,
          } satisfies FdStageResult);
        stage.qualifyingPoints = seedPoints;
        stageByRound.set(column.roundNumber, stage);
        continue;
      }

      const numericValue = parseIntCell(rawValue);
      const event = eventRecords.find((item) => item.roundNumber === column.roundNumber);
      if (!event) continue;

      const stage =
        stageByRound.get(column.roundNumber) ??
        ({
          eventSlug: event.slug,
          roundNumber: event.roundNumber,
          qualifyingPosition: null,
          qualifyingPoints: null,
          qualScore100: null,
          tandemPosition: null,
          points: 0,
        } satisfies FdStageResult);

      if (column.kind === 'qual' && numericValue != null) {
        stage.qualifyingPosition = numericValue;
      }

      if (column.kind === 'finish' && numericValue != null) {
        stage.points = numericValue;
        if (seasonYear !== 2025) {
          stage.tandemPosition = competitionPointsToPosition(numericValue, seasonYear);
        }
      }

      stageByRound.set(column.roundNumber, stage);
    }

    for (const stage of stageByRound.values()) {
      if (
        stage.points <= 0 &&
        (stage.qualifyingPoints ?? 0) <= 0 &&
        stage.qualifyingPosition == null &&
        stage.tandemPosition == null
      ) {
        continue;
      }
      if (seasonYear < 2025 && stage.tandemPosition == null && stage.qualifyingPosition != null) {
        stage.tandemPosition = stage.qualifyingPosition;
      }
      pilot.stages.push(stage);
    }

    pilots.set(pilotKey, pilot);
  }

  return {
    sourceUrl: `${BASE}/standings/${seasonYear}/pro`,
    seasonYear,
    events: eventRecords,
    pilots: [...pilots.values()].filter((pilot) => pilot.stages.length > 0),
  };
}

async function fetchStandings(seasonYear: number): Promise<FdStandingsDoc | null> {
  const query = new URLSearchParams({
    'where[year][equals]': String(seasonYear),
    'where[league.code][equals]': 'pro',
    depth: '2',
    limit: '1',
  });
  const payload = await fetchJson<{ docs: FdStandingsDoc[] }>(
    `${BASE}/api/standings?${query.toString()}`,
  );
  return payload.docs[0] ?? null;
}

export interface FormulaDriftSeasonAvailability {
  year: number;
  api: boolean;
  archiveTable: boolean;
  pageEvents: number;
  importable: boolean;
}

export async function probeFormulaDriftArchiveSeasons(
  fromYear = 2015,
  toYear = new Date().getFullYear(),
): Promise<FormulaDriftSeasonAvailability[]> {
  const payload = await fetchJson<{ docs: Array<{ year: number; league: number | { code: string } }> }>(
    `${BASE}/api/standings?limit=50&depth=1`,
  );

  const apiYears = new Set<number>();
  for (const doc of payload.docs) {
    const leagueCode = typeof doc.league === 'number' ? null : doc.league.code;
    if (leagueCode === 'pro') apiYears.add(doc.year);
  }

  const availability: FormulaDriftSeasonAvailability[] = [];
  for (let year = toYear; year >= fromYear; year -= 1) {
    let pageEvents = 0;
    let archiveTable = false;
    try {
      const html = await fetchHtml(`${BASE}/standings/${year}/pro`);
      archiveTable = hasArchiveStandingsTable(html);
      if (apiYears.has(year)) {
        const pageRsc = await fetchRscText(`${BASE}/standings/${year}/pro`);
        pageEvents = parseEventSlugsFromStandingsPage(pageRsc, year).length;
      } else if (archiveTable) {
        pageEvents = parseArchiveStandingsHtml(html, year).events.length;
      }
    } catch {
      pageEvents = 0;
      archiveTable = false;
    }

    availability.push({
      year,
      api: apiYears.has(year),
      archiveTable,
      pageEvents,
      importable: (apiYears.has(year) && pageEvents > 0) || archiveTable,
    });
  }

  return availability;
}

export async function listFormulaDriftSeasons(): Promise<number[]> {
  const availability = await probeFormulaDriftArchiveSeasons();
  const years = availability.filter((season) => season.importable).map((season) => season.year);
  for (const year of [2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017]) {
    if (!years.includes(year)) years.push(year);
  }
  return years.sort((a, b) => b - a);
}

async function fetchFormulaDriftSeasonFromApi(seasonYear: number, standings: FdStandingsDoc): Promise<FdSeasonData> {
  const [standingsRsc, standingsPageRsc] = await Promise.all([
    fetchLargestRscText(`${BASE}/standings/${seasonYear}/pro`),
    fetchRscText(`${BASE}/standings/${seasonYear}/pro`),
  ]);

  const eventSlugs = parseEventSlugsFromStandingsPage(standingsPageRsc, seasonYear);
  if (eventSlugs.length === 0) {
    throw new Error(`No Formula Drift PRO events found for ${seasonYear}`);
  }

  const drivers = new Map<number, ParsedDriver>();
  const standingsPhotos = parseDriverPhotosBySlug(standingsPageRsc);
  for (const driver of [
    ...parseDriversFromRsc(standingsRsc, standingsPhotos),
    ...parseDriversFromRsc(standingsPageRsc, standingsPhotos),
  ]) {
    drivers.set(driver.fdDriverId, driver);
  }

  const events: FdEvent[] = [];
  const qualByEventDriver = new Map<string, ParsedQualEntry>();

  for (const slug of eventSlugs) {
    const rscText = await fetchLargestRscText(`${BASE}/results/${seasonYear}/${slug}/pro`);
    const eventPhotos = parseDriverPhotosBySlug(rscText);
    for (const driver of parseDriversFromRsc(rscText, eventPhotos)) {
      const existing = drivers.get(driver.fdDriverId);
      drivers.set(driver.fdDriverId, {
        ...driver,
        country: driver.country ?? existing?.country ?? null,
        number: driver.number ?? existing?.number ?? null,
        photoSourceUrl: driver.photoSourceUrl ?? existing?.photoSourceUrl ?? null,
      });
    }

    const meta = parseEventMetaFromResultsRsc(rscText);
    if (!meta) {
      throw new Error(`Failed to parse Formula Drift event metadata for ${seasonYear}/${slug}`);
    }

    events.push({
      fdEventId: meta.fdEventId,
      slug: eventSlug(meta.slug),
      roundNumber: meta.roundNumber,
      name: meta.roundName,
      trackName: meta.location,
      startsAt: meta.startDate,
      status: mapEventStatus(meta.status, meta.endDate),
    });

    const scoresByPosition = parseQualScoresByPosition(rscText);

    for (const qual of parseQualifyingEntries(rscText, meta.fdEventId, scoresByPosition)) {
      if (qual.fdDriverId != null) {
        qualByEventDriver.set(`${qual.fdEventId}:${qual.fdDriverId}`, qual);
      }
      if (qual.driverSlug) {
        qualByEventDriver.set(`${qual.fdEventId}:${qual.driverSlug}`, qual);
      }
      if (qual.driverName) {
        qualByEventDriver.set(`${qual.fdEventId}:${qual.driverName.toUpperCase()}`, qual);
      }
    }
  }

  await enrichDriverPhotos(drivers);

  events.sort((a, b) => a.roundNumber - b.roundNumber);
  const eventByFdId = new Map(events.map((event) => [event.fdEventId, event]));

  const pilots: FdPilot[] = standings.entries.map((entry) => {
    const driver = drivers.get(entry.driver);
    const rawName = driver?.name ?? `Driver ${entry.driver}`;
    const { firstName, lastName } = parseDriverName(rawName);

    const stages: FdStageResult[] = entry.rounds
      .filter((round) => round.points > 0 || round.rank > 0)
      .map((round) => {
        const event = eventByFdId.get(round.event);
        if (!event) {
          throw new Error(`Unknown Formula Drift event id ${round.event} in ${seasonYear} standings`);
        }

        const qualKeyById = `${round.event}:${entry.driver}`;
        const qualKeyBySlug = driver ? `${round.event}:${driver.driverSlug}` : null;
        const qualKeyByName = driver ? `${round.event}:${driver.name.toUpperCase()}` : null;
        const qual = qualByEventDriver.get(qualKeyById) ??
          (qualKeyBySlug ? qualByEventDriver.get(qualKeyBySlug) : undefined) ??
          (qualKeyByName ? qualByEventDriver.get(qualKeyByName) : undefined);

        return {
          eventSlug: event.slug,
          roundNumber: event.roundNumber,
          qualifyingPosition: qual?.qualPosition ?? null,
          qualifyingPoints: round.qualifyingPoints || null,
          qualScore100: qual?.qualScore100 ?? null,
          tandemPosition: round.rank || null,
          points: Math.round(round.points),
        };
      });

    return {
      slug: pilotSlug(driver?.driverSlug ?? String(entry.driver)),
      fdDriverId: entry.driver,
      firstName,
      lastName,
      nameAlias: rawName,
      country: driver?.country ?? null,
      number: driver?.number ?? null,
      photoSourceUrl: driver?.photoSourceUrl ?? null,
      team: null,
      stages,
    };
  });

  return {
    sourceUrl: `${BASE}/standings/${seasonYear}/pro`,
    seasonYear,
    events,
    pilots: pilots.filter((pilot) => pilot.stages.length > 0),
  };
}

export async function fetchFormulaDriftSeason(seasonYear: number): Promise<FdSeasonData> {
  let standings: FdStandingsDoc | null = null;
  try {
    standings = await fetchStandings(seasonYear);
  } catch {
    standings = null;
  }
  if (standings) {
    return fetchFormulaDriftSeasonFromApi(seasonYear, standings);
  }

  try {
    const html = await fetchHtml(`${BASE}/standings/${seasonYear}/pro`);
    if (hasArchiveStandingsTable(html)) {
      const season = parseArchiveStandingsHtml(html, seasonYear);
      if (seasonYear === 2025) {
        const { enrichFormulaDrift2025FromNews } = await import('./formula-drift-2025-news.js');
        const { enrichFormulaDrift2025QualSeeds } = await import('./formula-drift-2025-brackets.js');
        return enrichFormulaDrift2025QualSeeds(await enrichFormulaDrift2025FromNews(season));
      }
      return season;
    }
  } catch {
    // Official live pages 404 for pre-2018 seasons.
  }

  if (seasonYear >= 2008 && seasonYear <= 2017) {
    const { fetchFormulaDriftSeasonFromWikipedia } = await import('./formula-drift-wikipedia.js');
    return fetchFormulaDriftSeasonFromWikipedia(seasonYear);
  }

  if (seasonYear === 2007) {
    const { fetchFormulaDriftSeasonFromWayback } = await import('./formula-drift-wayback.js');
    return fetchFormulaDriftSeasonFromWayback(seasonYear);
  }

  throw new Error(`Formula Drift PRO standings for ${seasonYear} not found`);
}
