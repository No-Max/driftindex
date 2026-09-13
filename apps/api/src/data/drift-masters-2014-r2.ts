import type { DmManualEvent, DmManualRoundResult } from './drift-masters-2014-r1.js';

/**
 * Manual DMGP / DMEC 2014 Round 2 results (Motoarena Toruń, 20 July 2014).
 * "Top 8" without an exact place is stored as tandemPosition 5 (best of 5–8).
 * "не прошел в Top16" → tandemPosition null.
 */
export const DM_2014_R2_EVENT: DmManualEvent = {
  slug: 'dm-r2',
  roundNumber: 2,
  nameEn: 'Round 2',
  nameRu: 'Round 2',
  trackEn: 'Motoarena Toruń',
  trackRu: 'Motoarena Toruń',
  startsAt: '2014-07-20T12:00:00.000Z',
};

export const DM_2014_R2_RESULTS: DmManualRoundResult[] = [
  { tandemPosition: 5, name: 'Paweł Trela', qualPosition: 1, qualPoints: 12, qualScore100: 97.3, gridPoints: 61, points: 73 },
  { tandemPosition: 15, name: 'Mateusz Włodarczyk', qualPosition: 2, qualPoints: 10, qualScore100: 94.0, gridPoints: 42, points: 52 },
  { tandemPosition: 2, name: 'Grzegorz Hypki', qualPosition: 3, qualPoints: 8, qualScore100: 92.0, gridPoints: 88, points: 96 },
  { tandemPosition: 5, name: 'Artur Opiela', qualPosition: 4, qualPoints: 6, qualScore100: 91.5, gridPoints: 61, points: 67 },
  { tandemPosition: 1, name: 'Piotr Więcek', qualPosition: 5, qualPoints: 4, qualScore100: 91.3, gridPoints: 100, points: 104 },
  { tandemPosition: 5, name: 'Adam Zalewski', qualPosition: 6, qualPoints: 4, qualScore100: 91.3, gridPoints: 61, points: 65 },
  { tandemPosition: 3, name: 'Marcin Mospinek', qualPosition: 7, qualPoints: 3, qualScore100: 90.0, gridPoints: 78, points: 81 },
  { tandemPosition: 4, name: 'Bartosz Stolarski', qualPosition: 8, qualPoints: 3, qualScore100: 89.7, gridPoints: 69, points: 72 },
  { tandemPosition: 14, name: 'Piotr Jankowski', qualPosition: 9, qualPoints: 2, qualScore100: 89.5, gridPoints: 44, points: 46 },
  { tandemPosition: 12, name: 'Dawid Karkosik', qualPosition: 10, qualPoints: 2, qualScore100: 89.3, gridPoints: 48, points: 50 },
  { tandemPosition: 13, name: 'Marcin Carzasty', qualPosition: 11, qualPoints: 2, qualScore100: 89.2, gridPoints: 46, points: 48 },
  { tandemPosition: 9, name: 'Marek Wartałowicz', qualPosition: 12, qualPoints: 2, qualScore100: 87.8, gridPoints: 54, points: 56 },
  { tandemPosition: 11, name: 'Sławomir Grausam', qualPosition: 13, qualPoints: 1, qualScore100: 80.7, gridPoints: 50, points: 51 },
  { tandemPosition: 10, name: 'Jakub Przygoński', qualPosition: 14, qualPoints: 1, qualScore100: 79.5, gridPoints: 52, points: 53 },
  { tandemPosition: 5, name: 'Wojciech Goździewicz', qualPosition: 15, qualPoints: 1, qualScore100: 79.0, gridPoints: 61, points: 62 },
  { tandemPosition: 16, name: 'Jakub Skomorucha', qualPosition: 16, qualPoints: 1, qualScore100: 78.3, gridPoints: 40, points: 41 },
  { tandemPosition: null, name: 'Mateusz Fijał', qualPosition: 17, qualPoints: 0, qualScore100: 72.8, gridPoints: 0, points: 0 },
  { tandemPosition: null, name: 'Adrian Zatoń', qualPosition: 18, qualPoints: 0, qualScore100: 68.2, gridPoints: 0, points: 0 },
  { tandemPosition: null, name: 'Szymon Budzyński', qualPosition: 19, qualPoints: 0, qualScore100: 61.5, gridPoints: 0, points: 0 },
  { tandemPosition: null, name: 'Piotr Trojanek', qualPosition: 20, qualPoints: 0, qualScore100: 60.5, gridPoints: 0, points: 0 },
  { tandemPosition: null, name: 'Karol Kowalski', qualPosition: 21, qualPoints: 0, qualScore100: 59.5, gridPoints: 0, points: 0 },
  { tandemPosition: null, name: 'Krzysztof Romanowski', qualPosition: 22, qualPoints: 0, qualScore100: 45.0, gridPoints: 0, points: 0 },
  { tandemPosition: null, name: 'Maciej Bochenek', qualPosition: 23, qualPoints: 0, qualScore100: 44.3, gridPoints: 0, points: 0 },
  { tandemPosition: null, name: 'Piotr Kozłowski', qualPosition: 24, qualPoints: 0, qualScore100: 43.5, gridPoints: 0, points: 0 },
  { tandemPosition: null, name: 'Maciej Jarkiewicz', qualPosition: 25, qualPoints: 0, qualScore100: 43.0, gridPoints: 0, points: 0 },
  { tandemPosition: null, name: 'Krzysztof Terej', qualPosition: 26, qualPoints: 0, qualScore100: 40.3, gridPoints: 0, points: 0 },
  { tandemPosition: null, name: 'Sebastian Matuszewski', qualPosition: 27, qualPoints: 0, qualScore100: 40.2, gridPoints: 0, points: 0 },
  { tandemPosition: null, name: 'Maciej Wodziński', qualPosition: 28, qualPoints: 0, qualScore100: 37.0, gridPoints: 0, points: 0 },
  { tandemPosition: null, name: 'Kuba Jakubowski', qualPosition: 29, qualPoints: 0, qualScore100: 35.0, gridPoints: 0, points: 0 },
  { tandemPosition: null, name: 'Kajetan Rutyna', qualPosition: 30, qualPoints: 0, qualScore100: 33.2, gridPoints: 0, points: 0 },
];
