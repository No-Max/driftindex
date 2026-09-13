import 'dotenv/config';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';
import { almanacRdsSeasonSlug } from '../src/importers/rds-almanac.js';
import {
  fetchAlmanacPilotCountry,
  parseAlmanacPilotCountryHtml,
} from '../src/importers/almanac-pilot.js';
import { englishNamesFromNameRu, transliterate } from '../src/lib/transliterate.js';
import { findMatchingPilot } from '../src/lib/pilotMatch.js';
import { PILOT_COUNTRY_OVERRIDES } from '../src/data/pilot-country-overrides.js';

const prisma = new PrismaClient();
const BASE = 'https://driftalmanac.ru';

const ALMANAC_RDS_YEARS = [
  2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
  2026,
];

async function fetchHtml(url: string): Promise<string | null> {
  const response = await fetch(url, {
    headers: { accept: 'text/html', 'user-agent': 'DriftIndexImporter/1.0' },
  });
  if (!response.ok) return null;
  return response.text();
}

function parseAlmanacPilotNameHtml(html: string): string | null {
  const $ = cheerio.load(html);
  return $('h1.racing-title').first().text().trim() || null;
}

function slugPart(value: string): string {
  return transliterate(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function almanacSlugCandidates(firstName: string, lastName: string, aliases: string[]): string[] {
  const candidates = new Set<string>();
  candidates.add(`${slugPart(lastName)}_${slugPart(firstName)}`);

  for (const alias of aliases) {
    const parts = alias.trim().split(/\s+/);
    if (parts.length >= 2) {
      const [a, b] = parts;
      candidates.add(`${slugPart(a!)}_${slugPart(b!)}`);
      candidates.add(`${slugPart(b!)}_${slugPart(a!)}`);
    }
  }

  return [...candidates].filter(Boolean);
}

async function collectAlmanacSlugsFromSeasons(): Promise<Set<string>> {
  const slugs = new Set<string>();

  for (const year of ALMANAC_RDS_YEARS) {
    const seasonSlug = almanacRdsSeasonSlug(year);
    const html = await fetchHtml(`${BASE}/championship/rds/${seasonSlug}`);
    if (!html) continue;

    const $ = cheerio.load(html);
    $('a[href*="/pilot/"]').each((_, element) => {
      const slug = $(element).attr('href')?.match(/\/pilot\/([^/?#]+)/)?.[1];
      if (slug) slugs.add(slug);
    });
  }

  return slugs;
}

async function resolvePilotSlug(
  almanacSlug: string,
  nameAlias: string | null,
): Promise<string | null> {
  const daSlug = `da-${almanacSlug}`;
  const daPilot = await prisma.pilot.findUnique({ where: { slug: daSlug }, select: { slug: true } });
  if (daPilot) return daPilot.slug;

  if (!nameAlias) return null;

  const english = englishNamesFromNameRu(nameAlias);
  const match = await findMatchingPilot(
    prisma,
    {
      slug: daSlug,
      nameAlias,
      firstName: english.firstName,
      lastName: english.lastName,
      number: null,
    },
    { excludeSlugPrefix: 'da-' },
  );
  return match?.slug ?? null;
}

async function applyCountry(slug: string, country: string | null): Promise<boolean> {
  const pilot = await prisma.pilot.findUnique({ where: { slug }, select: { id: true, country: true } });
  if (!pilot) return false;
  if (pilot.country === country) return false;

  await prisma.pilot.update({ where: { id: pilot.id }, data: { country } });
  return true;
}

interface AlmanacProfile {
  country: string | null;
  nameAlias: string | null;
}

async function loadAlmanacProfile(
  almanacSlug: string,
  cache: Map<string, AlmanacProfile | null>,
): Promise<AlmanacProfile | null> {
  if (cache.has(almanacSlug)) return cache.get(almanacSlug) ?? null;

  const html = await fetchHtml(`${BASE}/pilot/${almanacSlug}`);
  if (!html) {
    cache.set(almanacSlug, null);
    return null;
  }

  const profile: AlmanacProfile = {
    country: parseAlmanacPilotCountryHtml(html),
    nameAlias: parseAlmanacPilotNameHtml(html),
  };
  cache.set(almanacSlug, profile);
  return profile;
}

async function importFromAlmanacSlugs(slugs: Iterable<string>, cache: Map<string, AlmanacProfile | null>) {
  let updated = 0;
  let matched = 0;

  for (const almanacSlug of slugs) {
    const profile = await loadAlmanacProfile(almanacSlug, cache);
    if (!profile) continue;

    const pilotSlug = await resolvePilotSlug(almanacSlug, profile.nameAlias);
    if (!pilotSlug) continue;
    matched++;

    if (profile.country == null) continue;
    if (await applyCountry(pilotSlug, profile.country)) updated++;
  }

  return { updated, matched };
}

async function importBySlugGuessing(
  missing: Array<{
    slug: string;
    firstName: string;
    lastName: string;
    seriesAliases: Array<{ name: string }>;
  }>,
  cache: Map<string, AlmanacProfile | null>,
) {
  let updated = 0;
  const countryCache = new Map<string, string | null>();

  for (const pilot of missing) {
    const aliases = pilot.seriesAliases.map((alias) => alias.name);
    for (const candidate of almanacSlugCandidates(pilot.firstName, pilot.lastName, aliases)) {
      const cached = cache.get(candidate);
      if (cached === null) continue;

      let country: string | null;
      if (cached) {
        country = cached.country;
      } else {
        country = await fetchAlmanacPilotCountry(candidate, countryCache);
        if (country != null) {
          cache.set(candidate, { country, nameAlias: aliases[0] ?? null });
        } else if (countryCache.has(candidate)) {
          cache.set(candidate, null);
        }
      }

      if (country == null) continue;

      if (await applyCountry(pilot.slug, country)) {
        updated++;
        break;
      }
    }
  }

  return updated;
}

async function importFromOverrides() {
  let updated = 0;

  for (const [slug, country] of Object.entries(PILOT_COUNTRY_OVERRIDES)) {
    if (await applyCountry(slug, country)) updated++;
  }

  return updated;
}

async function importFromRoyalDs() {
  const { fetchRoyalDsSeason } = await import('../src/importers/royal-ds.js');
  const data = await fetchRoyalDsSeason();
  let updated = 0;

  for (const pilot of data.pilots) {
    if (pilot.country == null) continue;
    if (await applyCountry(pilot.slug, pilot.country)) updated++;
  }

  return updated;
}

async function main() {
  const cache = new Map<string, AlmanacProfile | null>();

  console.log('Collecting Almanac RDS pilot slugs from all seasons…');
  const seasonSlugs = await collectAlmanacSlugsFromSeasons();
  console.log(`Season pages: ${seasonSlugs.size} unique pilot slug(s)`);

  const seasonResult = await importFromAlmanacSlugs(seasonSlugs, cache);
  console.log(`From seasons: matched ${seasonResult.matched}, updated ${seasonResult.updated}`);

  const royalUpdated = await importFromRoyalDs();
  console.log(`Royal DS updated: ${royalUpdated}`);

  const overrideUpdated = await importFromOverrides();
  console.log(`Manual overrides updated: ${overrideUpdated}`);

  const stillMissing = await prisma.pilot.findMany({
    where: { country: null },
    select: { slug: true, firstName: true, lastName: true, seriesAliases: { select: { name: true } } },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  console.log(`Still missing country: ${stillMissing.length}`);
  if (stillMissing.length > 0) {
    const guessed = await importBySlugGuessing(stillMissing, cache);
    console.log(`From slug guessing: updated ${guessed}`);
  }

  const remaining = await prisma.pilot.findMany({
    where: { country: null },
    select: {
      slug: true,
      firstName: true,
      lastName: true,
      number: true,
      seriesAliases: { select: { name: true } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  const withCountry = await prisma.pilot.count({ where: { country: { not: null } } });
  const total = await prisma.pilot.count();
  console.log(`\nFinal: ${withCountry}/${total} with country, ${remaining.length} still missing`);

  if (remaining.length > 0) {
    console.log('\n--- NEED USER INPUT ---');
    for (const pilot of remaining) {
      const label = pilot.seriesAliases[0]?.name ?? `${pilot.firstName} ${pilot.lastName}`;
      console.log(`${pilot.slug}\t#${pilot.number ?? '?'}\t${label}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
