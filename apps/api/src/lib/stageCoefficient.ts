import type { GridSource, PrismaClient } from '@prisma/client';

export const GRID_REFERENCE = 32;
export const GRID_CAP = 32;

export interface StageCoefficientInput {
  qualPosition: number | null;
  qualPoints: number | null;
  points: number;
}

export interface StageCoefficientResult {
  gridActual: number | null;
  gridReference: number;
  stageCoefficient: number | null;
  gridSource: GridSource | null;
}

function hasQualData(results: StageCoefficientInput[]): boolean {
  return results.some((row) => row.qualPosition != null || row.qualPoints != null);
}

export function computeStageCoefficient(
  results: StageCoefficientInput[],
): StageCoefficientResult {
  const empty: StageCoefficientResult = {
    gridActual: null,
    gridReference: GRID_REFERENCE,
    stageCoefficient: null,
    gridSource: null,
  };

  if (results.length === 0) return empty;

  if (hasQualData(results)) {
    const sorted = [...results].sort((a, b) => {
      const aPos = a.qualPosition ?? Number.MAX_SAFE_INTEGER;
      const bPos = b.qualPosition ?? Number.MAX_SAFE_INTEGER;
      if (aPos !== bPos) return aPos - bPos;
      return (b.qualPoints ?? 0) - (a.qualPoints ?? 0);
    });
    const topGrid = sorted.slice(0, GRID_CAP);
    const gridActual = topGrid.filter((row) => (row.qualPoints ?? 0) > 0).length;
    if (gridActual === 0) return empty;

    return {
      gridActual,
      gridReference: GRID_REFERENCE,
      stageCoefficient: 1 - 1 / gridActual + 1 / GRID_REFERENCE,
      gridSource: 'QUAL',
    };
  }

  const sorted = [...results].sort((a, b) => b.points - a.points);
  const topGrid = sorted.slice(0, GRID_CAP);
  const gridActual = topGrid.filter((row) => row.points > 0).length;
  if (gridActual === 0) return empty;

  return {
    gridActual,
    gridReference: GRID_REFERENCE,
    stageCoefficient: 1 - 1 / gridActual + 1 / GRID_REFERENCE,
    gridSource: 'POINTS',
  };
}

export function computeIndexPoints(
  tandemPosition: number | null,
  qualPosition: number | null,
  stageCoefficient: number | null,
): number | null {
  if (stageCoefficient == null) return null;

  const place = tandemPosition ?? qualPosition;
  if (place == null || place < 1 || place > GRID_REFERENCE) return null;

  return (GRID_REFERENCE - place + 1) * stageCoefficient;
}

export async function refreshIndexPointsForEvent(
  prisma: PrismaClient,
  eventId: string,
  stageCoefficient: number | null,
): Promise<number> {
  const results = await prisma.eventResult.findMany({
    where: { eventId },
    select: { id: true, tandemPosition: true, qualPosition: true },
  });

  let updated = 0;
  for (const row of results) {
    const indexPoints = computeIndexPoints(
      row.tandemPosition,
      row.qualPosition,
      stageCoefficient,
    );
    await prisma.eventResult.update({
      where: { id: row.id },
      data: { indexPoints },
    });
    if (indexPoints != null) updated++;
  }

  return updated;
}

export async function refreshStageCoefficientForEvent(
  prisma: PrismaClient,
  eventId: string,
): Promise<StageCoefficientResult> {
  const results = await prisma.eventResult.findMany({
    where: { eventId },
    select: { qualPosition: true, qualPoints: true, points: true },
  });

  const computed = computeStageCoefficient(results);
  await prisma.event.update({
    where: { id: eventId },
    data: {
      gridActual: computed.gridActual,
      gridReference: computed.gridReference,
      stageCoefficient: computed.stageCoefficient,
      gridSource: computed.gridSource,
    },
  });

  await refreshIndexPointsForEvent(prisma, eventId, computed.stageCoefficient);

  return computed;
}

export async function refreshStageCoefficientsForSeason(
  prisma: PrismaClient,
  seasonId: string,
): Promise<number> {
  const events = await prisma.event.findMany({
    where: { seasonId, status: 'FINISHED' },
    select: { id: true },
  });

  for (const event of events) {
    await refreshStageCoefficientForEvent(prisma, event.id);
  }

  return events.length;
}

export async function refreshAllStageCoefficients(prisma: PrismaClient): Promise<number> {
  const events = await prisma.event.findMany({
    where: { status: 'FINISHED' },
    select: { id: true },
  });

  for (const event of events) {
    await refreshStageCoefficientForEvent(prisma, event.id);
  }

  return events.length;
}
