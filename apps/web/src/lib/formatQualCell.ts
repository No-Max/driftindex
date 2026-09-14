export function formatPlaceOrdinal(place: number, locale: string): string {
  if (locale.startsWith('ru')) return `${place}-е`;

  const mod100 = place % 100;
  const mod10 = place % 10;
  if (mod100 >= 11 && mod100 <= 13) return `${place}th`;
  if (mod10 === 1) return `${place}st`;
  if (mod10 === 2) return `${place}nd`;
  if (mod10 === 3) return `${place}rd`;
  return `${place}th`;
}

/** Combined qual score and place, e.g. 91.5 (4th). */
export function formatQualCell(
  score: number | null | undefined,
  place: number | null | undefined,
  locale: string,
): string {
  const hasScore = score != null;
  const hasPlace = place != null;

  if (!hasScore && !hasPlace) return '—';
  if (hasScore && hasPlace) {
    return `${score.toFixed(1)} (${formatPlaceOrdinal(place, locale)})`;
  }
  if (hasScore) return score.toFixed(1);
  return `(${formatPlaceOrdinal(place!, locale)})`;
}
