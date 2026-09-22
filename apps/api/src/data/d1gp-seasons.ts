export interface D1gpSeasonConfig {
  year: number;
  rankingUrl: string;
  categoryBase: string;
  categorySlugs: string[];
  /** Optional driver portrait page (2026+). */
  driversIntroUrl?: string;
  /** Round → ISO start when ranking page has no GP nav dates. */
  roundStartsAt?: Record<number, string>;
  /** Round → track when ranking meta does not match actual calendar (e.g. 2021). */
  roundTrackNames?: Record<number, string>;
  /** Round → report URL (e.g. Wayback legacy 03_sche pages). */
  legacyReportUrls?: Record<number, string>;
}

function utcEventDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day, 9)).toISOString();
}

export const D1GP_SEASONS: D1gpSeasonConfig[] = [
  {
    year: 2018,
    rankingUrl: 'https://www.d1gp.co.jp/04_rank/rk2018.html',
    categoryBase: 'https://d1gp.co.jp/category/gp/2018gp/',
    categorySlugs: [],
    roundStartsAt: {
      1: utcEventDate(2018, 3, 31),
      2: utcEventDate(2018, 4, 1),
      3: utcEventDate(2018, 4, 14),
      4: utcEventDate(2018, 6, 9),
      5: utcEventDate(2018, 7, 21),
      6: utcEventDate(2018, 8, 25),
      7: utcEventDate(2018, 8, 26),
      8: utcEventDate(2018, 11, 3),
    },
    roundTrackNames: {
      1: 'Maishima Sports Island',
      2: 'Maishima Sports Island',
      3: 'Autopolis',
      4: 'Tokachi International Speedway',
      5: 'Tsukuba Circuit',
      6: 'Ebisu Circuit',
      7: 'Ebisu Circuit',
      8: 'Odaiba, Tokyo Bay',
    },
    legacyReportUrls: {
      1: 'https://web.archive.org/web/20180403051549/http://d1gp.co.jp/03_sche/2018/gp1801/gp1801_repo.html',
      2: 'https://web.archive.org/web/20180403051638/http://d1gp.co.jp/03_sche/2018/gp1801/gp1802_repo.html',
      3: 'https://web.archive.org/web/20180419090029/http://www.d1gp.co.jp/03_sche/2018/gp1803/gp1803_repo.html',
      4: 'https://web.archive.org/web/20180613161232/http://d1gp.co.jp/03_sche/2018/gp1804/gp1804_repo.html',
      5: 'https://web.archive.org/web/20180722155441/http://www.d1gp.co.jp/03_sche/2018/gp1805/gp1805_repo.html',
      6: 'https://web.archive.org/web/20180826214410/http://d1gp.co.jp/03_sche/2018/gp1806/gp1806_repo.html',
      7: 'https://web.archive.org/web/20180829202902/http://www.d1gp.co.jp/03_sche/2018/gp1806/gp1807_repo.html',
      8: 'https://web.archive.org/web/20181106171712/http://d1gp.co.jp/03_sche/2018/gp1808/gp1808_repo.html',
    },
  },
  {
    year: 2017,
    rankingUrl: 'https://www.d1gp.co.jp/04_rank/rk2017.html',
    categoryBase: 'https://d1gp.co.jp/category/gp/2017gp/',
    categorySlugs: [],
    roundStartsAt: {
      1: utcEventDate(2017, 4, 1),
      2: utcEventDate(2017, 4, 2),
      3: utcEventDate(2017, 6, 24),
      4: utcEventDate(2017, 7, 23),
      5: utcEventDate(2017, 8, 19),
      6: utcEventDate(2017, 8, 20),
      7: utcEventDate(2017, 10, 7),
    },
    roundTrackNames: {
      1: 'Odaiba, Tokyo Bay',
      2: 'Odaiba, Tokyo Bay',
      3: 'Tsukuba Circuit',
      4: 'Maishima Sports Island',
      5: 'Ebisu Circuit',
      6: 'Ebisu Circuit',
      7: 'Odaiba, Tokyo Bay',
    },
  },
  {
    year: 2019,
    rankingUrl: 'https://www.d1gp.co.jp/04_rank/rk2019.html',
    categoryBase: 'https://d1gp.co.jp/category/gp/2019gp/',
    categorySlugs: [],
    roundStartsAt: {
      1: utcEventDate(2019, 6, 29),
      2: utcEventDate(2019, 6, 30),
      3: utcEventDate(2019, 7, 27),
      4: utcEventDate(2019, 7, 28),
      5: utcEventDate(2019, 8, 24),
      6: utcEventDate(2019, 8, 25),
      7: utcEventDate(2019, 11, 3),
    },
    roundTrackNames: {
      1: 'Tsukuba Circuit',
      2: 'Tsukuba Circuit',
      3: 'Tokachi International Speedway',
      4: 'Tokachi International Speedway',
      5: 'Ebisu Circuit',
      6: 'Ebisu Circuit',
      7: 'Autopolis',
    },
    legacyReportUrls: {
      1: 'https://web.archive.org/web/20191120030201/https://www.d1gp.co.jp/03_sche/2019/gp1901/gp1901_repo.html',
      2: 'https://web.archive.org/web/20191120030201/https://www.d1gp.co.jp/03_sche/2019/gp1901/gp1902_repo.html',
      3: 'https://web.archive.org/web/20191110111727/https://www.d1gp.co.jp/03_sche/2019/gp1903/gp1903_repo.html',
      4: 'https://web.archive.org/web/20191110111727/https://www.d1gp.co.jp/03_sche/2019/gp1903/gp1904_repo.html',
      5: 'https://web.archive.org/web/20191211104127/https://www.d1gp.co.jp/03_sche/2019/gp1905/gp1905_repo.html',
      6: 'https://web.archive.org/web/20191211104127/https://www.d1gp.co.jp/03_sche/2019/gp1905/gp1906_repo.html',
      7: 'https://web.archive.org/web/20191216185031/https://www.d1gp.co.jp/03_sche/2019/gp1907/gp1907_repo.html',
    },
  },
  {
    year: 2026,
    rankingUrl:
      'https://d1gp.co.jp/2026d1%e3%82%b0%e3%83%a9%e3%83%b3%e3%83%97%e3%83%aa%e3%82%b7%e3%83%aa%e3%83%bc%e3%82%ba%e3%83%a9%e3%83%b3%e3%82%ad%e3%83%b3%e3%82%b0/',
    categoryBase: 'https://d1gp.co.jp/category/gp/2026-d1gp/',
    categorySlugs: ['gp26-0102', 'gp26-0304', 'gp26-0506', 'gp26-0708', 'gp26-0910'],
    driversIntroUrl:
      'https://d1gp.co.jp/2026-d1%e3%82%b0%e3%83%a9%e3%83%b3%e3%83%97%e3%83%aa%e3%83%89%e3%83%a9%e3%82%a4%e3%83%90%e3%83%bc%e7%b4%b9%e4%bb%8b/',
  },
  {
    year: 2025,
    rankingUrl: 'https://d1gp.co.jp/d1gp2025ranking/',
    categoryBase: 'https://d1gp.co.jp/category/gp/2025-d1gp/',
    categorySlugs: ['gp25-0102', 'gp25-0304', 'gp25-0506', 'gp25-0708', 'gp25-0910'],
    roundStartsAt: {
      1: utcEventDate(2025, 5, 10),
      2: utcEventDate(2025, 5, 11),
      3: utcEventDate(2025, 6, 28),
      4: utcEventDate(2025, 6, 29),
      5: utcEventDate(2025, 9, 27),
      6: utcEventDate(2025, 9, 28),
      7: utcEventDate(2025, 10, 25),
      8: utcEventDate(2025, 10, 26),
      9: utcEventDate(2025, 11, 15),
      10: utcEventDate(2025, 11, 16),
    },
  },
  {
    year: 2024,
    rankingUrl: 'https://d1gp.co.jp/d1gp2024ranking/',
    categoryBase: 'https://d1gp.co.jp/category/gp/2024-d1gp/',
    categorySlugs: ['gp24-0102', 'gp24-0304', 'gp24-0506', 'gp24-0708', 'gp24-0910'],
    roundStartsAt: {
      1: utcEventDate(2024, 5, 11),
      2: utcEventDate(2024, 5, 12),
      3: utcEventDate(2024, 6, 29),
      4: utcEventDate(2024, 6, 30),
      5: utcEventDate(2024, 9, 28),
      6: utcEventDate(2024, 9, 29),
      7: utcEventDate(2024, 10, 26),
      8: utcEventDate(2024, 10, 27),
      9: utcEventDate(2024, 11, 9),
      10: utcEventDate(2024, 11, 10),
    },
  },
  {
    year: 2023,
    rankingUrl: 'https://d1gp.co.jp/d1gp2023ranking/',
    categoryBase: 'https://d1gp.co.jp/category/gp/2023-d1gp/',
    categorySlugs: ['gp23-0102', 'gp23-0304', 'gp23-0506', 'gp23-0708', 'gp23-0910'],
    roundStartsAt: {
      1: utcEventDate(2023, 5, 13),
      2: utcEventDate(2023, 5, 14),
      3: utcEventDate(2023, 6, 24),
      4: utcEventDate(2023, 6, 25),
      5: utcEventDate(2023, 8, 26),
      6: utcEventDate(2023, 8, 27),
      7: utcEventDate(2023, 10, 28),
      8: utcEventDate(2023, 10, 29),
      9: utcEventDate(2023, 11, 11),
      10: utcEventDate(2023, 11, 12),
    },
  },
  {
    year: 2022,
    rankingUrl: 'https://d1gp.co.jp/gp2022ranking/',
    categoryBase: 'https://d1gp.co.jp/category/gp/2022gp/',
    categorySlugs: ['22gp_01', '22gp_0203', 'gp22_0405', '22gp_0607', '22gp_0809'],
    roundStartsAt: {
      1: utcEventDate(2022, 4, 24),
      2: utcEventDate(2022, 6, 11),
      3: utcEventDate(2022, 6, 12),
      4: utcEventDate(2022, 8, 20),
      5: utcEventDate(2022, 8, 21),
      6: utcEventDate(2022, 10, 22),
      7: utcEventDate(2022, 10, 23),
      8: utcEventDate(2022, 11, 12),
      9: utcEventDate(2022, 11, 13),
    },
  },
  {
    year: 2021,
    rankingUrl: 'https://d1gp.co.jp/gp2021ranking/',
    categoryBase: 'https://d1gp.co.jp/category/d1gp/2021gp/',
    categorySlugs: ['21gp_0102', '21gp_0304', '21gp_0506', '21gp_0708', '21gp_0910'],
    roundStartsAt: {
      1: utcEventDate(2021, 4, 24),
      2: utcEventDate(2021, 4, 25),
      3: utcEventDate(2021, 6, 26),
      4: utcEventDate(2021, 6, 27),
      5: utcEventDate(2021, 10, 2),
      6: utcEventDate(2021, 10, 3),
      7: utcEventDate(2021, 10, 30),
      8: utcEventDate(2021, 10, 31),
      9: utcEventDate(2021, 11, 20),
      10: utcEventDate(2021, 11, 21),
    },
    roundTrackNames: {
      1: 'Okui',
      2: 'Okui',
      3: 'Tsukuba Circuit',
      4: 'Tsukuba Circuit',
      5: 'Okui',
      6: 'Okui',
      7: 'Autopolis',
      8: 'Autopolis',
      9: 'Ebisu Circuit',
      10: 'Ebisu Circuit',
    },
  },
  {
    year: 2020,
    rankingUrl: 'https://d1gp.co.jp/gp2020ranking/',
    categoryBase: 'https://d1gp.co.jp/category/d1gp/2020gp/',
    categorySlugs: ['20gp_01', '20gp_0203', '20gp_0405', '20gp_06', '20gp_0708'],
    roundStartsAt: {
      1: utcEventDate(2020, 7, 24),
      2: utcEventDate(2020, 8, 22),
      3: utcEventDate(2020, 8, 23),
      4: utcEventDate(2020, 10, 31),
      5: utcEventDate(2020, 11, 1),
      6: utcEventDate(2020, 11, 15),
      7: utcEventDate(2021, 1, 30),
      8: utcEventDate(2021, 1, 31),
    },
    roundTrackNames: {
      1: 'Okui',
      2: 'Ebisu Circuit',
      3: 'Ebisu Circuit',
      4: 'Autopolis',
      5: 'Autopolis',
      6: 'Ebisu Circuit',
      7: 'Tsukuba Circuit',
      8: 'Tsukuba Circuit',
    },
  },
];

export const D1GP_SUPPORTED_SEASONS = D1GP_SEASONS.map((season) => season.year).sort((a, b) => b - a);

export function getD1gpSeasonConfig(year: number): D1gpSeasonConfig {
  const config = D1GP_SEASONS.find((season) => season.year === year);
  if (!config) {
    throw new Error(
      `D1GP importer supports seasons ${D1GP_SUPPORTED_SEASONS.join(', ')} (requested ${year})`,
    );
  }
  return config;
}
