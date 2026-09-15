/**
 * Compare curated Telegram screenshot data with import files.
 * Run: npx tsx apps/api/scripts/compare-dk-screens.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { DK_2026_QUALIFYING } from '../src/data/drift-kings-2026.js';
import { DK_2024, DK_2025 } from '../src/data/drift-kings/index.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const CURATED_PATH = path.join(REPO_ROOT, 'screens/DK/_extracted/qualifying-curated.json');

interface CuratedRow {
  position: number;
  name: string;
  score: number | null;
}

interface CuratedEvent {
  year: number;
  event: string;
  source: string;
  rows: CuratedRow[];
}

type QualMap = Record<number, Record<string, { position: number; score: number | null }>>;

function roundFromEvent(event: string): number | null {
  const match = event.match(/^dk-r(\d+)$/);
  return match ? Number(match[1]) : null;
}

function getDbQual(year: number): QualMap {
  if (year === 2026) return DK_2026_QUALIFYING;
  if (year === 2025) return DK_2025.qualifying;
  if (year === 2024) return DK_2024.qualifying;
  return {};
}

async function main() {
  const curated = JSON.parse(await fs.readFile(CURATED_PATH, 'utf8')) as CuratedEvent[];
  let mismatches = 0;
  let matched = 0;
  let added = 0;

  console.log('DK screenshot vs import qualifying comparison\n');

  for (const block of curated) {
    const round = roundFromEvent(block.event);
    if (!round) continue;
    const dbQual = getDbQual(block.year)[round] ?? {};

    console.log(`--- ${block.year} ${block.event} (${block.source}) ---`);

    for (const row of block.rows) {
      const existing = dbQual[row.name];
      if (!existing) {
        console.log(`  + NEW  P${row.position} ${row.name} ${row.score ?? '—'}`);
        added++;
        continue;
      }
      const posOk = existing.position === row.position;
      const scoreOk =
        row.score == null
          ? existing.score == null
          : existing.score != null && Math.abs(existing.score - row.score) < 0.01;
      if (posOk && scoreOk) {
        matched++;
        continue;
      }
      mismatches++;
      console.log(
        `  ! DIFF P${row.position} ${row.name}: screen ${row.score ?? '—'} vs db ` +
          `P${existing.position} ${existing.score ?? '—'}`,
      );
    }

    for (const [name, entry] of Object.entries(dbQual)) {
      if (!block.rows.some((row) => row.name === name)) {
        console.log(`  ? DB-only P${entry.position} ${name} ${entry.score ?? '—'}`);
      }
    }
    console.log('');
  }

  console.log(`Matched: ${matched}, mismatches: ${mismatches}, screen-only (not in db): ${added}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
