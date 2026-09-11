import { fetchFormulaDriftSeason } from '../src/importers/formula-drift.js';

function slugInFilename(driverSlug: string, filename: string): boolean {
  const norm = driverSlug.replace(/-/g, '').toLowerCase();
  const file = filename.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return file.includes(norm);
}

async function main() {
  const year = Number.parseInt(process.argv[2] ?? '2026', 10);
  const data = await fetchFormulaDriftSeason(year);

  console.log(`\n=== FD ${year} photo name check ===`);
  for (const pilot of data.pilots.sort((a, b) => a.slug.localeCompare(b.slug))) {
    if (!pilot.photoSourceUrl) {
      console.log(`MISSING  ${pilot.slug}`);
      continue;
    }
    const fname = pilot.photoSourceUrl.split('/').pop()!;
    const ok = slugInFilename(pilot.slug.replace(/^fd-/, ''), fname);
    console.log(`${ok ? 'OK     ' : 'MISMATCH'} ${pilot.slug.padEnd(30)} ${fname}`);
  }
}

main().catch(console.error);
