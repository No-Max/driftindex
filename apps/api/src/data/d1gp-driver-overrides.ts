/** Ranking-table names that differ from the current grid map (e.g. renumbered cars). */
export const D1GP_DRIVER_BY_RANKING_NAME: Record<
  string,
  { firstName: string; lastName: string; nameJa: string; country: string | null }
> = {
  '山中 真生': {
    firstName: 'Mao',
    lastName: 'Yamanaka',
    nameJa: '山中 真生',
    country: 'JP',
  },
  '日比野 哲也': {
    firstName: 'Tetsuya',
    lastName: 'Hibino',
    nameJa: '日比野 哲也',
    country: 'JP',
  },
  /** 2024 ranking table variant for Daigo Saito (#87). */
  '齋藤 太吾': {
    firstName: 'Daigo',
    lastName: 'Saito',
    nameJa: '齋藤 太吾',
    country: 'JP',
  },
};
