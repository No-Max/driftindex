import type { Pilot, PrismaClient } from '@prisma/client';
import { nameTokens } from './transliterate.js';

export function normalizePilotAliasName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

export function pilotAliasKey(name: string): string {
  return nameTokens(name).join('|');
}

export async function findPilotBySeriesAlias(
  prisma: PrismaClient,
  seriesId: string,
  aliases: Array<string | null | undefined>,
): Promise<Pilot | null> {
  const names = aliases.map((alias) => (alias ? normalizePilotAliasName(alias) : '')).filter(Boolean);
  if (names.length === 0) return null;

  const keys = names.map(pilotAliasKey).filter(Boolean);
  const match = await prisma.pilotSeriesAlias.findFirst({
    where: {
      seriesId,
      OR: [
        { name: { in: names } },
        ...(keys.length > 0 ? [{ nameKey: { in: keys } }] : []),
      ],
    },
    include: { pilot: true },
  });

  return match?.pilot ?? null;
}

export async function upsertPilotSeriesAlias(
  prisma: PrismaClient,
  input: {
    pilotId: string;
    seriesId: string;
    name: string | null | undefined;
  },
) {
  if (!input.name) return null;

  const name = normalizePilotAliasName(input.name);
  if (!name) return null;

  return prisma.pilotSeriesAlias.upsert({
    where: { seriesId_name: { seriesId: input.seriesId, name } },
    update: {
      pilotId: input.pilotId,
      nameKey: pilotAliasKey(name),
    },
    create: {
      pilotId: input.pilotId,
      seriesId: input.seriesId,
      name,
      nameKey: pilotAliasKey(name),
    },
  });
}
