import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FEATURED = [
  { slug: 'formula-drift-pro', nameEn: 'Formula Drift PRO', nameRu: 'Formula Drift PRO', country: 'US', order: 1, weight: 1.0 },
  { slug: 'drift-masters', nameEn: 'Drift Masters', nameRu: 'Drift Masters', country: 'EU', order: 2, weight: 1.15 },
  { slug: 'd1gp', nameEn: 'D1 Grand Prix', nameRu: 'D1 Grand Prix', country: 'JP', order: 3, weight: 1.1 },
  { slug: 'rds-gp', nameEn: 'RDS GP', nameRu: 'RDS GP', country: 'RU', order: 4, weight: 0.95 },
  { slug: 'royal-ds', nameEn: 'Royal Drift Series', nameRu: 'Royal Drift Series', country: 'CN', order: 5, weight: 0.9 },
  { slug: 'drift-kings', nameEn: 'Drift Kings', nameRu: 'Drift Kings', country: 'INT', order: 6, weight: 0.85 },
] as const;

const PILOTS = [
  { slug: 'james-deane', firstName: 'James', lastName: 'Deane', country: 'IE', number: 130 },
  { slug: 'conor-shanahan', firstName: 'Conor', lastName: 'Shanahan', country: 'IE', number: 79 },
  { slug: 'aurimas-bakchis', firstName: 'Aurimas', lastName: 'Bakchis', country: 'LT', number: 723 },
  { slug: 'branden-sorensen', firstName: 'Branden', lastName: 'Sorensen', country: 'US', number: 513 },
  { slug: 'fredric-aasbo', firstName: 'Fredric', lastName: 'Aasbo', country: 'NO', number: 151 },
  { slug: 'jack-shanahan', firstName: 'Jack', lastName: 'Shanahan', country: 'IE', number: 59 },
  { slug: 'vaughn-gittin-jr', firstName: 'Vaughn', lastName: 'Gittin Jr', country: 'US', number: 25 },
  { slug: 'pawel-filipczuk', firstName: 'Paweł', lastName: 'Filipczuk', country: 'PL', number: 88 },
  { slug: 'chris-papadakis', firstName: 'Chris', lastName: 'Papadakis', country: 'US', number: 33 },
  { slug: 'masashi-yokoi', firstName: 'Masashi', lastName: 'Yokoi', country: 'JP', number: 46 },
  { slug: 'daigo-saito', firstName: 'Daigo', lastName: 'Saito', country: 'JP', number: 86 },
  { slug: 'dmitry-ilyuk', firstName: 'Dmitry', lastName: 'Ilyuk', country: 'RU', number: 77 },
] as const;

async function upsertSeries() {
  const records = new Map<string, { id: string }>();
  for (const s of FEATURED) {
    const row = await prisma.series.upsert({
      where: { slug: s.slug },
      update: { featuredOrder: s.order, defaultWeight: s.weight },
      create: {
        slug: s.slug,
        nameEn: s.nameEn,
        nameRu: s.nameRu,
        country: s.country,
        featuredOrder: s.order,
        defaultWeight: s.weight,
      },
    });
    records.set(s.slug, row);
    await prisma.seriesWeight.upsert({
      where: { seriesId_year: { seriesId: row.id, year: 2026 } },
      update: { weight: s.weight },
      create: { seriesId: row.id, year: 2026, weight: s.weight },
    });
  }
  return records;
}

async function upsertPilots() {
  const records = new Map<string, { id: string }>();
  for (const p of PILOTS) {
    records.set(p.slug, await prisma.pilot.upsert({
      where: { slug: p.slug },
      update: {},
      create: p,
    }));
  }
  return records;
}

type ResultRow = {
  pilotSlug: string;
  qual: number | null;
  qualPoints: number | null;
  tandem: number | null;
  points: number;
};

