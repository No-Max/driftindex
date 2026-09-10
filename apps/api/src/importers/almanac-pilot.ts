import * as cheerio from 'cheerio';

const BASE = 'https://driftalmanac.ru';

async function fetchHtml(url: string): Promise<string | null> {
  const response = await fetch(url, {
    headers: { accept: 'text/html', 'user-agent': 'DriftIndexImporter/1.0' },
  });
  if (!response.ok) return null;
  return response.text();
}

/** Parse ISO country code from Drift Almanac /pilot/{slug} profile page. */
export function parseAlmanacPilotCountryHtml(html: string): string | null {
  const $ = cheerio.load(html);
  let country: string | null = null;

  $('div').each((_, element) => {
    const label = $(element).text().trim();
    if (label !== 'Страна') return;

    const value = $(element).prev('.racing-number').text().trim();
    if (!value || value === '—' || value === '–' || value === '-') {
      country = null;
      return false;
    }

    country = value.toUpperCase();
    return false;
  });

  return country;
}

export function almanacSlugFromPilotSlug(pilotSlug: string): string | null {
  if (!pilotSlug.startsWith('da-')) return null;
  return pilotSlug.slice(3);
}

export async function fetchAlmanacPilotCountry(
  almanacSlug: string,
  cache = new Map<string, string | null>(),
): Promise<string | null> {
  if (cache.has(almanacSlug)) {
    return cache.get(almanacSlug) ?? null;
  }

  const html = await fetchHtml(`${BASE}/pilot/${almanacSlug}`);
  const country = html ? parseAlmanacPilotCountryHtml(html) : null;
  cache.set(almanacSlug, country);
  return country;
}

export async function enrichPilotsWithAlmanacCountries<
  T extends { slug: string; country: string | null },
>(pilots: T[], cache = new Map<string, string | null>()): Promise<void> {
  const slugs = new Set<string>();
  for (const pilot of pilots) {
    const almanacSlug = almanacSlugFromPilotSlug(pilot.slug);
    if (almanacSlug) slugs.add(almanacSlug);
  }

  for (const almanacSlug of slugs) {
    await fetchAlmanacPilotCountry(almanacSlug, cache);
  }

  for (const pilot of pilots) {
    const almanacSlug = almanacSlugFromPilotSlug(pilot.slug);
    if (!almanacSlug) continue;
    pilot.country = cache.get(almanacSlug) ?? null;
  }
}
