import {
  seriesEventPath,
  seriesStandingsPath,
} from '@drift-index/shared';
import type { PrismaClient } from '@prisma/client';

export const DEFAULT_SITE_ORIGIN = 'https://driftindex.pro';

const LOCALES = ['en', 'ru'] as const;
type Locale = (typeof LOCALES)[number];

export interface SitemapPath {
  path: string;
  lastmod?: Date;
}

export function siteOriginFromEnv(): string {
  const raw =
    process.env.SITEMAP_ORIGIN?.trim() ||
    process.env.PUBLIC_SITE_ORIGIN?.trim() ||
    DEFAULT_SITE_ORIGIN;
  return raw.replace(/\/+$/, '');
}

function localeAbsolute(origin: string, locale: Locale, barePath: string): string {
  if (barePath === '/') return `${origin}/${locale}`;
  return `${origin}/${locale}${barePath}`;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatLastmod(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function renderSitemapXml(origin: string, paths: readonly SitemapPath[]): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];

  for (const entry of paths) {
    const alternateLinks = [
      ...LOCALES.map(
        (alt) =>
          `    <xhtml:link rel="alternate" hreflang="${alt}" href="${escapeXml(localeAbsolute(origin, alt, entry.path))}"></xhtml:link>`,
      ),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(localeAbsolute(origin, 'en', entry.path))}"></xhtml:link>`,
    ];

    // Google hreflang sitemaps: one <url> per locale, identical xhtml:link set in each.
    for (const locale of LOCALES) {
      const loc = localeAbsolute(origin, locale, entry.path);
      lines.push('  <url>');
      lines.push(`    <loc>${escapeXml(loc)}</loc>`);
      lines.push(...alternateLinks);
      if (entry.lastmod) {
        lines.push(`    <lastmod>${formatLastmod(entry.lastmod)}</lastmod>`);
      }
      lines.push('  </url>');
    }
  }

  lines.push('</urlset>');
  return `${lines.join('\n')}\n`;
}

export async function collectSitemapPaths(client: PrismaClient): Promise<SitemapPath[]> {
  const paths: SitemapPath[] = [];

  for (const path of ['/', '/pilots', '/series', '/tracks', '/votes'] as const) {
    paths.push({ path });
  }

  const [pilots, series, seasons, events, tracks] = await Promise.all([
    client.pilot.findMany({
      select: { slug: true, updatedAt: true },
      orderBy: { slug: 'asc' },
    }),
    client.series.findMany({
      select: { slug: true, updatedAt: true },
      orderBy: { slug: 'asc' },
    }),
    client.season.findMany({
      select: {
        year: true,
        updatedAt: true,
        series: { select: { slug: true } },
      },
      orderBy: [{ series: { slug: 'asc' } }, { year: 'desc' }],
    }),
    client.event.findMany({
      where: { status: { not: 'CANCELLED' } },
      select: {
        slug: true,
        updatedAt: true,
        season: { select: { year: true, series: { select: { slug: true } } } },
      },
      orderBy: [
        { season: { series: { slug: 'asc' } } },
        { season: { year: 'desc' } },
        { roundNumber: 'asc' },
      ],
    }),
    client.track.findMany({
      select: { slug: true, updatedAt: true },
      orderBy: { slug: 'asc' },
    }),
  ]);

  for (const pilot of pilots) {
    paths.push({ path: `/pilots/${pilot.slug}`, lastmod: pilot.updatedAt });
  }
  for (const row of series) {
    paths.push({ path: `/series/${row.slug}`, lastmod: row.updatedAt });
  }
  for (const season of seasons) {
    paths.push({
      path: seriesStandingsPath(season.series.slug, season.year),
      lastmod: season.updatedAt,
    });
  }
  for (const event of events) {
    paths.push({
      path: seriesEventPath(event.season.series.slug, event.season.year, event.slug),
      lastmod: event.updatedAt,
    });
  }
  for (const track of tracks) {
    paths.push({ path: `/tracks/${track.slug}`, lastmod: track.updatedAt });
  }

  return paths;
}

export async function buildSitemapXml(client: PrismaClient): Promise<string> {
  const paths = await collectSitemapPaths(client);
  return renderSitemapXml(siteOriginFromEnv(), paths);
}
