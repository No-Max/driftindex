/**
 * OCR qualifying tables from screens/DK qual screenshots.
 * Run: npx tsx apps/api/scripts/extract-dk-qual-screens.ts
 */
import { createWorker } from 'tesseract.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const SCREENS_ROOT = path.join(REPO_ROOT, 'screens/DK');
const OUT_DIR = path.join(REPO_ROOT, 'screens/DK/_extracted');

interface QualRow {
  position: number;
  number: number | null;
  name: string;
  best: number | null;
}

interface EventExtract {
  year: number;
  event: string;
  sourceFile: string;
  titleLine: string | null;
  rows: QualRow[];
}

function parseQualRows(text: string): { titleLine: string | null; rows: QualRow[] } {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const titleLine =
    lines.find((line) => /\b20\d{2}\b/.test(line) && /drift kings|round|pro|rd/i.test(line)) ?? null;

  const rows: QualRow[] = [];
  for (const line of lines) {
    const match = line.match(
      /^=?[\s]*(\d{1,2})[\s|]+(\d{1,3})[\s|]+([A-Za-zÀ-ÿĀ-žŁłŐőŰűČčŠšŽžĆćĐđ][A-Za-zÀ-ÿĀ-žŁłŐőŰűČčŠšŽžĆćĐđ\s.'-]{2,})[\s|]+.*?(\d{2}\.\d{2}|\d{2})/,
    );
    if (!match) continue;
    const position = Number(match[1]);
    const number = Number(match[2]);
    const name = match[3]!.replace(/\s+/g, ' ').trim();
    const best = Number.parseFloat(match[4]!);
    if (position < 1 || position > 64 || Number.isNaN(best)) continue;
    rows.push({ position, number, name, best });
  }

  const byPos = new Map<number, QualRow>();
  for (const row of rows) {
    if (!byPos.has(row.position)) byPos.set(row.position, row);
  }
  return {
    titleLine,
    rows: [...byPos.values()].sort((a, b) => a.position - b.position),
  };
}

async function collectQualImages(): Promise<Array<{ year: number; event: string; filePath: string }>> {
  const out: Array<{ year: number; event: string; filePath: string }> = [];
  const years = await fs.readdir(SCREENS_ROOT);
  for (const yearDir of years) {
    if (!/^\d{4}$/.test(yearDir)) continue;
    const year = Number(yearDir);
    const yearPath = path.join(SCREENS_ROOT, yearDir);
    const events = await fs.readdir(yearPath);
    for (const event of events) {
      const eventPath = path.join(yearPath, event);
      const stat = await fs.stat(eventPath);
      if (!stat.isDirectory()) continue;
      const files = await fs.readdir(eventPath);
      for (const file of files) {
        if (!file.endsWith('.jpg')) continue;
        out.push({ year, event, filePath: path.join(eventPath, file) });
      }
    }
  }
  return out;
}

function isLikelyQualFile(filesInDir: string[], file: string, allFiles: string[]): boolean {
  const dir = path.dirname(file);
  const siblings = allFiles.filter((f) => path.dirname(f) === dir).map((f) => path.basename(f));
  const hasBracketOnly = siblings.length <= 2;
  // Heuristic: qual tables have fewer bracket keywords in filename order — OCR title decides.
  void hasBracketOnly;
  return true;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const worker = await createWorker('eng');
  const images = await collectQualImages();
  const extracts: EventExtract[] = [];

  for (const image of images) {
    if (!isLikelyQualFile([], image.filePath, images.map((i) => i.filePath))) continue;
    const { data } = await worker.recognize(image.filePath);
    const parsed = parseQualRows(data.text);
    if (parsed.rows.length < 8) continue;
    extracts.push({
      year: image.year,
      event: image.event,
      sourceFile: path.relative(REPO_ROOT, image.filePath),
      titleLine: parsed.titleLine,
      rows: parsed.rows,
    });
    console.log(`✓ ${image.year}/${image.event}: ${parsed.rows.length} rows — ${parsed.titleLine ?? 'no title'}`);
  }

  await worker.terminate();

  const outPath = path.join(OUT_DIR, 'qualifying.json');
  await fs.writeFile(outPath, `${JSON.stringify(extracts, null, 2)}\n`);
  console.log(`\nWrote ${extracts.length} event extracts to ${path.relative(REPO_ROOT, outPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
