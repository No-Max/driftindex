import type { Pilot, PrismaClient } from '@prisma/client';
import {
  canonicalPilotSlugPriority,
  canonicalStoredPilotNames,
  pilotNameFieldsForUpsert,
  pilotNameKey,
} from './pilotNames.js';
import { findPilotBySeriesAlias, pilotAliasKey } from './pilotSeriesAlias.js';
import { syncPilotPrimaryPhoto } from './media/pilotPhoto.js';
import { buildNameKey, nameTokens } from './transliterate.js';

export interface PilotIdentity {
  slug?: string;
  nameAlias?: string | null;
  aliases?: Array<string | null | undefined>;
  firstName: string;
  lastName: string;
  number: number | null;
}

export type MatchConfidence = 'exact' | 'weak' | 'none';

export function matchConfidence(a: PilotIdentity, b: PilotIdentity): MatchConfidence {
  for (const keyA of identityKeys(a)) {
    for (const keyB of identityKeys(b)) {
      const tokensA = keyA.split('|');
      const tokensB = keyB.split('|');
      if (tokensA.length < 2 || tokensB.length < 2) continue;

      if (keyA === keyB) return 'exact';

      const overlap = tokensA.filter((token) => tokensB.includes(token));
      if (overlap.length >= 2 && overlap.length === tokensA.length && overlap.length === tokensB.length) {
        return 'exact';
      }
    }
  }

  return 'none';
}

export function namesMatch(a: PilotIdentity, b: PilotIdentity): boolean {
  return matchConfidence(a, b) === 'exact';
}

export async function findMatchingPilot(
  prisma: PrismaClient,
  identity: PilotIdentity,
  options?: { excludeSlugPrefix?: string; seriesId?: string },
): Promise<Pilot | null> {
  const excludePrefix = options?.excludeSlugPrefix;

  if (options?.seriesId) {
    const aliasMatch = await findPilotBySeriesAlias(prisma, options.seriesId, [
      identity.nameAlias,
      `${identity.firstName} ${identity.lastName}`.trim(),
      ...(identity.aliases ?? []),
    ]);
    if (
      aliasMatch &&
      (!excludePrefix || !aliasMatch.slug.startsWith(excludePrefix)) &&
      (!identity.slug || aliasMatch.slug !== identity.slug)
    ) {
      return aliasMatch;
    }
  }

  const key = buildNameKey(identity.firstName, identity.lastName, identity.nameAlias);
  if (!key || key.split('|').length < 2) return null;

  const candidates = await prisma.pilot.findMany({
    where: {
      ...(excludePrefix ? { NOT: { slug: { startsWith: excludePrefix } } } : {}),
      ...(identity.slug ? { slug: { not: identity.slug } } : {}),
    },
    include: { seriesAliases: true },
  });

  const matched = candidates.filter((candidate) => namesMatch(candidate, identity));
  if (matched.length === 0) return null;
  if (matched.length === 1) return matched[0]!;

  if (identity.number != null) {
    const withNumber = matched.filter((candidate) => candidate.number === identity.number);
    if (withNumber.length === 1) return withNumber[0]!;
  }

  return matched.sort(
    (a, b) => canonicalPilotSlugPriority(b.slug) - canonicalPilotSlugPriority(a.slug),
  )[0]!;
}

export async function mergePilotInto(
  prisma: PrismaClient,
  fromPilotId: string,
  toPilotId: string,
): Promise<void> {
  if (fromPilotId === toPilotId) return;

  const fromResults = await prisma.eventResult.findMany({ where: { pilotId: fromPilotId } });
  for (const result of fromResults) {
    const existing = await prisma.eventResult.findUnique({
      where: { eventId_pilotId: { eventId: result.eventId, pilotId: toPilotId } },
    });
    if (existing) {
      await prisma.eventResult.delete({ where: { id: result.id } });
      continue;
    }
    await prisma.eventResult.update({
      where: { id: result.id },
      data: { pilotId: toPilotId },
    });
  }

  const fromPhotos = await prisma.pilotSeriesPhoto.findMany({ where: { pilotId: fromPilotId } });
  for (const photo of fromPhotos) {
    const existing = await prisma.pilotSeriesPhoto.findUnique({
      where: { pilotId_seriesId: { pilotId: toPilotId, seriesId: photo.seriesId } },
    });
    if (!existing) {
      await prisma.pilotSeriesPhoto.create({
        data: {
          pilotId: toPilotId,
          seriesId: photo.seriesId,
          photoUrl: photo.photoUrl,
          photoSourceUrl: photo.photoSourceUrl,
          photoUpdatedAt: photo.photoUpdatedAt,
        },
      });
    }
  }

  const fromAliases = await prisma.pilotSeriesAlias.findMany({ where: { pilotId: fromPilotId } });
  for (const alias of fromAliases) {
    const existing = await prisma.pilotSeriesAlias.findUnique({
      where: { seriesId_name: { seriesId: alias.seriesId, name: alias.name } },
    });
    if (existing && existing.id !== alias.id) {
      await prisma.pilotSeriesAlias.delete({ where: { id: alias.id } });
      continue;
    }
    await prisma.pilotSeriesAlias.update({
      where: { id: alias.id },
      data: { pilotId: toPilotId },
    });
  }

  await prisma.pilotSeriesPhoto.deleteMany({ where: { pilotId: fromPilotId } });
  await prisma.pilot.delete({ where: { id: fromPilotId } });
  await syncPilotPrimaryPhoto(prisma, toPilotId);
}

