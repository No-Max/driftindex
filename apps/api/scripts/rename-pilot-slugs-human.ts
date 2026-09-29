import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { D1GP_KNOWN_DRIVERS } from '../src/data/d1gp-drivers.js';
import { D1GP_DRIVER_BY_RANKING_NAME } from '../src/data/d1gp-driver-overrides.js';
import { lookupJaLatin } from '../src/data/pilot-ja-latin.js';
import { getMediaRoot } from '../src/lib/media/config.js';
import { syncPilotPrimaryPhoto } from '../src/lib/media/pilotPhoto.js';
import { mergePilotInto } from '../src/lib/pilotMatch.js';
import { canonicalEnglishNames } from '../src/lib/pilotNames.js';
import { SERIES_PILOT_SLUG_PREFIXES } from '../src/lib/pilotSlug.js';
import {
  containsJapaneseScript,
  englishNamesFromNameRu,
  isLatinName,
  transliterate,
} from '../src/lib/transliterate.js';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

/** Hepburn-ish kana → romaji (hiragana + katakana). */
const KANA_ROMAJI: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', を: 'o', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
  っ: '', ー: '',
};

for (const [hira, roma] of Object.entries({ ...KANA_ROMAJI })) {
  if (hira.length !== 1) continue;
  const kata = String.fromCharCode(hira.charCodeAt(0) + 0x60);
  if (!(kata in KANA_ROMAJI)) KANA_ROMAJI[kata] = roma;
}

