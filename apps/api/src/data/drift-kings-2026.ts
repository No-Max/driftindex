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
 * Round 4 Pro tandem 1–4: drifting.hu Trackwood recap; full Top 32 battles/wins from live bracket.
 *
 * Qualifying is partial. Live scoring at drift.rs/dk.html is empty off-air and currently
 * holds a 3-driver "Test Race" sheet for Round 5 — that test data is not imported.
 * Full Pro grids were not archived. Known fragments:
 *   R1 Skylimit / ndriftcup / driftas.eu / drifting.hu
 *   R2 driftas.eu / tv3.lt
 *   R3 driftas.eu / sportas24 / tv3.lt / official R3 review
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

/** Labeled Pro tandem finishes. Round 4 includes 4th from the Trackwood recap. */
export const DK_2026_PODIUMS: Record<number, readonly string[]> = {
  1: ['Andrius Vasiliauskas', 'Péter Porkoláb', 'Gediminas Levickas'],
  2: ['Logan Postigo', 'Sandra Janušauskaitė', 'Gediminas Levickas'],
  3: ['Patrik Cselőtei', 'Erik Lobmayer', 'Adrian Petricevic'],
  4: ['Gustas Valainis', 'Adrian Petricevic', 'Daniel Brandner', 'Patrik Cselőtei'],
};

export interface Dk2026Quali {
  position: number;
  score: number | null;
  number?: number;
}

/**
 * Pro qualifying from Telegram live-scoring screenshots (screens/DK/_extracted/qualifying-curated.json).
 * R4 Hungary PRO: full 40-driver grid from Trackwood live-scoring (2026-09-15).
 */
