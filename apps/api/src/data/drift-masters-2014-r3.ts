import type { DmManualEvent, DmManualRoundResult } from './drift-masters-2014-r1.js';

/**
 * Manual DMGP 2014 Round 3 results (Karpacz, 13–14 September 2014).
 * Event stopped after a tandem crash; Top8 classified 8th by stewards.
 * Only Top16 published; remaining DNQ of 29 are not in the source.
 */
export const DM_2014_R3_EVENT: DmManualEvent = {
  slug: 'dm-r3',
  roundNumber: 3,
  nameEn: 'Round 3',
  nameRu: 'Round 3',
  trackEn: 'Karpacz, ul. Karkonoska',
  trackRu: 'Karpacz, ul. Karkonoska',
  startsAt: '2014-09-13T12:00:00.000Z',
};

export const DM_2014_R3_RESULTS: DmManualRoundResult[] = [
  { tandemPosition: 9, name: 'Dawid Karkosik', qualPosition: 1, qualPoints: 12, qualScore100: 93.7, gridPoints: 54, points: 66 },
  { tandemPosition: 8, name: 'Marcin Mospinek', qualPosition: 2, qualPoints: 10, qualScore100: 88.3, gridPoints: 61, points: 71 },
  { tandemPosition: 8, name: 'Artur Opiela', qualPosition: 3, qualPoints: 8, qualScore100: 87.5, gridPoints: 61, points: 69 },
  { tandemPosition: 8, name: 'Piotr Więcek', qualPosition: 4, qualPoints: 6, qualScore100: 86.3, gridPoints: 61, points: 67 },
  { tandemPosition: 8, name: 'Maciej Bochenek', qualPosition: 5, qualPoints: 4, qualScore100: 86.2, gridPoints: 61, points: 65 },
  { tandemPosition: 8, name: 'Krzysztof Romanowski', qualPosition: 6, qualPoints: 4, qualScore100: 84.3, gridPoints: 61, points: 65 },
  { tandemPosition: 8, name: 'Bartosz Stolarski', qualPosition: 7, qualPoints: 3, qualScore100: 83.3, gridPoints: 61, points: 64 },
  { tandemPosition: 8, name: 'Paweł Trela', qualPosition: 8, qualPoints: 3, qualScore100: 80.5, gridPoints: 61, points: 64 },
  { tandemPosition: 10, name: 'Grzegorz Hypki', qualPosition: 9, qualPoints: 2, qualScore100: 80.0, gridPoints: 52, points: 54 },
  { tandemPosition: 12, name: 'Adam Zalewski', qualPosition: 10, qualPoints: 2, qualScore100: 78.5, gridPoints: 48, points: 50 },
  { tandemPosition: 15, name: 'Piotr Kozłowski', qualPosition: 11, qualPoints: 2, qualScore100: 76.2, gridPoints: 42, points: 44 },
  { tandemPosition: 11, name: 'Wojciech Goździewicz', qualPosition: 12, qualPoints: 2, qualScore100: 72.3, gridPoints: 50, points: 52 },
  { tandemPosition: 14, name: 'Piotr Jankowski', qualPosition: 13, qualPoints: 1, qualScore100: 71.0, gridPoints: 44, points: 45 },
  { tandemPosition: 16, name: 'Jacek Popiołek', qualPosition: 14, qualPoints: 1, qualScore100: 69.8, gridPoints: 40, points: 41 },
  { tandemPosition: 13, name: 'Sławomir Grausam', qualPosition: 15, qualPoints: 1, qualScore100: 68.5, gridPoints: 46, points: 47 },
  { tandemPosition: 8, name: 'Edmunds Erglis', qualPosition: 16, qualPoints: 1, qualScore100: 66.8, gridPoints: 61, points: 62 },
];
