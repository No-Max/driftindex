/**
 * Drift Kings 2026 Pro Series.
 *
 * Calendar: https://driftkings.com/dk26/
 * Round reviews: /dk2026rd1review/ … /dk2026rd3review/, /dk2026rd4/
 * Pro points (R1–R4): https://driftas.eu/drift-kings-2026-2/
 *
 * Winter Training (Serres, Feb) and Gonco Fest (Bulgaria) are not championship rounds.
 * Round 4 moved from Wałbrzych to Trackwood (reverse layout).
 *
 * Tandem places 1–3 are stored only when an official Pro review names the podium.
 * Round 4 has no labeled Pro podium, so tandemPosition is left null there.
 * Qualifying scores/positions are unknown and are not invented.
 */

export const DK_2026_SOURCE_URL = 'https://driftkings.com/dk26/';
export const DK_2026_STANDINGS_URL = 'https://driftas.eu/drift-kings-2026-2/';

export const DK_2026_EVENTS = [
  {
    slug: 'dk-r1',
    roundNumber: 1,
    name: 'Round 1 — Nürburgring',
    trackName: 'Nürburgring',
    country: 'DE',
    city: 'Nürburg',
    startsAt: '2026-04-24T09:00:00.000Z',
    status: 'FINISHED' as const,
    sourceUrl: 'https://driftkings.com/dk2026rd1review/',
  },
  {
    slug: 'dk-r2',
    roundNumber: 2,
    name: 'Round 2 — Anneau du Rhin',
    trackName: 'Anneau du Rhin',
    country: 'FR',
    city: 'Biltzheim',
    startsAt: '2026-06-12T09:00:00.000Z',
    status: 'FINISHED' as const,
    sourceUrl: 'https://driftkings.com/dk2026rd2review/',
  },
  {
    slug: 'dk-r3',
    roundNumber: 3,
    name: 'Round 3 — RabócsiRing',
    trackName: 'RabócsiRing',
    country: 'HU',
    city: 'Máriapócs',
    startsAt: '2026-07-11T09:00:00.000Z',
    status: 'FINISHED' as const,
    sourceUrl: 'https://driftkings.com/dk2026rd3review/',
  },
  {
    slug: 'dk-r4',
    roundNumber: 4,
    name: 'Round 4 — Trackwood',
    trackName: 'Trackwood',
    country: 'HU',
    city: 'Máriapócs',
    startsAt: '2026-08-28T09:00:00.000Z',
    status: 'FINISHED' as const,
    sourceUrl: 'https://driftkings.com/dk2026rd4/',
  },
  {
    slug: 'dk-r5',
    roundNumber: 5,
    name: 'Round 5 — Serres Racing Circuit',
    trackName: 'Serres Racing Circuit',
    country: 'GR',
    city: 'Serres',
    startsAt: '2026-10-02T09:00:00.000Z',
    status: 'SCHEDULED' as const,
    sourceUrl: DK_2026_SOURCE_URL,
  },
  {
    slug: 'dk-r6',
    roundNumber: 6,
    name: 'Round 6 — Grand Finale, Achna Speedway',
    trackName: 'Achna Speedway',
    country: 'CY',
    city: 'Achna',
    startsAt: '2026-10-16T09:00:00.000Z',
    status: 'SCHEDULED' as const,
    sourceUrl: DK_2026_SOURCE_URL,
  },
] as const;

/** Official Pro podiums from DK round reviews. Round 4 has none. */
export const DK_2026_PODIUMS: Record<number, readonly [string, string, string]> = {
  1: ['Andrius Vasiliauskas', 'Péter Porkoláb', 'Gediminas Levickas'],
  2: ['Logan Postigo', 'Sandra Janušauskaitė', 'Gediminas Levickas'],
  3: ['Patrik Cselőtei', 'Erik Lobmayer', 'Adrian Petricevic'],
};

export interface Dk2026Driver {
  name: string;
  aliases?: readonly string[];
  /** Championship points for R1–R4. Zero means the driver did not score that round. */
  points: readonly [number, number, number, number];
}