export const DK_2026_QUALIFYING: Record<number, Record<string, Dk2026Quali>> = {
  1: {
    'Erik Lobmayer': { position: 1, score: 94 },
    'Gediminas Levickas': { position: 2, score: 91 },
    'Andrius Vasiliauskas': { position: 3, score: 89 },
    'Roene Zwanenburg': { position: 4, score: 89 },
    'Denise Ritzmann': { position: 6, score: 86 },
    'Artur Havrylenko': { position: 7, score: 85 },
    'Péter Porkoláb': { position: 8, score: 83 },
    'Roger Stöckli': { position: 10, score: 82 },
  },
  2: {
    'Kevin Jozou': { position: 1, score: 93 },
    'Gediminas Levickas': { position: 2, score: 93 },
    'Enzo Surace': { position: 3, score: 89 },
    'Erik Lobmayer': { position: 4, score: 88 },
    'Frederic Adam': { position: 5, score: 88 },
    'Cedric Latscha': { position: 6, score: 83 },
    'Péter Porkoláb': { position: 7, score: 83 },
    'Michael Perrottet': { position: 8, score: 82 },
    'Dylan Kaynak': { position: 9, score: 81 },
    'Logan Postigo': { position: 11, score: 79 },
    'Sandra Janušauskaitė': { position: 12, score: 78 },
    'Luc Metz': { position: 13, score: 78 },
    'Severin Stoeckli': { position: 14, score: 78 },
    'Uwe Sener': { position: 15, score: 74 },
    'Sacha Aleksic': { position: 17, score: 73 },
    'Valeri Moscovciuc': { position: 18, score: 73 },
    'Dylan Mougenot': { position: 20, score: 70 },
    'Pieter Van Hoorick': { position: 22, score: 64 },
  },
  3: {
    'Gediminas Levickas': { position: 1, score: 91.5 },
    'Patrik Cselőtei': { position: 2, score: 91 },
    'Mátyás Druzsin': { position: 3, score: 89.5 },
    'Erik Lobmayer': { position: 4, score: 88.5 },
    'Markus Dokter': { position: 5, score: 85.5 },
    'Adrian Petricevic': { position: 6, score: 85 },
    'Péter Porkoláb': { position: 7, score: 84.5 },
    'Marcin Banowicz': { position: 8, score: 84.5 },
    'Tamás Magyar': { position: 9, score: 84 },
    'Nikola Ilic': { position: 10, score: 81.5 },
    'Natalia Iocsak': { position: 11, score: 81 },
    'Rareș Gîrda': { position: 13, score: 80 },
    'Jan Hejda': { position: 14, score: 75.5 },
    'Arnas Kazokevičius': { position: 15, score: 74.5 },
    'Logan Postigo': { position: 16, score: 72.5 },
    'Vlad Stanescu': { position: 17, score: 70 },
    'Csaba Cselőtei': { position: 19, score: 67 },
    'Rafael Nagy': { position: 20, score: 66 },
    'Valeri Moscovciuc': { position: 21, score: 61 },
    'Sandra Janušauskaitė': { position: 22, score: 61 },
  },
  4: {
    'Erik Lobmayer': { position: 1, score: 92, number: 3 },
    'Patrik Cselőtei': { position: 2, score: 90, number: 80 },
    'Adrian Petricevic': { position: 3, score: 89.5, number: 114 },
    'Gustas Valainis': { position: 4, score: 88, number: 9 },
    'Kordian Trela-Muchewicz': { position: 5, score: 85.5, number: 112 },
    'Csaba Cselőtei': { position: 6, score: 85.5, number: 84 },
    'Gediminas Levickas': { position: 7, score: 85, number: 1 },
    'Daniel Brandner': { position: 8, score: 84.5, number: 83 },
    'Peter Brolli': { position: 9, score: 83.5, number: 88 },
    'Mattias Karlsson': { position: 10, score: 83, number: 120 },
    'Luca Alberici': { position: 11, score: 82, number: 89 },
    'Kane Pisani': { position: 12, score: 82, number: 79 },
    'Viktor Andersson': { position: 13, score: 80, number: 71 },
    'Péter Révhelyi': { position: 14, score: 80, number: 73 },
    'Bartosz Stolarski': { position: 15, score: 79.7, number: 77 },
    'Franz Kuncic': { position: 16, score: 78.5, number: 116 },
    'Markus Dokter': { position: 17, score: 77.5, number: 7 },
    'Filip Vimpel': { position: 18, score: 77, number: 72 },
    'Miklos Laszlo': { position: 19, score: 77, number: 81 },
    'Tamás Magyar': { position: 20, score: 76, number: 74 },
    'Dmitriy Illyuk': { position: 21, score: 75.5, number: 109 },
    'Vaclav Burian': { position: 22, score: 75, number: 115 },
    'Mátyás Druzsin': { position: 23, score: 75, number: 104 },
    'Artur Havrylenko': { position: 24, score: 75, number: 117 },
    'Valeri Moscovciuc': { position: 25, score: 74.5, number: 110 },
    'Augustinas Jankevičius': { position: 26, score: 74, number: 10 },
    'Rareș Gîrda': { position: 27, score: 73, number: 27 },
    'Călin Calota': { position: 28, score: 70, number: 17 },
    'Sandra Janušauskaitė': { position: 29, score: 70, number: 2 },
    'Péter Porkoláb': { position: 30, score: 69, number: 90 },
    'Sylvestras Bieliauskas': { position: 31, score: 67, number: 119 },
    'Claudiu Adam': { position: 32, score: 66.5, number: 85 },
    'Marcin Banowicz': { position: 33, score: 46, number: 76 },
    'Rafael Nagy': { position: 34, score: 0, number: 78 },
    'Vlad Stanescu': { position: 35, score: 0, number: 82 },
    'Orest Michalczuk': { position: 36, score: 0, number: 86 },
    'Lőrincz Nagyházi': { position: 37, score: 0, number: 87 },
    'Eva Nox': { position: 38, score: 0, number: 111 },
    'Lukáš Hamrák': { position: 39, score: 0, number: 113 },
    'Nikola Popov': { position: 40, score: 0, number: 118 },
  },
};

/** R4 qual-only drivers (no tandem bracket / no championship points). */
export const DK_2026_R4_QUAL_ONLY: readonly { name: string; aliases?: readonly string[] }[] = [
  { name: 'Orest Michalczuk' },
  { name: 'Lőrincz Nagyházi', aliases: ['Lorincz Nagyhazi'] },
  { name: 'Eva Nox' },
  { name: 'Lukáš Hamrák', aliases: ['Lukas Hamrak'] },
  { name: 'Nikola Popov' },
];

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

export interface Dk2026TandemRow {
  name: string;
  aliases?: readonly string[];
  number: number | null;
  tandemPosition: number | null;
  tandemWins: number;
  tandemBattles: number;
}

