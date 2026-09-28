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

/** Combined qual score/points and place, e.g. 91.5 (4th) or 12 (21st). */
export function formatQualCell(
  score: number | null | undefined,
  place: number | null | undefined,
  locale: string,
  points?: number | null,
): string {
  const hasScore = score != null;
  const hasPlace = place != null;
  const hasPoints = points != null;

  if (!hasScore && !hasPlace && !hasPoints) return '—';
  if (hasScore && hasPlace) {
    return `${score.toFixed(1)} (${formatPlaceOrdinal(place, locale)})`;
  }
  if (hasScore) return score.toFixed(1);
  if (hasPoints && hasPlace) {
    return `${points} (${formatPlaceOrdinal(place, locale)})`;
  }
  if (hasPoints) return String(points);
  return `(${formatPlaceOrdinal(place!, locale)})`;
}
