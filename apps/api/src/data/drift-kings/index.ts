import { DK_2021 } from './2021.js';
import { DK_2022 } from './2022.js';
import { DK_2023 } from './2023.js';
import { DK_2024 } from './2024.js';
import { DK_2025 } from './2025.js';
import type { DkArchiveSeason } from './types.js';

export const DK_ARCHIVE_SEASONS: readonly DkArchiveSeason[] = [
  DK_2021,
  DK_2022,
  DK_2023,
  DK_2024,
  DK_2025,
];

export function dkArchiveSeason(year: number): DkArchiveSeason | undefined {
  return DK_ARCHIVE_SEASONS.find((season) => season.year === year);
}

export { DK_2021, DK_2022, DK_2023, DK_2024, DK_2025 };
export type { DkArchiveSeason, DkArchiveResultRow } from './types.js';
export { expandDkArchiveResults } from './types.js';