export const DK_2026_DRIVERS: readonly Dk2026Driver[] = [
  {
    name: 'Gediminas Levickas',
    aliases: ['Levickas Gediminas'],
    points: [110, 110, 110, 73],
  },
  {
    name: 'Erik Lobmayer',
    aliases: ['Lobmayer Erik'],
    points: [90, 76, 116, 60],
  },
  {
    name: 'Péter Porkoláb',
    aliases: ['Peter Porkolab', 'Porkolab Peter', 'Porkoláb Péter'],
    points: [112, 73, 73, 40],
  },
  {
    name: 'Sandra Janušauskaitė',
    aliases: ['Sandra Janusauskaite', 'Janusauskaite Sandra'],
    points: [40, 111, 40, 40],
  },
  {
    name: 'Patrik Cselőtei',
    aliases: ['Patrik Cselotei', 'Cselotei Patrik'],
    points: [0, 0, 130, 100],
  },
  {
    name: 'Adrian Petricevic',
    aliases: ['Petricevic Adrian'],
    points: [0, 0, 104, 118],
  },
  {
    name: 'Logan Postigo',
    aliases: ['Postigo Logan'],
    points: [0, 121, 51, 0],
  },
  {
    name: 'Valeri Moscovciuc',
    aliases: ['Moscovciuc Valeri'],
    points: [0, 40, 70, 40],
  },
  {
    name: 'Andrius Vasiliauskas',
    aliases: ['Vasiliauskas Andrius'],
    points: [128, 0, 0, 0],
  },
  {
    name: 'Mátyás Druzsin',
    aliases: ['Matyas Druzsin', 'Druzsin Matyas'],
    points: [0, 0, 78, 50],
  },
  {
    name: 'Gustas Valainis',
    aliases: ['Valainis Gustas'],
    points: [0, 0, 0, 126],
  },
  {
    name: 'Kevin Jozou',
    aliases: ['Jozou Kevin'],
    points: [0, 110, 0, 0],
  },
  {
    name: 'Uwe Sener',
    aliases: ['Sener Uwe'],
    points: [51, 51, 0, 0],
  },
  {
    name: 'Daniel Brandner',
    aliases: ['Brandner Daniel'],
    points: [0, 0, 0, 102],
  },
  {
    name: 'Rareș Gîrda',
    aliases: ['Rares Girda', 'Girda Rares'],
    points: [0, 0, 51, 50],
  },
  {
    name: 'Roene Zwanenburg',
    aliases: ['Zwanenburg Roene'],
    points: [96, 0, 0, 0],
  },
  {
    name: 'Markus Dokter',
    aliases: ['Dokter Markus'],
    points: [0, 0, 55, 40],
  },
  {
    name: 'Artur Havrylenko',
    aliases: ['Arthur Havrylenko', 'Havrylenko Artur'],
    points: [43, 0, 0, 50],
  },
  {
    name: 'Marcin Banowicz',
    aliases: ['Banowicz Marcin'],
    points: [0, 0, 72, 20],
  },
  {
    name: 'Tamás Magyar',
    aliases: ['Tamas Magyar', 'Magyar Tamas'],
    points: [0, 0, 51, 40],
  },
  {
    name: 'Dylan Mougenot',
    aliases: ['Mougenot Dylan'],
    points: [50, 40, 0, 0],
  },
  {
    name: 'Sacha Aleksic',
    aliases: ['Aleksic Sacha'],
    points: [40, 50, 0, 0],
  },
  {
    name: 'Csaba Cselőtei',
    aliases: ['Csaba Cselotei', 'Cselotei Csaba'],
    points: [0, 0, 40, 44],
  },
  {
    name: 'Enzo Surace',
    aliases: ['Surace Enzo'],
    points: [0, 78, 0, 0],
  },
  {
    name: 'Kordian Trela-Muchewicz',
    aliases: ['Trela-Muchewicz Kordian'],
    points: [0, 0, 0, 75],
  },
  {
    name: 'Michael Perrottet',
    aliases: ['Michael Perrotet', 'Perrottet Michael'],
    points: [0, 72, 0, 0],
  },
  {
    name: 'Manuel Schrimpf',
    aliases: ['Schrimpf Manuel'],
    points: [71, 0, 0, 0],
  },
  {
    name: 'Franz Kuncic',
    aliases: ['Kuncic Franz'],
    points: [0, 0, 0, 71],
  },
  {
    name: 'Jan Behrendt',
    aliases: ['Behrendt Jan'],
    points: [70, 0, 0, 0],
  },
  {
    name: 'Lars Visser',
    aliases: ['Visser Lars'],
    points: [70, 0, 0, 0],
  },
  {
    name: 'Vaclav Burian',
    aliases: ['Václav Burian', 'Burian Vaclav'],
    points: [0, 0, 0, 70],
  },
  {
    name: 'Roger Stöckli',
    aliases: ['Roger Stoeckli', 'Stockli Roger', 'Stöckli Roger'],
    points: [41, 20, 0, 0],
  },
  {
    name: 'Gregoire Du Pasquier',
    aliases: ['Grégoire Du Pasquier', 'Du Pasquier Gregoire'],
    points: [40, 20, 0, 0],
  },
  {
    name: 'Pieter Van Hoorick',
    aliases: ['Van Hoorick Pieter'],
    points: [20, 40, 0, 0],
  },
  {
    name: 'Vlad Stanescu',
    aliases: ['Vlad Stănescu', 'Stanescu Vlad'],
    points: [0, 0, 40, 20],
  },
  {
    name: 'Rafael Nagy',
    aliases: ['Rafael Nagi', 'Nagy Rafael'],
    points: [0, 0, 40, 20],
  },
  {
    name: 'Frederic Adam',
    aliases: ['Frédéric Adam', 'Adam Frederic'],
    points: [0, 55, 0, 0],
  },
  {
    name: 'Denise Ritzmann',
    aliases: ['Ritzmann Denise'],
    points: [54, 0, 0, 0],
  },
  {
    name: 'Cedric Latscha',
    aliases: ['Cédric Latscha', 'Latscha Cedric'],
    points: [0, 54, 0, 0],
  },
  {
    name: 'Niels Kos',
    aliases: ['Kos Niels'],
    points: [51, 0, 0, 0],
  },
  {
    name: 'Holger Kern',
    aliases: ['Kern Holger'],
    points: [51, 0, 0, 0],
  },
  {
    name: 'Severin Stoeckli',
    aliases: ['Severin Stöckli', 'Stoeckli Severin'],
    points: [0, 51, 0, 0],
  },
  {
    name: 'Luc Metz',
    aliases: ['Metz Luc'],
    points: [0, 51, 0, 0],
  },
  {
    name: 'Dylan Kaynak',
    aliases: ['Kaynak Dylan'],
    points: [0, 51, 0, 0],
  },
  {
    name: 'Nikola Ilic',
    aliases: ['Ilic Nikola'],
    points: [0, 0, 51, 0],
  },
  {
    name: 'Natalia Iocsak',
    aliases: ['Iocsak Natalia'],
    points: [0, 0, 51, 0],
  },
  {
    name: 'Jan Hejda',
    aliases: ['Hejda Jan'],
    points: [0, 0, 51, 0],
  },
  {
    name: 'Arnas Kazokevičius',
    aliases: ['Arnas Kazokevicius', 'Kazokevicius Arnas'],
    points: [0, 0, 51, 0],
  },
  {
    name: 'Viktor Andersson',
    aliases: ['Andersson Viktor'],
    points: [0, 0, 0, 51],
  },
  {
    name: 'Péter Révhelyi',
    aliases: ['Peter Revhelyi', 'Revhelyi Peter'],
    points: [0, 0, 0, 51],
  },
];

