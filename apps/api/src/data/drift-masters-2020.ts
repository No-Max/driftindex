/**
 * DMEC 2020 — single "King of Riga" event (COVID-shortened season).
 * Qual: official dm.gp press release screenshots (Q1/Q2 best runs).
 * Grid order: RawMotion dmec2020 Top 32 seeding.
 * Tandem top 4: official race report (James Deane crowned King of Riga).
 */

export const DM_2020_SOURCE_URL =
  'https://www.driftmasters.gp/2020/08/14/dmec-king-of-riga-2020-qualifying-results/';

export const DM_2020_EVENT = {
  slug: 'dm-r1',
  roundNumber: 1,
  name: 'Round 1 — King of Riga',
  trackName: 'Bikernieki Trase, Riga',
  startsAt: '2020-08-14T09:00:00.000Z',
} as const;

/** Official Top 32 qual grid (RawMotion contest 1, Qualifying Top 32). */
const TOP32_GRID_BIBS = [
  215, 130, 59, 99, 29, 611, 601, 79, 80, 144, 42, 620, 61, 12, 609, 650, 229, 602, 93, 603, 96, 84,
  88, 600, 630, 55, 850, 604, 612, 66, 607, 41,
] as const;

/** Best Q1/Q2 run per bib (dm.gp qual results screenshots). */
const BEST_QUAL_SCORE: Record<number, number> = {
  215: 94,
  130: 92,
  59: 90,
  99: 87,
  29: 81,
  611: 80,
  601: 80,
  79: 79,
  80: 79,
  144: 77,
  42: 75,
  620: 75,
  61: 74,
  12: 74,
  609: 72,
  650: 72,
  229: 89,
  602: 88,
  93: 86,
  603: 85,
  96: 80,
  84: 73,
  88: 72,
  600: 72,
  630: 69,
  55: 68,
  850: 66,
  604: 65,
  612: 64,
  66: 63,
  607: 63,
  41: 52,
};

const DRIVER_BY_BIB: Record<number, string> = {
  215: 'Piotr Więcek',
  130: 'James Deane',
  59: 'Jack Shanahan',
  99: 'Grzegorz Hypki',
  29: 'Adam Zalewski',
  611: 'Gediminas Ivanauskas',
  601: 'Nikolass Bertans',
  79: 'Conor Shanahan',
  80: 'Kristaps Bluss',
  144: 'Jerome Vassia',
  42: 'Johannes Hountondji',
  620: 'Ivo Cirulis',
  61: 'Martin Richards',
  12: 'Orjan Nilsen',
  609: 'Harold Valdma',
  650: 'Aurimas Vaskelis',
  229: 'Elias Hountondji',
  602: 'Janis Bralitis',
  93: 'Benediktas Cirba',
  603: 'Diogo Correia',
  96: 'Victor Joensuu',
  84: 'Max Heidrich',
  88: 'Niko Mättälä',
  600: 'Ingemars Jekabsons',
  630: 'Mikkel Overgaard',
  55: 'Marco Zakouril',
  850: 'Michal Reichert',
  604: 'Janis Jurka',
  612: 'Oliver Randalu',
  66: 'Linus Joensuu',
  607: 'Kristjan Salmre',
  41: 'Joakim Andersson',
};

/** Verified tandem finishers (dm.gp final report). */
const TANDEM_FINISH: Record<string, { position: number; points: number }> = {
  'James Deane': { position: 1, points: 100 },
  'Piotr Więcek': { position: 2, points: 88 },
  'Jack Shanahan': { position: 3, points: 76 },
  'Adam Zalewski': { position: 4, points: 70 },
};

export interface Dm2020ResultRow {
  name: string;
  bib: number;
  qualPosition: number;
  qualScore100: number;
  tandemPosition: number | null;
  points: number;
}

export const DM_2020_RESULTS: Dm2020ResultRow[] = TOP32_GRID_BIBS.map((bib, index) => {
  const name = DRIVER_BY_BIB[bib]!;
  const tandem = TANDEM_FINISH[name];
  return {
    name,
    bib,
    qualPosition: index + 1,
    qualScore100: BEST_QUAL_SCORE[bib]!,
    tandemPosition: tandem?.position ?? null,
    points: tandem?.points ?? 0,
  };
});