export async function normalizePilotRecord(prisma: PrismaClient, pilot: Pilot): Promise<Pilot> {
  const english = await canonicalStoredPilotNames(prisma, pilot);
  const fields = pilotNameFieldsForUpsert(english);
  if (!fields.firstName && !fields.lastName) return pilot;
  if (fields.firstName === pilot.firstName && fields.lastName === pilot.lastName) {
    return pilot;
  }
  return prisma.pilot.update({
    where: { id: pilot.id },
    data: fields,
  });
}

export interface PilotMergeGroup {
  nameKey: string;
  tokens: string[];
  pilots: Pilot[];
}

export interface PilotDedupeReport {
  merged: Array<{ from: string; to: string; nameKey: string }>;
  /** Merged by name, but car numbers differ — worth a quick manual check. */
  reviewSuggested: Array<{ nameKey: string; slugs: string[]; reason: string }>;
  normalized: number;
}

export function groupPilotsByNameKey(pilots: Pilot[]): PilotMergeGroup[] {
  const groups = new Map<string, Pilot[]>();
  for (const pilot of pilots) {
    const key = pilotNameKey(pilot);
    if (!key || key.split('|').length < 2) continue;
    const list = groups.get(key) ?? [];
    list.push(pilot);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([nameKey, list]) => ({
      nameKey,
      tokens: nameTokens(list[0]!.firstName, list[0]!.lastName),
      pilots: list,
    }));
}

export async function dedupePilotsByTransliteration(prisma: PrismaClient): Promise<PilotDedupeReport> {
  const report: PilotDedupeReport = { merged: [], reviewSuggested: [], normalized: 0 };

  for (const pilot of await prisma.pilot.findMany()) {
    const english = await canonicalStoredPilotNames(prisma, pilot);
    const fields = pilotNameFieldsForUpsert(english);
    if (!fields.firstName && !fields.lastName) continue;
    if (pilot.firstName !== fields.firstName || pilot.lastName !== fields.lastName) {
      await prisma.pilot.update({
        where: { id: pilot.id },
        data: fields,
      });
      report.normalized++;
    }
  }

  const pilots = await prisma.pilot.findMany();
  const groups = groupPilotsByNameKey(pilots);

  for (const group of groups) {
    const canonical = pickCanonicalFromGroup(group.pilots);
    const others = group.pilots.filter((pilot) => pilot.id !== canonical.id);

    const distinctNumbers = new Set(
      group.pilots.map((pilot) => pilot.number).filter((value): value is number => value != null),
    );
    if (distinctNumbers.size > 1) {
      report.reviewSuggested.push({
        nameKey: group.nameKey,
        slugs: group.pilots.map((pilot) => pilot.slug),
        reason: `Different car numbers: ${[...distinctNumbers].join(', ')}`,
      });
    }

    for (const duplicate of others) {
      await mergePilotInto(prisma, duplicate.id, canonical.id);
      report.merged.push({ from: duplicate.slug, to: canonical.slug, nameKey: group.nameKey });
    }

    const english = await canonicalStoredPilotNames(prisma, canonical);
    const fields = pilotNameFieldsForUpsert(english);
    if (fields.firstName || fields.lastName) {
      await prisma.pilot.update({
        where: { id: canonical.id },
        data: fields,
      });
      report.normalized++;
    }
  }

  return report;
}

function pickCanonicalFromGroup(pilots: Pilot[]): Pilot {
  return [...pilots].sort((a, b) => {
    const slugDiff = canonicalPilotSlugPriority(b.slug) - canonicalPilotSlugPriority(a.slug);
    if (slugDiff !== 0) return slugDiff;
    const aLatin = /^[A-Za-z]/.test(a.firstName) ? 1 : 0;
    const bLatin = /^[A-Za-z]/.test(b.firstName) ? 1 : 0;
    if (bLatin !== aLatin) return bLatin - aLatin;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  })[0]!;
}

export async function mergeAlmanacPilotDuplicates(prisma: PrismaClient): Promise<number> {
  const almanacPilots = await prisma.pilot.findMany({
    where: { slug: { startsWith: 'da-' } },
    orderBy: { slug: 'asc' },
  });

  let merged = 0;
  for (const pilot of almanacPilots) {
    const target = await findMatchingPilot(prisma, pilot, { excludeSlugPrefix: 'da-' });
    if (!target) continue;

    await mergePilotInto(prisma, pilot.id, target.id);
    merged++;
    console.log(`Merged ${pilot.slug} → ${target.slug}`);
  }

  return merged;
}

type PilotIdentityLike = PilotIdentity & {
  seriesAliases?: Array<{ name: string }>;
};

function identityKeys(identity: PilotIdentityLike): string[] {
  const keys = new Set<string>();
  const primary = buildNameKey(identity.firstName, identity.lastName, identity.nameAlias);
  if (primary) keys.add(primary);

  for (const alias of [identity.nameAlias, ...(identity.aliases ?? [])]) {
    if (!alias) continue;
    const key = pilotAliasKey(alias);
    if (key) keys.add(key);
  }

  for (const alias of identity.seriesAliases ?? []) {
    const key = pilotAliasKey(alias.name);
    if (key) keys.add(key);
  }

  return [...keys];
}