export interface Dk2026ResultRow {
  eventSlug: string;
  roundNumber: number;
  name: string;
  aliases: readonly string[];
  points: number;
  tandemPosition: number | null;
}

function podiumPlace(roundNumber: number, name: string): number | null {
  const podium = DK_2026_PODIUMS[roundNumber];
  if (!podium) return null;
  const index = podium.indexOf(name);
  return index >= 0 ? index + 1 : null;
}

export const DK_2026_RESULTS: Dk2026ResultRow[] = DK_2026_DRIVERS.flatMap((driver) =>
  driver.points.flatMap((points, index) => {
    if (points <= 0) return [];
    const roundNumber = index + 1;
    return [
      {
        eventSlug: `dk-r${roundNumber}`,
        roundNumber,
        name: driver.name,
        aliases: driver.aliases ?? [],
        points,
        tandemPosition: podiumPlace(roundNumber, driver.name),
      },
    ];
  }),
);

function assertPodiumDriversExist() {
  const names = new Set(DK_2026_DRIVERS.map((driver) => driver.name));
  for (const [round, podium] of Object.entries(DK_2026_PODIUMS)) {
    for (const name of podium) {
      if (!names.has(name)) {
        throw new Error(`DK 2026 podium driver missing from standings: R${round} ${name}`);
      }
    }
  }
}

assertPodiumDriversExist();
