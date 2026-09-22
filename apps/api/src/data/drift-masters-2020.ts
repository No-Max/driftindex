/**
 * DMEC 2020 — single "King of Riga" event (COVID-shortened season).
 * Tandem: drift.news final classification (all 32).
 * Qual scores: dm.gp press release + RawMotion Q1/Q2 best runs.
 * Bibs: RawMotion entry / Top 32 grid.
 */

export const DM_2020_SOURCE_URL =
  'https://www.driftmasters.gp/2020/08/14/dmec-king-of-riga-2020-qualifying-results/';

export const DM_2020_RESULTS_SOURCE_URL = 'https://drift.news/dmec-2020/';

export const DM_2020_RAWMOTION_EVENT_ID = 'a50a8291-dbe3-11ea-9f2a-4501e44f4496';

export const DM_2020_EVENT = {
  slug: 'dm-r1',
  roundNumber: 1,
  name: 'Round 1 — King of Riga',
  trackName: 'Biķernieki Circuit',
  startsAt: '2020-08-14T09:00:00.000Z',
} as const;

/** Start numbers (RawMotion / entry list). */
export const DM_2020_BIB_BY_NAME: Record<string, number> = {
  'Piotr Więcek': 215,
  'James Deane': 130,
  'Jack Shanahan': 59,
  'Grzegorz Hypki': 99,
  'Adam Zalewski': 29,
  'Gediminas Ivanauskas': 611,
  'Nikolass Bertans': 601,
  'Conor Shanahan': 79,
  'Kristaps Bluss': 80,
  'Jérôme Vassia': 144,
  'Johannes Hountondji': 42,
  'Ivo Cirulis': 620,
  'Martin Richards': 61,
  'Orjan Nilsen': 12,
  'Harold Valdma': 609,
  'Aurimas Vaskelis': 650,
  'Elias Hountondji': 229,
  'Janis Bralitis': 602,
  'Benediktas Cirba': 93,
  'Diogo Correia': 603,
  'Victor Joensuu': 96,
  'Max Heidrich': 84,
  'Niko Mättälä': 88,
  'Ingemars Jekabsons': 600,
  'Mikkel Overgaard': 630,
  'Marco Zakouřil': 55,
  'Michal Reichert': 850,
  'Janis Jurka': 604,
  'Oliver Randalu': 612,
  'Linus Joensuu': 66,
  'Kristjan Salmre': 607,
  'Joakim Andersson': 41,
  'Wojciech Goździewicz': 77,
  'Manuel Vacca': 19,
  'Marcel Uhlig': 33,
  'Axel Francois': 10,
  'Christian Erlandsson': 68,
};

/** Championship battle points (single-event season). */
const TANDEM_POINTS: Record<number, number> = {
  1: 100,
  2: 88,
  3: 76,
  4: 70,
};

