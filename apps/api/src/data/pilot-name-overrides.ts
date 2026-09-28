/** Verified first/last name order when import sources disagree. Keys are pilot slugs. */
export const PILOT_NAME_OVERRIDES: Record<string, { firstName: string; lastName: string }> = {
  'rds-27681': { firstName: 'Artem', lastName: 'Shabanov' },
  'rds-6411': { firstName: 'Maksim', lastName: 'Grossman' },
  'shnayder-leonid-7': { firstName: 'Leonid', lastName: 'Shnayder' },
  'orjan-nilsen': { firstName: 'Ørjan', lastName: 'Nilsen' },
  'adam-lz': { firstName: 'Adam', lastName: 'LZ' },
};
