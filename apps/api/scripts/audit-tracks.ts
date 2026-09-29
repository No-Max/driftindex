import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { resolveTrackFields } from '../src/lib/trackCanonical.js';

const prisma = new PrismaClient();

function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(speedway|motorsports|motorpark|raceway|road course|drift|circuit|ring|stadium|arena|autodrom|autodrome)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function main() {
  const tracks = await prisma.track.findMany({
    include: {
      _count: { select: { events: true } },
      events: {
        select: { season: { select: { series: { select: { slug: true } } } } },
      },
    },
    orderBy: { name: 'asc' },
  });

  console.log(`Total tracks: ${tracks.length}\n`);

  const seriesFor = (t: (typeof tracks)[0]) =>
    [...new Set(t.events.map((e) => e.season.series.slug))].join(', ') || '—';

  console.log('=== Multiple rows → same canonical slug ===');
  const byCanon = new Map<string, typeof tracks>();
  for (const t of tracks) {
    const c = resolveTrackFields(t.name).preferredSlug;
    if (!c) continue;
    const list = byCanon.get(c) ?? [];
    list.push(t);
    byCanon.set(c, list);
  }
  let canonGroups = 0;
  for (const [slug, list] of [...byCanon.entries()].sort()) {
    if (list.length <= 1) continue;
    canonGroups += 1;
    console.log(`\n${slug}:`);
    for (const t of list) {
      console.log(`  ${t.name} [${t.slug}] events=${t._count.events} series=${seriesFor(t)}`);
    }
  }
  if (!canonGroups) console.log('  (none)');

  console.log('\n=== Exact same name, different slug ===');
  const byName = new Map<string, typeof tracks>();
  for (const t of tracks) {
    const key = t.name.trim().toLowerCase();
    const list = byName.get(key) ?? [];
    list.push(t);
    byName.set(key, list);
  }
  let nameGroups = 0;
  for (const [name, list] of [...byName.entries()].sort()) {
    if (list.length <= 1) continue;
    nameGroups += 1;
    console.log(`\n${name}:`);
    for (const t of list) console.log(`  [${t.slug}] events=${t._count.events} series=${seriesFor(t)}`);
  }
  if (!nameGroups) console.log('  (none)');

  console.log('\n=== Same normalized name, different slug ===');
  const byNorm = new Map<string, typeof tracks>();
  for (const t of tracks) {
    const n = normName(t.name);
    if (!n) continue;
    const list = byNorm.get(n) ?? [];
    list.push(t);
    byNorm.set(n, list);
  }
  let normGroups = 0;
  for (const [n, list] of [...byNorm.entries()].sort()) {
    if (list.length <= 1 || new Set(list.map((t) => t.slug)).size <= 1) continue;
    normGroups += 1;
    console.log(`\n"${n}":`);
    for (const t of list) {
      console.log(`  ${t.name} [${t.slug}] events=${t._count.events}`);
    }
  }
  if (!normGroups) console.log('  (none)');

  console.log('\n=== Slug is base slug + numeric/hash suffix (pair with base) ===');
  const slugs = new Set(tracks.map((t) => t.slug));
  let suffixPairs = 0;
  for (const t of tracks) {
    const m = t.slug.match(/^(.+)-(\d+|[a-f0-9]{6,})$/);
    if (!m) continue;
    const base = m[1]!;
    if (!slugs.has(base) || t.slug === base) continue;
    suffixPairs += 1;
    const baseTrack = tracks.find((x) => x.slug === base);
    console.log(
      `  ${t.slug} (${t._count.events}) ↔ ${base} (${baseTrack?._count.events ?? 0}) — ${t.name}`,
    );
  }
  if (!suffixPairs) console.log('  (none)');

  console.log('\n=== Same city + overlapping name tokens ===');
  const byCity = new Map<string, typeof tracks>();
  for (const t of tracks) {
    if (!t.city?.trim()) continue;
    const key = t.city.trim().toLowerCase();
    const list = byCity.get(key) ?? [];
    list.push(t);
    byCity.set(key, list);
  }
  let cityHints = 0;
  for (const [city, list] of [...byCity.entries()].sort()) {
    if (list.length <= 1) continue;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i]!;
        const b = list[j]!;
        if (a.slug === b.slug) continue;
        const na = normName(a.name);
        const nb = normName(b.name);
        if (na === nb || na.includes(nb) || nb.includes(na)) {
          cityHints += 1;
          console.log(
            `  ${city}: ${a.name} [${a.slug}] (${a._count.events}) vs ${b.name} [${b.slug}] (${b._count.events})`,
          );
        }
      }
    }
  }
  if (!cityHints) console.log('  (none)');

  const unmapped = tracks.filter((t) => !resolveTrackFields(t.name).preferredSlug && t._count.events > 0);
  console.log(`\n=== Unmapped tracks with events: ${unmapped.length} ===`);
  for (const t of unmapped) {
    console.log(`  ${t.name} [${t.slug}] events=${t._count.events} city=${t.city ?? '—'}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