async function seedSeason(
  seriesId: string,
  seriesSlug: string,
  pilots: Map<string, { id: string }>,
  events: Array<{
    slug: string;
    round: number;
    nameEn: string;
    nameRu: string;
    trackEn: string;
    startsAt: string;
    status: 'FINISHED' | 'SCHEDULED';
    results?: ResultRow[];
  }>,
) {
  const season = await prisma.season.upsert({
    where: { seriesId_year: { seriesId, year: 2026 } },
    update: {},
    create: {
      seriesId,
      year: 2026,
      nameEn: '2026 Championship',
      nameRu: 'Чемпионат 2026',
      sourceLabelEn: `${seriesSlug} — official standings`,
      sourceLabelRu: `${seriesSlug} — официальные standings`,
      sourceUrl: null,
    },
  });

  for (const e of events) {
    const event = await prisma.event.upsert({
      where: { seasonId_slug: { seasonId: season.id, slug: e.slug } },
      update: { status: e.status, startsAt: new Date(e.startsAt) },
      create: {
        seasonId: season.id,
        slug: e.slug,
        roundNumber: e.round,
        nameEn: e.nameEn,
        nameRu: e.nameRu,
        trackEn: e.trackEn,
        trackRu: e.nameRu,
        startsAt: new Date(e.startsAt),
        status: e.status,
      },
    });

    for (const r of e.results ?? []) {
      const pilot = pilots.get(r.pilotSlug);
      if (!pilot) continue;
      await prisma.eventResult.upsert({
        where: { eventId_pilotId: { eventId: event.id, pilotId: pilot.id } },
        update: {
          qualPosition: r.qual,
          qualPoints: r.qualPoints,
          tandemPosition: r.tandem,
          points: r.points,
        },
        create: {
          eventId: event.id,
          pilotId: pilot.id,
          qualPosition: r.qual,
          qualPoints: r.qualPoints,
          tandemPosition: r.tandem,
          points: r.points,
        },
      });
    }
  }
}

