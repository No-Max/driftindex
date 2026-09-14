export interface D1gpSeasonConfig {
  year: number;
  rankingUrl: string;
  categoryBase: string;
  categorySlugs: string[];
  /** Optional driver portrait page (2026+). */
  driversIntroUrl?: string;
}

export const D1GP_SEASONS: D1gpSeasonConfig[] = [
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
  },
  {
    year: 2024,
    rankingUrl: 'https://d1gp.co.jp/d1gp2024ranking/',
    categoryBase: 'https://d1gp.co.jp/category/gp/2024-d1gp/',
    categorySlugs: ['gp24-0102', 'gp24-0304', 'gp24-0506', 'gp24-0708', 'gp24-0910'],
  },
  {
    year: 2023,
    rankingUrl: 'https://d1gp.co.jp/d1gp2023ranking/',
    categoryBase: 'https://d1gp.co.jp/category/gp/2023-d1gp/',
    categorySlugs: ['gp23-0102', 'gp23-0304', 'gp23-0506', 'gp23-0708', 'gp23-0910'],
  },
  {
    year: 2022,
    rankingUrl: 'https://d1gp.co.jp/gp2022ranking/',
    categoryBase: 'https://d1gp.co.jp/category/gp/2022gp/',
    categorySlugs: ['22gp_01', '22gp_0203', 'gp22_0405', '22gp_0607', '22gp_0809'],
  },
  {
    year: 2021,
    rankingUrl: 'https://d1gp.co.jp/gp2021ranking/',
    categoryBase: 'https://d1gp.co.jp/category/d1gp/2021gp/',
    categorySlugs: ['21gp_0102', '21gp_0304', '21gp_0506', '21gp_0708', '21gp_0910'],
  },
  {
    year: 2020,
    rankingUrl: 'https://d1gp.co.jp/gp2020ranking/',
    categoryBase: 'https://d1gp.co.jp/category/d1gp/2020gp/',
    categorySlugs: ['20gp_01', '20gp_0203', '20gp_0405', '20gp_06', '20gp_0708'],
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
