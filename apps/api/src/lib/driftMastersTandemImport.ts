import type { PrismaClient } from '@prisma/client';
import type { DmTandemResult } from '../importers/drift-masters-rawmotion-tandem.js';
import type { DmPilot } from '../importers/drift-masters.js';
import { findDmQualResult } from '../importers/drift-masters.js';
import { findMatchingPilot } from './pilotMatch.js';
import { normalizeToken } from './transliterate.js';

function tandemRowKey(row: Pick<DmTandemResult, 'firstName' | 'lastName' | 'fullName'>): string {
  return normalizeToken(row.fullName || `${row.firstName} ${row.lastName}`);
}

function findDmPilotForTandem(pilots: DmPilot[], row: DmTandemResult): DmPilot | undefined {
  if (row.bib != null) {
    const byBib = pilots.filter((pilot) => pilot.number === row.bib);
    if (byBib.length === 1) return byBib[0];
  }

  const key = tandemRowKey(row);
  const exact = pilots.find(
    (pilot) => tandemRowKey({ firstName: pilot.firstName, lastName: pilot.lastName, fullName: pilot.nameAlias ?? '' }) === key,
  );
  if (exact) return exact;

  return pilots.find((pilot) =>
    findDmQualResult(
      [
        {
          roundNumber: row.roundNumber,
          rank: row.tandemPosition,
          qualScore100: 0,
          firstName: row.firstName,
          lastName: row.lastName,
          fullName: row.fullName,
          nationality: null,
          bib: row.bib,
        },
      ],
      pilot.firstName,
      pilot.lastName,
      pilot.nameAlias,
    ),
  );
}

export interface DriftMastersTandemBackfillResult {
  tandemMatched: number;
}

export async function applyDriftMastersTandemBackfill(
  prisma: PrismaClient,
  options: {
    seriesId: string;
    pilots: DmPilot[];
    tandemByRound: Map<number, DmTandemResult[]>;
    eventRecords: Map<string, { id: string }>;
    pilotRecordsBySlug: Map<string, { id: string }>;
    resolvePilotSlug: (pilot: DmPilot, seriesId: string) => Promise<string>;
    /** When true, overwrite existing tandem positions (archive re-import). */
    overwrite?: boolean;
  },
): Promise<DriftMastersTandemBackfillResult> {
  const {
    seriesId,
    pilots,
    tandemByRound,
    eventRecords,
    pilotRecordsBySlug,
    resolvePilotSlug,
    overwrite = false,
  } = options;

  let tandemMatched = 0;

  async function resolvePilotId(row: DmTandemResult): Promise<string | null> {
    const dmPilot = findDmPilotForTandem(pilots, row);
    if (dmPilot) {
      const slug = await resolvePilotSlug(dmPilot, seriesId);
      const cached = pilotRecordsBySlug.get(slug);
      if (cached) return cached.id;
    }

    if (row.fullName === 'Unknown') return null;

    const match = await findMatchingPilot(
      prisma,
      {
        firstName: row.firstName,
        lastName: row.lastName,
        nameAlias: row.fullName,
        number: row.bib,
      },
      { excludeSlugPrefix: 'dm-', seriesId },
    );
    return match?.id ?? null;
  }

  for (const [roundNumber, rows] of tandemByRound) {
    const event = eventRecords.get(`dm-r${roundNumber}`);
    if (!event) continue;

    for (const row of rows) {
      const pilotId = await resolvePilotId(row);
      if (!pilotId) continue;

      const existing = await prisma.eventResult.findUnique({
        where: { eventId_pilotId: { eventId: event.id, pilotId } },
      });
      if (existing && existing.tandemPosition != null && !overwrite) continue;

      if (existing) {
        await prisma.eventResult.update({
          where: { id: existing.id },
          data: {
            tandemPosition: row.tandemPosition,
            number: existing.number ?? row.bib,
          },
        });
      } else {
        await prisma.eventResult.create({
          data: {
            eventId: event.id,
            pilotId,
            number: row.bib,
            tandemPosition: row.tandemPosition,
            points: 0,
            dataStatus: 'UNVERIFIED',
          },
        });
      }
      tandemMatched++;
    }
  }

  return { tandemMatched };
}