/** Final tandem order + qual best (drift.news, Aug 2020). */
const DM_2020_FINAL: Array<{
  tandemPosition: number;
  name: string;
  country: string;
  qualScore100: number;
}> = [
  { tandemPosition: 1, name: 'James Deane', country: 'IE', qualScore100: 92 },
  { tandemPosition: 2, name: 'Piotr Więcek', country: 'PL', qualScore100: 94 },
  { tandemPosition: 3, name: 'Jack Shanahan', country: 'IE', qualScore100: 90 },
  { tandemPosition: 4, name: 'Adam Zalewski', country: 'PL', qualScore100: 81 },
  { tandemPosition: 5, name: 'Kristaps Bluss', country: 'LV', qualScore100: 79 },
  { tandemPosition: 6, name: 'Martin Richards', country: 'GB', qualScore100: 74 },
  { tandemPosition: 7, name: 'Marco Zakouřil', country: 'CZ', qualScore100: 68 },
  { tandemPosition: 8, name: 'Michal Reichert', country: 'CZ', qualScore100: 66 },
  { tandemPosition: 9, name: 'Grzegorz Hypki', country: 'PL', qualScore100: 87 },
  { tandemPosition: 10, name: 'Ivo Cirulis', country: 'LV', qualScore100: 75 },
  { tandemPosition: 11, name: 'Harold Valdma', country: 'EE', qualScore100: 72 },
  { tandemPosition: 12, name: 'Elias Hountondji', country: 'DE', qualScore100: 89 },
  { tandemPosition: 13, name: 'Benediktas Cirba', country: 'LT', qualScore100: 86 },
  { tandemPosition: 14, name: 'Max Heidrich', country: 'DE', qualScore100: 73 },
  { tandemPosition: 15, name: 'Niko Mättälä', country: 'FI', qualScore100: 72 },
  { tandemPosition: 16, name: 'Mikkel Overgaard', country: 'DK', qualScore100: 69 },
  { tandemPosition: 17, name: 'Gediminas Ivanauskas', country: 'LT', qualScore100: 80 },
  { tandemPosition: 18, name: 'Nikolass Bertans', country: 'LV', qualScore100: 80 },
  { tandemPosition: 19, name: 'Conor Shanahan', country: 'IE', qualScore100: 79 },
  { tandemPosition: 20, name: 'Jérôme Vassia', country: 'FR', qualScore100: 77 },
  { tandemPosition: 21, name: 'Johannes Hountondji', country: 'DE', qualScore100: 75 },
  { tandemPosition: 22, name: 'Orjan Nilsen', country: 'NO', qualScore100: 74 },
  { tandemPosition: 23, name: 'Aurimas Vaskelis', country: 'LT', qualScore100: 72 },
  { tandemPosition: 24, name: 'Janis Bralitis', country: 'LV', qualScore100: 88 },
  { tandemPosition: 25, name: 'Diogo Correia', country: 'PT', qualScore100: 85 },
  { tandemPosition: 26, name: 'Victor Joensuu', country: 'SE', qualScore100: 80 },
  { tandemPosition: 27, name: 'Ingemars Jekabsons', country: 'LV', qualScore100: 72 },
  { tandemPosition: 28, name: 'Janis Jurka', country: 'LV', qualScore100: 65 },
  { tandemPosition: 29, name: 'Oliver Randalu', country: 'EE', qualScore100: 64 },
  { tandemPosition: 30, name: 'Linus Joensuu', country: 'SE', qualScore100: 63 },
  { tandemPosition: 31, name: 'Kristjan Salmre', country: 'EE', qualScore100: 63 },
  { tandemPosition: 32, name: 'Joakim Andersson', country: 'SE', qualScore100: 52 },
];

/** Ran qualifying but missed Top 32 (RawMotion Q1/Q2, bib known). */
const DM_2020_QUAL_ONLY: Array<{ name: string; country: string; bib: number; qualScore100: number }> =
  [{ name: 'Wojciech Goździewicz', country: 'PL', bib: 77, qualScore100: 52 }];

export interface Dm2020ResultRow {
  name: string;
  country: string;
  bib: number;
  qualPosition: number;
  qualScore100: number;
  tandemPosition: number | null;
  points: number;
}

function assignQualPositions(
  rows: Array<{ qualScore100: number; qualPosition: number }>,
): void {
  const sorted = [...rows].sort((a, b) => b.qualScore100 - a.qualScore100);
  for (let index = 0; index < sorted.length; index++) {
    sorted[index]!.qualPosition = index + 1;
  }
}

function buildDm2020Results(): Dm2020ResultRow[] {
  const rows: Dm2020ResultRow[] = [];

  for (const row of DM_2020_FINAL) {
    const bib = DM_2020_BIB_BY_NAME[row.name];
    if (bib == null) {
      throw new Error(`Missing bib for ${row.name}`);
    }
    rows.push({
      name: row.name,
      country: row.country,
      bib,
      qualScore100: row.qualScore100,
      qualPosition: 0,
      tandemPosition: row.tandemPosition,
      points: TANDEM_POINTS[row.tandemPosition] ?? 0,
    });
  }

  for (const row of DM_2020_QUAL_ONLY) {
    rows.push({
      name: row.name,
      country: row.country,
      bib: row.bib,
      qualScore100: row.qualScore100,
      qualPosition: 0,
      tandemPosition: null,
      points: 0,
    });
  }

  assignQualPositions(rows);
  return rows;
}

export const DM_2020_RESULTS: Dm2020ResultRow[] = buildDm2020Results();
