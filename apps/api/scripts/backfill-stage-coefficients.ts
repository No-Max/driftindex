import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { refreshAllStageCoefficients } from '../src/lib/stageCoefficient.js';

const prisma = new PrismaClient();

async function main() {
  const count = await refreshAllStageCoefficients(prisma);
  console.log(`Updated stage coefficients for ${count} finished events.\n`);

  const events = await prisma.event.findMany({
    where: { status: 'FINISHED' },
    include: {
      track: true,
      season: { include: { series: true } },
    },
    orderBy: [
      { season: { series: { slug: 'asc' } } },
      { season: { year: 'asc' } },
      { roundNumber: 'asc' },
    ],
  });

  console.log('| Серия | Год | R | Этап | n | k | Источник |');
  console.log('| --- | ---: | ---: | --- | ---: | ---: | --- |');

  for (const event of events) {
    const label = event.track?.name || event.name;
    const shortLabel = label.length > 36 ? `${label.slice(0, 34)}...` : label;
    const k =
      event.stageCoefficient != null ? event.stageCoefficient.toFixed(4) : '—';
    const n = event.gridActual ?? '—';
    const source = event.gridSource ?? '—';
    console.log(
      `| ${event.season.series.slug} | ${event.season.year} | ${event.roundNumber} | ${shortLabel} | ${n} | ${k} | ${source} |`,
    );
  }

  const withCoef = events.filter((event) => event.stageCoefficient != null);
  const missing = events.length - withCoef.length;
  console.log(`\nSummary: ${withCoef.length} with coefficient, ${missing} without data`);

  const sampleResults = await prisma.eventResult.findMany({
    where: {
      indexPoints: { not: null },
      event: { status: 'FINISHED' },
    },
    include: {
      pilot: { select: { firstName: true, lastName: true } },
      event: {
        include: {
          track: true,
          season: { include: { series: true } },
        },
      },
    },
    orderBy: [{ indexPoints: 'desc' }],
    take: 20,
  });

  console.log('\n| Серия | Год | R | Пилот | Место | k | indexPoints |');
  console.log('| --- | ---: | ---: | --- | ---: | ---: | ---: |');
  for (const row of sampleResults) {
    const place = row.tandemPosition ?? row.qualPosition ?? '—';
    const k = row.event.stageCoefficient?.toFixed(4) ?? '—';
    const label = `${row.pilot.firstName} ${row.pilot.lastName}`;
    console.log(
      `| ${row.event.season.series.slug} | ${row.event.season.year} | ${row.event.roundNumber} | ${label} | ${place} | ${k} | ${row.indexPoints!.toFixed(2)} |`,
    );
  }

  const withIndex = await prisma.eventResult.count({ where: { indexPoints: { not: null } } });
  const withoutIndex = await prisma.eventResult.count({
    where: { indexPoints: null, event: { status: 'FINISHED' } },
  });
  console.log(`\nindexPoints: ${withIndex} set, ${withoutIndex} null`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
