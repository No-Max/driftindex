import type { PrismaClient, Pilot } from '@prisma/client';
import type { DmPilot, DmQualResult } from '../importers/drift-masters.js';
import { findDmQualResult } from '../importers/drift-masters.js';
import { normalizeToken } from './transliterate.js';
import { findMatchingPilot } from './pilotMatch.js';
import { canonicalEnglishNames } from './pilotNames.js';
import { toQualScore100 } from './qualScore.js';

function pilotMatchesEntry(pilot: Pick<Pilot, 'firstName' | 'lastName'>, entryName: string): boolean {
  const entryLast = normalizeToken(entryName.split(/\s+/).slice(-1)[0] ?? entryName);
  const pilotLast = normalizeToken(pilot.lastName);
  if (!entryLast || !pilotLast) return false;
  return entryLast === pilotLast || entryLast.startsWith(pilotLast) || pilotLast.startsWith(entryLast);
}

function pilotEnteredRound(pilot: DmPilot, roundNumber: number): boolean {
  return pilot.stages.some((stage) => stage.roundNumber === roundNumber);
}

function filterCandidatesByEntry(
  candidates: Pilot[],
  seasonPilots: DmPilot[],
): Pilot[] {
  const matches = candidates.filter((candidate) =>
    seasonPilots.some((entry) => pilotMatchesEntry(candidate, entry.nameAlias ?? `${entry.firstName} ${entry.lastName}`)),
  );
  return matches.length > 0 ? matches : candidates;
}

export interface DriftMastersQualBackfillResult {
  qualMatched: number;
  qualOnly: number;
  resultCount: number;
}

export async function applyDriftMastersQualBackfill(
  prisma: PrismaClient,
  options: {
    seriesId: string;
    seriesSlug: string;
    dataStatus: 'VERIFIED' | 'UNVERIFIED';
    pilots: DmPilot[];
    qualByRound: Map<number, DmQualResult[]>;
    eventRecords: Map<string, { id: string }>;
    pilotRecordsBySlug: Map<string, { id: string }>;
    resolvePilotSlug: (pilot: DmPilot, seriesId: string) => Promise<string>;
  },
): Promise<DriftMastersQualBackfillResult> {
  const {
    seriesId,
    seriesSlug,
    dataStatus,
    pilots,
    qualByRound,
    eventRecords,
    pilotRecordsBySlug,
    resolvePilotSlug,
  } = options;

  let qualMatched = 0;
  let qualOnly = 0;
  let resultCount = 0;

  async function resolvePilotForQual(qual: DmQualResult): Promise<{ id: string } | null> {
    if (qual.bib != null) {
      const bySeasonNumber = pilots.filter((pilot) => pilot.number === qual.bib);
      if (bySeasonNumber.length === 1) {
        const dmPilot = bySeasonNumber[0]!;
        if (pilotEnteredRound(dmPilot, qual.roundNumber)) {
          const slug = await resolvePilotSlug(dmPilot, seriesId);
          const cached = pilotRecordsBySlug.get(slug);
          if (cached) return cached;

          const english = canonicalEnglishNames(dmPilot);
          const pilotRecord = await prisma.pilot.upsert({
            where: { slug },
            update: {
              firstName: english.firstName,
              lastName: english.lastName,
              country: dmPilot.country,
              number: dmPilot.number,
            },
            create: {
              slug,
              firstName: english.firstName,
              lastName: english.lastName,
              country: dmPilot.country,
              number: dmPilot.number,
            },
          });
          pilotRecordsBySlug.set(slug, pilotRecord);
          return pilotRecord;
        }
      }
    }

    const dmPilot = pilots.find((pilot) =>
      findDmQualResult([qual], pilot.firstName, pilot.lastName, pilot.nameAlias),
    );
    if (dmPilot) {
      const slug = await resolvePilotSlug(dmPilot, seriesId);
      const cached = pilotRecordsBySlug.get(slug);
      if (cached) return cached;

      const english = canonicalEnglishNames(dmPilot);
      const pilotRecord = await prisma.pilot.upsert({
        where: { slug },
        update: {
          firstName: english.firstName,
          lastName: english.lastName,
          country: dmPilot.country,
          number: dmPilot.number,
        },
        create: {
          slug,
          firstName: english.firstName,
          lastName: english.lastName,
          country: dmPilot.country,
          number: dmPilot.number,
        },
      });
      pilotRecordsBySlug.set(slug, pilotRecord);
      return pilotRecord;
    }

    if (qual.bib != null && qual.fullName !== 'Unknown') {
      const byNumber = await prisma.pilot.findMany({ where: { number: qual.bib } });
      const filtered = filterCandidatesByEntry(byNumber, pilots);
      if (filtered.length === 1) {
        const pilotRecord = { id: filtered[0]!.id };
        pilotRecordsBySlug.set(filtered[0]!.slug, pilotRecord);
        return pilotRecord;
      }
    }

    const hasIdentity =
      qual.firstName.trim().length > 0 &&
      qual.lastName.trim().length > 0 &&
      qual.fullName !== 'Unknown';
    if (!hasIdentity) return null;

    const match = await findMatchingPilot(
      prisma,
      {
        firstName: qual.firstName,
        lastName: qual.lastName,
        nameAlias: qual.fullName,
        number: qual.fullName !== 'Unknown' ? qual.bib : null,
      },
      { excludeSlugPrefix: 'dm-', seriesId },
    );
    if (match) {
      const pilotRecord = { id: match.id };
      pilotRecordsBySlug.set(match.slug, pilotRecord);
      return pilotRecord;
    }

    return null;
  }

  for (const [roundNumber, qualRows] of qualByRound) {
    const event = eventRecords.get(`dm-r${roundNumber}`);
    if (!event) continue;

    for (const qual of qualRows) {
      const pilotRecord = await resolvePilotForQual(qual);
      if (!pilotRecord) continue;

      const existing = await prisma.eventResult.findUnique({
        where: { eventId_pilotId: { eventId: event.id, pilotId: pilotRecord.id } },
      });
      if (existing?.qualScore100 != null) continue;

      const qualScore100 = toQualScore100(qual.qualScore100, seriesSlug);
      if (existing) {
        await prisma.eventResult.update({
          where: { id: existing.id },
          data: { qualPosition: qual.rank, qualScore100, number: qual.bib },
        });
        qualMatched++;
        continue;
      }

      await prisma.eventResult.create({
        data: {
          eventId: event.id,
          pilotId: pilotRecord.id,
          number: qual.bib,
          qualPosition: qual.rank,
          qualScore100,
          points: 0,
          dataStatus,
        },
      });
      qualOnly++;
      qualMatched++;
      resultCount++;
    }
  }

  return { qualMatched, qualOnly, resultCount };
}