/** Round 4 Trackwood Top 32 bracket — Telegram live-scoring screenshot. */
export const DK_2026_R4_TANDEM: readonly Dk2026TandemRow[] = [
  { name: 'Gustas Valainis', number: 9, tandemPosition: 1, tandemWins: 5, tandemBattles: 5 },
  { name: 'Adrian Petricevic', number: 114, tandemPosition: 2, tandemWins: 4, tandemBattles: 5 },
  { name: 'Daniel Brandner', number: 83, tandemPosition: 3, tandemWins: 4, tandemBattles: 5 },
  { name: 'Patrik Cselőtei', number: 80, tandemPosition: 4, tandemWins: 3, tandemBattles: 5 },
  { name: 'Franz Kuncic', number: 116, tandemPosition: null, tandemWins: 2, tandemBattles: 3 },
  { name: 'Vaclav Burian', number: 115, tandemPosition: null, tandemWins: 2, tandemBattles: 3 },
  { name: 'Gediminas Levickas', number: 1, tandemPosition: null, tandemWins: 2, tandemBattles: 3 },
  { name: 'Kordian Trela-Muchewicz', number: 112, tandemPosition: null, tandemWins: 2, tandemBattles: 3 },
  { name: 'Claudiu Adam', number: 85, tandemPosition: null, tandemWins: 1, tandemBattles: 2 },
  { name: 'Artur Havrylenko', number: 117, tandemPosition: null, tandemWins: 1, tandemBattles: 2 },
  { name: 'Viktor Andersson', number: 71, tandemPosition: null, tandemWins: 1, tandemBattles: 2 },
  { name: 'Dmitriy Illyuk', aliases: ['Dmitri Ilyuk'], number: 109, tandemPosition: null, tandemWins: 1, tandemBattles: 2 },
  { name: 'Bartosz Stolarski', number: 77, tandemPosition: null, tandemWins: 1, tandemBattles: 2 },
  { name: 'Mátyás Druzsin', number: 104, tandemPosition: null, tandemWins: 1, tandemBattles: 2 },
  { name: 'Péter Révhelyi', aliases: ['Peter Revhelyi', 'Revhelyi Peter'], number: 73, tandemPosition: null, tandemWins: 1, tandemBattles: 2 },
  { name: 'Rareș Gîrda', number: 27, tandemPosition: null, tandemWins: 1, tandemBattles: 2 },
  { name: 'Erik Lobmayer', number: 3, tandemPosition: null, tandemWins: 0, tandemBattles: 1 },
  { name: 'Markus Dokter', number: 7, tandemPosition: null, tandemWins: 0, tandemBattles: 1 },
  { name: 'Valeri Moscovciuc', number: 110, tandemPosition: null, tandemWins: 0, tandemBattles: 1 },
  { name: 'Peter Brolli', number: 88, tandemPosition: null, tandemWins: 0, tandemBattles: 1 },
  { name: 'Sandra Janušauskaitė', number: 2, tandemPosition: null, tandemWins: 0, tandemBattles: 1 },
  { name: 'Tamás Magyar', number: 74, tandemPosition: null, tandemWins: 0, tandemBattles: 1 },
  { name: 'Călin Calota', aliases: ['Catalin Calota'], number: 17, tandemPosition: null, tandemWins: 0, tandemBattles: 1 },
  { name: 'Kane Pisani', number: 79, tandemPosition: null, tandemWins: 0, tandemBattles: 1 },
  { name: 'Sylvestras Bieliauskas', number: 119, tandemPosition: null, tandemWins: 0, tandemBattles: 1 },
  { name: 'Filip Vimpel', number: 72, tandemPosition: null, tandemWins: 0, tandemBattles: 1 },
  { name: 'Augustinas Jankevičius', number: 10, tandemPosition: null, tandemWins: 0, tandemBattles: 1 },
  { name: 'Mattias Karlsson', number: 120, tandemPosition: null, tandemWins: 0, tandemBattles: 1 },
  { name: 'Péter Porkoláb', number: 90, tandemPosition: null, tandemWins: 0, tandemBattles: 1 },
  { name: 'Miklos Laszlo', aliases: ['Miklós László'], number: 81, tandemPosition: null, tandemWins: 0, tandemBattles: 1 },
  { name: 'Csaba Cselőtei', number: 84, tandemPosition: null, tandemWins: 0, tandemBattles: 1 },
  { name: 'Luca Alberici', number: 89, tandemPosition: null, tandemWins: 0, tandemBattles: 1 },
];

const DK_2026_R4_TANDEM_BY_NAME = new Map(DK_2026_R4_TANDEM.map((row) => [row.name, row]));

