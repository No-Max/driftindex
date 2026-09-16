/**
 * OCR DMEC qualifying tables from screens/DM/{year}/round-*-qualifying.{png,jpg}
 * Run: npx tsx apps/api/scripts/extract-dm-qual-screens.ts [--year 2023]
 */
import { createWorker } from 'tesseract.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');

interface QualRow {
  rank: number;
  name: string;
  qualScore100: number;
}

function titleCaseName(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function normalizeQualScore(raw: number): number {
  if (raw > 0 && raw < 10) return raw + 64;
  return raw;
}

function preprocessQualLine(line: string): string {
  return line
    .replace(/^\[3\s/, '6 ')
    .replace(/^\[/, '')
    .replace(/^3\s+(Axel|Orjan)\s/i, '31 $1 ')
    .replace(/^n\s+(?=[A-Za-z])/, '11 ')
    .replace(/^i\)\s+/, '19 ')
    .replace(/^1%\s+/, '14 ');
}

/** DMGP qual screenshot: `1 James DEANE (#201) 96.00` */
export function parseDmGpQualScreenshotText(text: string): QualRow[] {
  if (!/Top 32 Qualifiers/i.test(text)) return [];

  const rows: QualRow[] = [];
  for (const rawLine of text.split('\n')) {
    const line = preprocessQualLine(rawLine.trim());
    const match = line.match(
      /^(\d{1,2})\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]+?)\s+\(#(\d+)\)\s+(\d{1,2}(?:\.\d{1,2})?)/,
    );
    if (!match) continue;

    const rank = Number(match[1]);
    const name = titleCaseName(match[2]!);
    let qualScore100 = Number.parseFloat(match[4]!);
    qualScore100 = normalizeQualScore(qualScore100);
    if (rank < 1 || rank > 64 || qualScore100 < 1 || qualScore100 > 100) continue;
    rows.push({ rank, name, qualScore100 });
  }

  const byRank = new Map<number, QualRow>();
  for (const row of rows) {
    if (!byRank.has(row.rank)) byRank.set(row.rank, row);
  }
  return [...byRank.values()].sort((a, b) => a.rank - b.rank);
}

function parseDmQualOcrText(text: string): QualRow[] {
  return parseDmGpQualScreenshotText(text);
}

async function collectImages(year: number): Promise<string[]> {
  const dir = path.join(REPO_ROOT, 'screens', 'DM', String(year));
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  return entries
    .filter((f) => /^round-\d+-qualifying/.test(f) && /\.(png|jpe?g|webp)$/i.test(f))
    .map((f) => path.join(dir, f))
    .sort();
}

function roundFromFilename(filePath: string): number {
  const base = path.basename(filePath);
  const m = base.match(/^round-(\d+)-qualifying/);
  return m ? Number(m[1]) : 0;
}

async function main() {
  const debug = process.argv.includes('--debug');
  const yearFlag = process.argv.indexOf('--year');
  const year =
    yearFlag !== -1 && /^\d{4}$/.test(process.argv[yearFlag + 1] ?? '')
      ? Number(process.argv[yearFlag + 1])
      : 2023;

  const images = await collectImages(year);
  if (images.length === 0) {
    console.log(`No qual images under screens/DM/${year}`);
    return;
  }

  const worker = await createWorker('eng');
  const byRound = new Map<number, QualRow[]>();

  for (const filePath of images) {
    const roundNumber = roundFromFilename(filePath);
    if (roundNumber <= 0) continue;
    const { data } = await worker.recognize(filePath);
    if (debug) {
      console.log(`\n--- OCR ${path.basename(filePath)} ---\n${data.text}\n---`);
    }
    const parsed = parseDmQualOcrText(data.text);
    if (parsed.length === 0) continue;
    const existing = byRound.get(roundNumber) ?? [];
    byRound.set(roundNumber, [...existing, ...parsed]);
    console.log(
      `${path.basename(filePath)}: ${parsed.length} rows (round ${roundNumber}, merged ${byRound.get(roundNumber)!.length})`,
    );
  }

  await worker.terminate();

  for (const [roundNumber, rows] of byRound) {
    const deduped = new Map<number, QualRow>();
    for (const row of rows.sort((a, b) => a.rank - b.rank)) {
      if (!deduped.has(row.rank)) deduped.set(row.rank, row);
    }
    const finalRows = [...deduped.values()];
    const out = {
      roundNumber,
      sourceUrl: `screens/DM/${year}/round-${roundNumber}-qualifying (OCR)`,
      rows: finalRows.map((r) => ({
        rank: r.rank,
        name: r.name,
        qualScore100: r.qualScore100,
      })),
    };
    const outPath = path.join(REPO_ROOT, 'screens', 'DM', String(year), `round-${roundNumber}-qualifying.json`);
    await fs.writeFile(outPath, `${JSON.stringify(out, null, 2)}\n`);
    console.log(`Wrote ${finalRows.length} rows → ${path.relative(REPO_ROOT, outPath)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