async function main() {
  const series = await upsertSeries();
  const pilots = await upsertPilots();

  await seedSeason(series.get('formula-drift-pro')!.id, 'formula-drift-pro', pilots, [
    {
      slug: 'long-beach', round: 1, nameEn: 'Long Beach', nameRu: 'Лонг-Бич', trackEn: 'Long Beach', startsAt: '2026-04-05T18:00:00Z', status: 'FINISHED',
      results: [
        { pilotSlug: 'conor-shanahan', qual: 1, qualPoints: 98.4, tandem: 50, points: 51 },
        { pilotSlug: 'fredric-aasbo', qual: 2, qualPoints: 97.1, tandem: 40, points: 41 },
        { pilotSlug: 'jack-shanahan', qual: 3, qualPoints: 96.2, tandem: 30, points: 33 },
        { pilotSlug: 'james-deane', qual: 4, qualPoints: 95.0, tandem: 10, points: 14 },
        { pilotSlug: 'aurimas-bakchis', qual: 5, qualPoints: 94.3, tandem: 20, points: 21 },
        { pilotSlug: 'branden-sorensen', qual: 6, qualPoints: 93.8, tandem: 20, points: 21 },
        { pilotSlug: 'vaughn-gittin-jr', qual: 7, qualPoints: 90.0, tandem: null, points: 0 },
      ],
    },
    {
      slug: 'atlanta', round: 2, nameEn: 'Atlanta', nameRu: 'Атланта', trackEn: 'Road Atlanta', startsAt: '2026-05-10T17:00:00Z', status: 'FINISHED',
      results: [
        { pilotSlug: 'james-deane', qual: 1, qualPoints: 99.1, tandem: 40, points: 43 },
        { pilotSlug: 'branden-sorensen', qual: 2, qualPoints: 97.5, tandem: 30, points: 32 },
        { pilotSlug: 'conor-shanahan', qual: 3, qualPoints: 96.8, tandem: 20, points: 21 },
        { pilotSlug: 'aurimas-bakchis', qual: 4, qualPoints: 95.9, tandem: 30, points: 34 },
        { pilotSlug: 'jack-shanahan', qual: 5, qualPoints: 94.2, tandem: 10, points: 11 },
        { pilotSlug: 'fredric-aasbo', qual: 6, qualPoints: 93.0, tandem: 0, points: 1 },
        { pilotSlug: 'vaughn-gittin-jr', qual: 7, qualPoints: 91.0, tandem: null, points: 0 },
      ],
    },
    {
      slug: 'orlando', round: 3, nameEn: 'Orlando', nameRu: 'Орландо', trackEn: 'Orlando Speed World', startsAt: '2026-06-14T16:00:00Z', status: 'FINISHED',
      results: [
        { pilotSlug: 'aurimas-bakchis', qual: 1, qualPoints: 98.7, tandem: 50, points: 51 },
        { pilotSlug: 'fredric-aasbo', qual: 2, qualPoints: 97.3, tandem: 30, points: 32 },
        { pilotSlug: 'jack-shanahan', qual: 3, qualPoints: 96.1, tandem: 20, points: 21 },
        { pilotSlug: 'james-deane', qual: 4, qualPoints: 95.4, tandem: 10, points: 14 },
        { pilotSlug: 'branden-sorensen', qual: 5, qualPoints: 94.0, tandem: 30, points: 31 },
        { pilotSlug: 'conor-shanahan', qual: 6, qualPoints: 93.2, tandem: 0, points: 1 },
        { pilotSlug: 'vaughn-gittin-jr', qual: 7, qualPoints: 90.5, tandem: null, points: 0 },
      ],
    },
    {
      slug: 'stafford', round: 4, nameEn: 'Stafford', nameRu: 'Стафорд', trackEn: 'Stafford Speedway', startsAt: '2026-07-19T17:00:00Z', status: 'FINISHED',
      results: [
        { pilotSlug: 'jack-shanahan', qual: 1, qualPoints: 99.0, tandem: 40, points: 41 },
        { pilotSlug: 'james-deane', qual: 2, qualPoints: 97.8, tandem: 10, points: 14 },
        { pilotSlug: 'aurimas-bakchis', qual: 3, qualPoints: 96.5, tandem: 20, points: 21 },
        { pilotSlug: 'branden-sorensen', qual: 4, qualPoints: 95.7, tandem: 20, points: 21 },
        { pilotSlug: 'fredric-aasbo', qual: 5, qualPoints: 94.4, tandem: 10, points: 11 },
        { pilotSlug: 'conor-shanahan', qual: 6, qualPoints: 93.1, tandem: 0, points: 1 },
        { pilotSlug: 'vaughn-gittin-jr', qual: 7, qualPoints: 92.0, tandem: 10, points: 51 },
      ],
    },
    { slug: 'seattle', round: 5, nameEn: 'Seattle', nameRu: 'Сиэтл', trackEn: 'Evergreen Speedway', startsAt: '2026-08-23T18:00:00Z', status: 'SCHEDULED' },
    { slug: 'irwindale', round: 6, nameEn: 'Irwindale', nameRu: 'Ируиндейл', trackEn: 'Irwindale Speedway', startsAt: '2026-10-04T19:00:00Z', status: 'SCHEDULED' },
  ]);

  await seedSeason(series.get('drift-masters')!.id, 'drift-masters', pilots, [
    {
      slug: 'riga', round: 1, nameEn: 'Riga', nameRu: 'Рига', trackEn: 'Biķernieki', startsAt: '2026-05-24T14:00:00Z', status: 'FINISHED',
      results: [
        { pilotSlug: 'pawel-filipczuk', qual: 1, qualPoints: 97.2, tandem: 50, points: 51 },
        { pilotSlug: 'conor-shanahan', qual: 2, qualPoints: 96.0, tandem: 40, points: 41 },
        { pilotSlug: 'james-deane', qual: 3, qualPoints: 95.1, tandem: 30, points: 31 },
        { pilotSlug: 'jack-shanahan', qual: 4, qualPoints: 94.0, tandem: 20, points: 21 },
      ],
    },
    {
      slug: 'gdansk', round: 2, nameEn: 'Gdańsk', nameRu: 'Гданьск', trackEn: 'Ergo Arena', startsAt: '2026-07-06T14:00:00Z', status: 'FINISHED',
      results: [
        { pilotSlug: 'conor-shanahan', qual: 1, qualPoints: 98.0, tandem: 50, points: 51 },
        { pilotSlug: 'pawel-filipczuk', qual: 2, qualPoints: 96.5, tandem: 40, points: 41 },
        { pilotSlug: 'james-deane', qual: 3, qualPoints: 95.0, tandem: 10, points: 11 },
        { pilotSlug: 'jack-shanahan', qual: 4, qualPoints: 94.2, tandem: 30, points: 31 },
      ],
    },
    {
      slug: 'brno', round: 3, nameEn: 'Brno', nameRu: 'Брно', trackEn: 'Automotodrom Brno', startsAt: '2026-09-07T14:00:00Z', status: 'FINISHED',
      results: [
        { pilotSlug: 'pawel-filipczuk', qual: 1, qualPoints: 99.2, tandem: 40, points: 41 },
        { pilotSlug: 'james-deane', qual: 2, qualPoints: 97.0, tandem: 20, points: 21 },
        { pilotSlug: 'conor-shanahan', qual: 3, qualPoints: 96.3, tandem: 30, points: 31 },
        { pilotSlug: 'jack-shanahan', qual: 4, qualPoints: 95.5, tandem: 10, points: 11 },
      ],
    },
    { slug: 'tallinn', round: 4, nameEn: 'Tallinn', nameRu: 'Таллин', trackEn: 'Tallinn Karting', startsAt: '2026-10-18T14:00:00Z', status: 'SCHEDULED' },
  ]);

  await seedSeason(series.get('d1gp')!.id, 'd1gp', pilots, [
    {
      slug: 'okayama', round: 1, nameEn: 'Okayama', nameRu: 'Окаяма', trackEn: 'Okayama Intl Circuit', startsAt: '2026-04-12T08:00:00Z', status: 'FINISHED',
      results: [
        { pilotSlug: 'masashi-yokoi', qual: 1, qualPoints: 100.0, tandem: 50, points: 51 },
        { pilotSlug: 'daigo-saito', qual: 2, qualPoints: 98.5, tandem: 40, points: 41 },
        { pilotSlug: 'fredric-aasbo', qual: 3, qualPoints: 96.0, tandem: 30, points: 31 },
      ],
    },
    {
      slug: 'autopolis', round: 2, nameEn: 'Autopolis', nameRu: 'Автопolis', trackEn: 'Autopolis', startsAt: '2026-07-20T08:00:00Z', status: 'FINISHED',
      results: [
        { pilotSlug: 'daigo-saito', qual: 1, qualPoints: 99.5, tandem: 50, points: 51 },
        { pilotSlug: 'masashi-yokoi', qual: 2, qualPoints: 97.8, tandem: 40, points: 41 },
        { pilotSlug: 'fredric-aasbo', qual: 3, qualPoints: 95.2, tandem: 20, points: 21 },
      ],
    },
    { slug: 'fuji', round: 3, nameEn: 'Fuji', nameRu: 'Фудзи', trackEn: 'Fuji Speedway', startsAt: '2026-11-02T08:00:00Z', status: 'SCHEDULED' },
  ]);

  await seedSeason(series.get('rds-gp')!.id, 'rds-gp', pilots, [
    {
      slug: 'moscow', round: 1, nameEn: 'Moscow', nameRu: 'Москва', trackEn: 'RDS Moscow', startsAt: '2026-06-01T12:00:00Z', status: 'FINISHED',
      results: [
        { pilotSlug: 'dmitry-ilyuk', qual: 1, qualPoints: 96.8, tandem: 50, points: 51 },
        { pilotSlug: 'james-deane', qual: 2, qualPoints: 95.5, tandem: 40, points: 41 },
        { pilotSlug: 'conor-shanahan', qual: 3, qualPoints: 94.0, tandem: 30, points: 31 },
      ],
    },
    {
      slug: 'sochi', round: 2, nameEn: 'Sochi', nameRu: 'Сочи', trackEn: 'Sochi Autodrom', startsAt: '2026-09-14T12:00:00Z', status: 'FINISHED',
      results: [
        { pilotSlug: 'dmitry-ilyuk', qual: 1, qualPoints: 97.5, tandem: 50, points: 51 },
        { pilotSlug: 'conor-shanahan', qual: 2, qualPoints: 96.0, tandem: 40, points: 41 },
        { pilotSlug: 'james-deane', qual: 3, qualPoints: 94.8, tandem: 20, points: 21 },
      ],
    },
    { slug: 'kazan', round: 3, nameEn: 'Kazan', nameRu: 'Казань', trackEn: 'Kazan Ring', startsAt: '2026-11-09T12:00:00Z', status: 'SCHEDULED' },
  ]);

  await seedSeason(series.get('royal-ds')!.id, 'royal-ds', pilots, [
    {
      slug: 'shanghai', round: 1, nameEn: 'Shanghai', nameRu: 'Шанхай', trackEn: 'Shanghai Intl Circuit', startsAt: '2026-05-03T06:00:00Z', status: 'FINISHED',
      results: [
        { pilotSlug: 'chris-papadakis', qual: 1, qualPoints: 95.0, tandem: 50, points: 51 },
        { pilotSlug: 'branden-sorensen', qual: 2, qualPoints: 93.5, tandem: 40, points: 41 },
        { pilotSlug: 'vaughn-gittin-jr', qual: 3, qualPoints: 92.0, tandem: 30, points: 31 },
      ],
    },
    { slug: 'chengdu', round: 2, nameEn: 'Chengdu', nameRu: 'Чэнду', trackEn: 'Chengdu Circuit', startsAt: '2026-08-30T06:00:00Z', status: 'SCHEDULED' },
  ]);

  await seedSeason(series.get('drift-kings')!.id, 'drift-kings', pilots, [
    {
      slug: 'istanbul', round: 1, nameEn: 'Istanbul', nameRu: 'Стамбул', trackEn: 'Ataturk Olympic Stadium', startsAt: '2026-06-28T15:00:00Z', status: 'FINISHED',
      results: [
        { pilotSlug: 'aurimas-bakchis', qual: 1, qualPoints: 96.0, tandem: 50, points: 51 },
        { pilotSlug: 'pawel-filipczuk', qual: 2, qualPoints: 94.5, tandem: 40, points: 41 },
        { pilotSlug: 'jack-shanahan', qual: 3, qualPoints: 93.0, tandem: 30, points: 31 },
      ],
    },
    { slug: 'dubai', round: 2, nameEn: 'Dubai', nameRu: 'Дубай', trackEn: 'Dubai Autodrome', startsAt: '2026-12-06T14:00:00Z', status: 'SCHEDULED' },
  ]);

  console.log('Seed complete: 6 featured series, 2026 seasons');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
