/** Display decimal average place as a whole-place range, e.g. 3.2 → "3-4", 5 → "5". */
export function formatAvgPlaceRange(avgPlace: number): string {
  const low = Math.floor(avgPlace);
  const high = Math.ceil(avgPlace);
  if (low === high) return String(low);
  return `${low}-${high}`;
}
