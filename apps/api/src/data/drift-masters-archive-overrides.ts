import type { PrismaClient } from '@prisma/client';
import { pilotSlugLookupCandidates } from '../lib/pilotSlug.js';
import { refreshStageCoefficientForEvent } from '../lib/stageCoefficient.js';

export interface DmArchiveResultOverride {
  pilotSlug: string;
  eventSlug: string;
  qualPosition?: number | null;
  qualScore100?: number | null;
  tandemPosition?: number | null;
  country?: string | null;
}

/** Verified corrections where archive / RawMotion data is incomplete or wrong. */
export const DM_ARCHIVE_RESULT_OVERRIDES: Record<number, DmArchiveResultOverride[]> = {
  2019: [
    {
      pilotSlug: 'georgy-chivchyan',
      eventSlug: 'dm-r4',
      qualPosition: 5,
      qualScore100: 91,
      tandemPosition: 2,
      country: 'RU',
    },
  ],
};

export async function applyArchiveResultOverrides(
  prisma: PrismaClient,
  seasonYear: number,
  seasonId: string,
): Promise<number> {
  const overrides = DM_ARCHIVE_RESULT_OVERRIDES[seasonYear];
  if (!overrides?.length) return 0;

  let applied = 0;
  const eventsToRefresh = new Set<string>();

  for (const override of overrides) {
    const pilot = await prisma.pilot.findFirst({
      where: { slug: { in: pilotSlugLookupCandidates(override.pilotSlug) } },
    });
    if (!pilot) continue;

    const event = await prisma.event.findUnique({
      where: { seasonId_slug: { seasonId, slug: override.eventSlug } },
    });
    if (!event) continue;

    if (override.country != null) {
      await prisma.pilot.update({
        where: { id: pilot.id },
        data: { country: override.country },
      });
    }

    await prisma.eventResult.upsert({
      where: { eventId_pilotId: { eventId: event.id, pilotId: pilot.id } },
      update: {
        qualPosition: override.qualPosition,
        qualScore100: override.qualScore100,
        tandemPosition: override.tandemPosition,
        dataStatus: 'VERIFIED',
      },
      create: {
        eventId: event.id,
        pilotId: pilot.id,
        qualPosition: override.qualPosition ?? null,
        qualScore100: override.qualScore100 ?? null,
        tandemPosition: override.tandemPosition ?? null,
        points: 0,
        dataStatus: 'VERIFIED',
      },
    });

    eventsToRefresh.add(event.id);
    applied++;
  }

  for (const eventId of eventsToRefresh) {
    await refreshStageCoefficientForEvent(prisma, eventId);
  }

  return applied;
}