export interface Dk2026ResultRow {
  eventSlug: string;
  roundNumber: number;
  name: string;
  aliases: readonly string[];
  points: number;
  number: number | null;
  tandemPosition: number | null;
  tandemWins: number | null;
  tandemBattles: number | null;
  qualPosition: number | null;
  qualScore100: number | null;
}

function podiumPlace(roundNumber: number, name: string): number | null {
  const podium = DK_2026_PODIUMS[roundNumber];
  if (!podium) return null;
  const index = podium.indexOf(name);
  return index >= 0 ? index + 1 : null;
}

function buildDk2026Results(): Dk2026ResultRow[] {
  const rows: Dk2026ResultRow[] = DK_2026_DRIVERS.flatMap((driver) =>
    driver.points.flatMap((points, index) => {
      if (points <= 0) return [];
      const roundNumber = index + 1;
      const r4Tandem = roundNumber === 4 ? DK_2026_R4_TANDEM_BY_NAME.get(driver.name) : undefined;
      const qual = DK_2026_QUALIFYING[roundNumber]?.[driver.name];
      return [
        {
          eventSlug: `dk-r${roundNumber}`,
          roundNumber,
          name: driver.name,
          aliases: driver.aliases ?? [],
          points,
          number: qual?.number ?? r4Tandem?.number ?? null,
          tandemPosition: r4Tandem?.tandemPosition ?? podiumPlace(roundNumber, driver.name),
          tandemWins: r4Tandem?.tandemWins ?? null,
          tandemBattles: r4Tandem?.tandemBattles ?? null,
          qualPosition: qual?.position ?? null,
          qualScore100: qual?.score ?? null,
        },
      ];
    }),
  );

  const r4Names = new Set(rows.filter((row) => row.roundNumber === 4).map((row) => row.name));
  for (const tandem of DK_2026_R4_TANDEM) {
    if (r4Names.has(tandem.name)) continue;
    const qual = DK_2026_QUALIFYING[4]?.[tandem.name];
    rows.push({
      eventSlug: 'dk-r4',
      roundNumber: 4,
      name: tandem.name,
      aliases: tandem.aliases ?? [],
      points: 0,
      number: qual?.number ?? tandem.number,
      tandemPosition: tandem.tandemPosition,
      tandemWins: tandem.tandemWins,
      tandemBattles: tandem.tandemBattles,
      qualPosition: qual?.position ?? null,
      qualScore100: qual?.score ?? null,
    });
    r4Names.add(tandem.name);
  }

  for (const entry of DK_2026_R4_QUAL_ONLY) {
    if (r4Names.has(entry.name)) continue;
    const qual = DK_2026_QUALIFYING[4]?.[entry.name];
    if (!qual) continue;
    rows.push({
      eventSlug: 'dk-r4',
      roundNumber: 4,
      name: entry.name,
      aliases: entry.aliases ?? [],
      points: 0,
      number: qual.number ?? null,
      tandemPosition: null,
      tandemWins: null,
      tandemBattles: null,
      qualPosition: qual.position,
      qualScore100: qual.score,
    });
  }

  return rows;
}

export const DK_2026_RESULTS: Dk2026ResultRow[] = buildDk2026Results();

function assertKnownDriversExist() {
  const driverNames = new Set(DK_2026_DRIVERS.map((driver) => driver.name));
  const resultNamesByRound = new Map<number, Set<string>>();
  for (const row of DK_2026_RESULTS) {
    const names = resultNamesByRound.get(row.roundNumber) ?? new Set<string>();
    names.add(row.name);
    resultNamesByRound.set(row.roundNumber, names);
  }

  for (const [round, podium] of Object.entries(DK_2026_PODIUMS)) {
    for (const name of podium) {
      if (!driverNames.has(name)) {
        throw new Error(`DK 2026 podium driver missing from standings: R${round} ${name}`);
      }
    }
  }
  for (const [round, quali] of Object.entries(DK_2026_QUALIFYING)) {
    const roundNumber = Number(round);
    const resultNames = resultNamesByRound.get(roundNumber) ?? new Set<string>();
    for (const name of Object.keys(quali)) {
      if (!resultNames.has(name)) {
        throw new Error(`DK 2026 qualifying driver missing from results: R${round} ${name}`);
      }
    }
  }
}

assertKnownDriversExist();
