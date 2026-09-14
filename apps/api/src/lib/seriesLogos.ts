import type { PrismaClient } from '@prisma/client';

export async function loadSeriesLogoMap(prisma: PrismaClient): Promise<Map<string, string | null>> {
  const rows = await prisma.series.findMany({
    select: { slug: true, logoUrl: true },
  });
  return new Map(rows.map((row) => [row.slug, row.logoUrl]));
}

export function seriesLogoFromMap(
  logoBySlug: Map<string, string | null>,
  slug: string,
): string | null {
  return logoBySlug.get(slug) ?? null;
}
