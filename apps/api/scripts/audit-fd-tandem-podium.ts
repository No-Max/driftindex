import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SERIES = 'formula-drift-pro';

async function main() {
  const seasons = await prisma.season.findMany({
    where: { series: { slug: SERIES } },
    orderBy: { year: 'asc' },
    include: {
      events: {
        where: { status: 'FINISHED' },
        orderBy: { roundNumber: 'asc' },
        include: { results: { select: { tandemPosition: true } } },
      },
    },
  });

  const missing: Array<{ year: number; round: number; slug: string; name: string; have: number[] }> = [];

  for (const season of seasons) {
    for (const event of season.events) {
      const places = new Set<number>();
      for (const r of event.results) {
        if (r.tandemPosition != null && r.tandemPosition >= 1 && r.tandemPosition <= 3) {
          places.add(r.tandemPosition);
        }
      }
      const have = [1, 2, 3].filter((p) => places.has(p));
      if (have.length < 3) {
        missing.push({
          year: season.year,
          round: event.roundNumber,
          slug: event.slug,
          name: event.name,
          have,
        });
      }
    }
  }

  const byYear = new Map<number, { total: number; full: number }>();
  for (const season of seasons) {
    let full = 0;
    for (const event of season.events) {
      const places = new Set<number>();
      for (const r of event.results) {
        if (r.tandemPosition != null && r.tandemPosition >= 1 && r.tandemPosition <= 3) {
          places.add(r.tandemPosition);
        }
      }
      if (places.size === 3) full += 1;
    }
    byYear.set(season.year, { total: season.events.length, full });
  }

  console.log(`Events missing full podium (P1–P3): ${missing.length}`);
  for (const year of [...byYear.keys()].sort()) {
    const stats = byYear.get(year)!;
    console.log(`  ${year}: ${stats.full}/${stats.total} events with P1–P3`);
  }
  for (const row of missing) {
    console.log(
      `${row.year} R${row.round} ${row.slug} have=[${row.have.join(',')}] ${row.name}`,
    );
  }

  await prisma.$disconnect();
}

main();