function kanaToRomaji(value: string): string {
  let input = value.normalize('NFC');
  let out = '';
  for (let i = 0; i < input.length; ) {
    const digraph = input.slice(i, i + 2);
    if (KANA_ROMAJI[digraph]) {
      out += KANA_ROMAJI[digraph];
      i += 2;
      continue;
    }
    const ch = input[i]!;
    if (ch === 'っ' || ch === 'ッ') {
      const next = input[i + 1];
      const nextRoma = next ? kanaToRomaji(next) : '';
      out += nextRoma.charAt(0) || '';
      i += 1;
      continue;
    }
    if (KANA_ROMAJI[ch]) {
      out += KANA_ROMAJI[ch];
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function nameSlug(firstName: string, lastName: string): string {
  const parts = [firstName, lastName]
    .map((part) =>
      transliterate(kanaToRomaji(part))
        .toLowerCase()
        .replace(/['ʼ`´]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .filter(Boolean);
  return parts.join('-');
}

function isHumanReadableSlug(slug: string): boolean {
  if (/^\d+$/.test(slug)) return false;
  if (slug.includes('_')) return false;
  if (SERIES_PILOT_SLUG_PREFIXES.some((prefix) => slug.startsWith(prefix))) return false;
  return /^[a-z]+(-[a-z0-9]+)+$/i.test(slug);
}

function compactJa(value: string): string {
  return value.replace(/\s+/g, '');
}

function rewritePilotMediaPath(url: string | null | undefined, from: string, to: string): string | null {
  if (!url) return url ?? null;
  return url.split(`/media/pilots/${from}/`).join(`/media/pilots/${to}/`);
}

async function renameMediaDir(fromSlug: string, toSlug: string): Promise<void> {
  if (fromSlug === toSlug) return;
  const root = getMediaRoot();
  const fromDir = path.join(root, 'pilots', fromSlug);
  const toDir = path.join(root, 'pilots', toSlug);
  try {
    await fs.access(fromDir);
  } catch {
    return;
  }
  await fs.mkdir(path.dirname(toDir), { recursive: true });
  try {
    await fs.access(toDir);
    await fs.cp(fromDir, toDir, { recursive: true });
    await fs.rm(fromDir, { recursive: true, force: true });
  } catch {
    try {
      await fs.rename(fromDir, toDir);
    } catch {
      await fs.cp(fromDir, toDir, { recursive: true });
      await fs.rm(fromDir, { recursive: true, force: true });
    }
  }
}

async function rewritePhotoUrls(pilotId: string, fromSlug: string, toSlug: string): Promise<void> {
  const pilot = await prisma.pilot.findUnique({
    where: { id: pilotId },
    include: { seriesPhotos: true },
  });
  if (!pilot) return;

  await prisma.pilot.update({
    where: { id: pilotId },
    data: { photoUrl: rewritePilotMediaPath(pilot.photoUrl, fromSlug, toSlug) },
  });

  for (const photo of pilot.seriesPhotos) {
    const next = rewritePilotMediaPath(photo.photoUrl, fromSlug, toSlug);
    if (next === photo.photoUrl) continue;
    await prisma.pilotSeriesPhoto.update({
      where: { id: photo.id },
      data: { photoUrl: next },
    });
  }
}

async function uniqueNameSlug(base: string, excludePilotId?: string): Promise<string> {
  let slug = base;
  let suffix = 2;
  for (;;) {
    const clash = await prisma.pilot.findUnique({ where: { slug } });
    if (!clash || clash.id === excludePilotId) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

function titleCase(value: string): string {
  return value
    .split(/([\s-])/)
    .map((part) => (/^[a-z]/i.test(part) ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part))
    .join('');
}

type PilotRow = Awaited<ReturnType<typeof loadPilots>>[number];

async function loadPilots() {
  return prisma.pilot.findMany({
    include: {
      seriesAliases: true,
      _count: { select: { results: true, seriesPhotos: true } },
    },
    orderBy: { slug: 'asc' },
  });
}

function deriveEnglishNames(pilot: PilotRow): { firstName: string; lastName: string } | null {
  const aliasNames = pilot.seriesAliases.map((a) => a.name);

  // 1) D1 car number map
  if (/^\d+$/.test(pilot.slug)) {
    const known = D1GP_KNOWN_DRIVERS[Number(pilot.slug)];
    if (known && isLatinName(known.firstName) && isLatinName(known.lastName)) {
      return { firstName: known.firstName, lastName: known.lastName };
    }
  }

  // 2) JA → Latin tables (known + historic)
  const jaHit =
    lookupJaLatin(pilot.firstName, pilot.lastName, `${pilot.lastName}${pilot.firstName}`, ...aliasNames) ??
    (() => {
      for (const name of aliasNames) {
        const ranking = D1GP_DRIVER_BY_RANKING_NAME[name.trim()];
        if (ranking && isLatinName(ranking.firstName)) {
          return { firstName: ranking.firstName, lastName: ranking.lastName };
        }
        const compact = compactJa(name);
        for (const [key, driver] of Object.entries(D1GP_DRIVER_BY_RANKING_NAME)) {
          if (compactJa(key) === compact && isLatinName(driver.firstName)) {
            return { firstName: driver.firstName, lastName: driver.lastName };
          }
        }
        for (const driver of Object.values(D1GP_KNOWN_DRIVERS)) {
          if (driver.nameJa && compactJa(driver.nameJa) === compact && isLatinName(driver.firstName)) {
            return { firstName: driver.firstName, lastName: driver.lastName };
          }
        }
      }
      return null;
    })();
  if (jaHit) return jaHit;

  // 3) Underscore slug is historically family_given.
  //    Do this before Cyrillic aliases — many RD aliases are stored as «Имя Фамилия».
  if (pilot.slug.includes('_')) {
    const parts = pilot.slug.split('_').filter(Boolean);
    if (parts.length === 2) {
      return { firstName: titleCase(parts[1]!), lastName: titleCase(parts[0]!) };
    }
  }

  // 4) Cyrillic series alias — try «Фамилия Имя», but if that yields last-first vs a
  //    Latin alias in Western order, prefer the Latin alias.
  for (const alias of aliasNames) {
    if (/[\u0400-\u04FF]/.test(alias)) {
      return englishNamesFromNameRu(alias);
    }
  }

  // 5) Latin series alias «Given Family» (skip ALL-CAPS family-given dumps)
  for (const alias of aliasNames) {
    if (containsJapaneseScript(alias)) continue;
    const cleaned = alias.replace(/\([^)]*\)/g, '').replace(/（[^）]*）/g, '').trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && parts.every((part) => isLatinName(part))) {
      const allCaps = parts.every((part) => part === part.toUpperCase() && /[A-Z]/.test(part));
      if (allCaps) {
        // «PUŚCIAN TOBIASZ» / «GAVA VADIM» style → family given
        return {
          firstName: titleCase(parts[parts.length - 1]!),
          lastName: titleCase(parts.slice(0, -1).join(' ')),
        };
      }
      return { firstName: titleCase(parts[0]!), lastName: titleCase(parts.slice(1).join(' ')) };
    }
  }

  // 6) Series-prefixed slug with kana/latin rest: d1-たかやま-けんじ / d1-family-given
  for (const prefix of SERIES_PILOT_SLUG_PREFIXES) {
    if (!pilot.slug.startsWith(prefix)) continue;
    const rest = pilot.slug.slice(prefix.length);
    if (!rest || /^r?\d+$/i.test(rest)) continue;
    const bits = rest.split('-').filter(Boolean);
    if (bits.length >= 2) {
      const family = kanaToRomaji(bits[0]!);
      const given = kanaToRomaji(bits.slice(1).join(' '));
      const slug = nameSlug(given, family);
      if (slug) {
        return {
          firstName: titleCase(transliterate(given).replace(/['ʼ`´]/g, '')),
          lastName: titleCase(transliterate(family).replace(/['ʼ`´]/g, '')),
        };
      }
    } else if (bits.length === 1 && !containsJapaneseScript(bits[0]!)) {
      // single token — not enough
    }
  }

  // 7) Existing Latin fields (canonical / overrides)
  const english = canonicalEnglishNames(pilot);
  if (isLatinName(english.firstName) && isLatinName(english.lastName) && english.firstName && english.lastName) {
    const slug = nameSlug(english.firstName, english.lastName);
    if (slug) return english;
  }

  // 8) Kana-only fields
  if (pilot.firstName && pilot.lastName) {
    const slug = nameSlug(pilot.firstName, pilot.lastName);
    if (slug && /^[a-z]+(-[a-z0-9]+)+$/.test(slug)) {
      return {
        firstName: titleCase(kanaToRomaji(pilot.firstName)),
        lastName: titleCase(kanaToRomaji(pilot.lastName)),
      };
    }
  }

  return null;
}

function scorePilot(pilot: PilotRow): number {
  return pilot._count.results * 1000 + (pilot.photoUrl ? 100 : 0) + pilot._count.seriesPhotos * 10;
}

function pickPrimary<T extends { fromSlug: string; toSlug: string; score: number }>(pool: T[]): T {
  return [...pool].sort((a, b) => {
    const aExact = a.fromSlug === a.toSlug ? 1 : 0;
    const bExact = b.fromSlug === b.toSlug ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    const aHuman = isHumanReadableSlug(a.fromSlug) ? 1 : 0;
    const bHuman = isHumanReadableSlug(b.fromSlug) ? 1 : 0;
    if (aHuman !== bHuman) return bHuman - aHuman;
    return b.score - a.score || a.fromSlug.localeCompare(b.fromSlug);
  })[0]!;
}

function isGarbageName(firstName: string, lastName: string): boolean {
  const slug = nameSlug(firstName, lastName);
  if (!slug || slug === 'pilot') return true;
  if (firstName === lastName && /[^\x00-\x7F]/.test(firstName)) return true;
  if (/dorifuto|aruka/i.test(slug)) return true;
  if ((firstName + lastName).includes('ー') || (firstName + lastName).includes('ャ')) return true;
  return false;
}

async function main() {
  const pilots = await loadPilots();
  const plans: Array<{
    id: string;
    fromSlug: string;
    toSlug: string;
    firstName: string;
    lastName: string;
    score: number;
  }> = [];
  const skipped: Array<{ slug: string; reason: string }> = [];

  for (const pilot of pilots) {
    const names = deriveEnglishNames(pilot);
    if (!names) {
      if (!isHumanReadableSlug(pilot.slug)) {
        skipped.push({ slug: pilot.slug, reason: 'no latin name' });
      }
      continue;
    }

    const toSlug = nameSlug(names.firstName, names.lastName);
    if (!toSlug || isGarbageName(names.firstName, names.lastName)) {
      skipped.push({ slug: pilot.slug, reason: 'empty/garbage slug' });
      continue;
    }

    // Only rewrite machine aliases: numeric, underscore, series-prefixed.
    // Already-human slugs (including JP last-first like suenaga-masao) stay put —
    // flipped DB first/last fields would otherwise reverse correct Western slugs.
    if (isHumanReadableSlug(pilot.slug)) continue;

    plans.push({
      id: pilot.id,
      fromSlug: pilot.slug,
      toSlug,
      firstName: names.firstName,
      lastName: names.lastName,
      score: scorePilot(pilot),
    });
  }

  /** targetSlug → candidates */
  const groups = new Map<string, typeof plans>();
  for (const plan of plans) {
    const list = groups.get(plan.toSlug) ?? [];
    list.push(plan);
    groups.set(plan.toSlug, list);
  }

  let renamed = 0;
  let merged = 0;
  const mapping: Array<{ from: string; to: string }> = [];

  for (const [base, candidates] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    // Include existing pilot already on the target slug
    const existing = await prisma.pilot.findUnique({
      where: { slug: base },
      include: { _count: { select: { results: true, seriesPhotos: true } } },
    });

    const pool = [...candidates];
    if (existing && !pool.some((c) => c.id === existing.id)) {
      const names = {
        firstName: existing.firstName,
        lastName: existing.lastName,
      };
      pool.push({
        id: existing.id,
        fromSlug: existing.slug,
        toSlug: base,
        firstName: isLatinName(existing.firstName) ? existing.firstName : candidates[0]!.firstName,
        lastName: isLatinName(existing.lastName) ? existing.lastName : candidates[0]!.lastName,
        score:
          existing._count.results * 1000 +
          5000 +
          (existing.photoUrl ? 100 : 0) +
          existing._count.seriesPhotos * 10,
      });
      void names;
    }

    const primary = pickPrimary(pool);

    for (const duplicate of pool) {
      if (duplicate.id === primary.id) continue;
      console.log(`merge ${duplicate.fromSlug} → ${primary.fromSlug} (canon ${base})`);
      if (!dryRun) {
        await mergePilotInto(prisma, duplicate.id, primary.id);
        await rewritePhotoUrls(primary.id, duplicate.fromSlug, primary.fromSlug);
        await renameMediaDir(duplicate.fromSlug, primary.fromSlug);
      }
      mapping.push({ from: duplicate.fromSlug, to: base });
      merged += 1;
    }

    const current = dryRun ? null : await prisma.pilot.findUnique({ where: { id: primary.id } });
    const currentSlug = dryRun ? primary.fromSlug : current?.slug;
    if (!currentSlug) continue;

    const targetSlug = dryRun ? base : await uniqueNameSlug(base, primary.id);
    if (currentSlug === targetSlug) {
      if (!dryRun && current) {
        await prisma.pilot.update({
          where: { id: current.id },
          data: { firstName: primary.firstName, lastName: primary.lastName },
        });
      }
      continue;
    }

    console.log(`rename ${currentSlug} → ${targetSlug} (${primary.firstName} ${primary.lastName})`);
    mapping.push({ from: currentSlug, to: targetSlug });

    if (!dryRun && current) {
      await prisma.pilot.update({
        where: { id: current.id },
        data: {
          slug: targetSlug,
          firstName: primary.firstName,
          lastName: primary.lastName,
        },
      });
      await rewritePhotoUrls(current.id, currentSlug, targetSlug);
      await renameMediaDir(currentSlug, targetSlug);
      await syncPilotPrimaryPhoto(prisma, current.id);
    }
    renamed += 1;
  }

  console.log(`\n${dryRun ? 'Dry run. ' : ''}Done. renamed=${renamed} merged=${merged} planned=${plans.length}`);
  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length}:`);
    for (const row of skipped.slice(0, 40)) console.log(`  ${row.slug}: ${row.reason}`);
    if (skipped.length > 40) console.log(`  ... +${skipped.length - 40}`);
  }
  if (mapping.length) {
    console.log('\n--- mapping ---');
    for (const row of mapping) console.log(`${row.from}\t${row.to}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
