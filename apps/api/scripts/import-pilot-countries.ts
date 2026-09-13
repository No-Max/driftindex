import 'dotenv/config';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';
import { almanacRdsSeasonSlug } from '../src/importers/rds-almanac.js';

const ALMANAC_RDS_YEARS = [
  2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
  2026,
];
import { parseAlmanacPilotCountryHtml } from '../src/importers/almanac-pilot.js';
import { englishNamesFromNameRu } from '../src/lib/transliterate.js';
import { findMatchingPilot } from '../src/lib/pilotMatch.js';

const prisma = new PrismaClient();
const BASE = 'https://driftalmanac.ru';

async function fetchHtml(url: string): Promise<string | null> {
  const response = await fetch(url, {
    headers: { accept: 'text/html', 'user-agent': 'DriftIndexImporter/1.0' },
  });
  if (!response.ok) return null;
  return response.text();
}

function parseAlmanacPilotNameHtml(html: string): string | null {
  const $ = cheerio.load(html);
  const name = $('h1.racing-title').first().text().trim();
  return name || null;
}

async function collectAlmanacPilotSlugs(): Promise<Set<string>> {
  const slugs = new Set<string>();
  const daPilots = await prisma.pilot.findMany({
    where: { slug: { startsWith: 'da-' } },
    select: { slug: true },
  });
  for (const pilot of daPilots) {
    slugs.add(pilot.slug.slice(3));
  }

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

async function resolvePilotForAlmanacSlug(
  almanacSlug: string,
  nameAlias: string | null,
  number: number | null,
): Promise<string> {
  const daSlug = `da-${almanacSlug}`;
  const existing = await prisma.pilot.findUnique({ where: { slug: daSlug }, select: { slug: true } });
  if (existing) return existing.slug;

  if (nameAlias) {
    const english = englishNamesFromNameRu(nameAlias);
    const match = await findMatchingPilot(
      prisma,
      {
        slug: daSlug,
        nameAlias,
        firstName: english.firstName,
        lastName: english.lastName,
        number,
      },
      { excludeSlugPrefix: 'da-' },
    );
    if (match) return match.slug;
  }

  return daSlug;
}

async function importFromAlmanac(): Promise<void> {
  const slugs = await collectAlmanacPilotSlugs();
  console.log(`Found ${slugs.size} Almanac pilot slug(s)`);

  let updated = 0;
  let skipped = 0;

  for (const almanacSlug of slugs) {
    const profileUrl = `${BASE}/pilot/${almanacSlug}`;
    const html = await fetchHtml(profileUrl);
    if (!html) {
      skipped++;
      continue;
    }

    const country = parseAlmanacPilotCountryHtml(html);

    const nameAlias = parseAlmanacPilotNameHtml(html);
    const pilotSlug = await resolvePilotForAlmanacSlug(almanacSlug, nameAlias, null);
    const pilot = await prisma.pilot.findUnique({ where: { slug: pilotSlug }, select: { id: true } });
    if (!pilot) {
      skipped++;
      continue;
    }

    await prisma.pilot.update({
      where: { id: pilot.id },
      data: { country },
    });
    updated++;
  }

  console.log(`Almanac countries updated: ${updated}, skipped: ${skipped}`);
}

async function importFromRoyalDs(): Promise<void> {
  const { fetchRoyalDsSeason } = await import('../src/importers/royal-ds.js');
  const data = await fetchRoyalDsSeason();
  let updated = 0;

  for (const pilot of data.pilots) {
    const record = await prisma.pilot.findUnique({
      where: { slug: pilot.slug },
      select: { id: true },
    });
    if (!record) continue;

    await prisma.pilot.update({
      where: { id: record.id },
      data: { country: pilot.country },
    });
    updated++;
  }

  console.log(`Royal DS countries updated: ${updated}`);
}

async function main() {
  const source = process.argv.find((arg) => arg.startsWith('--source='))?.split('=')[1] ?? 'all';

  if (source === 'almanac' || source === 'all') {
    await importFromAlmanac();
  }

  if (source === 'royal-ds' || source === 'all') {
    await importFromRoyalDs();
  }

  if (!['almanac', 'royal-ds', 'all'].includes(source)) {
    throw new Error(`Unknown --source=${source}. Use almanac, royal-ds, or all.`);
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
