/** Manual DMGP / DMEC 2014 Round 1 results (Gdańsk, PGE Arena). */

export interface DmManualEvent {
  slug: string;
  roundNumber: number;
  nameEn: string;
  nameRu: string;
  trackEn: string;
  trackRu: string;
  startsAt: string;
}

export interface DmManualRoundResult {
  tandemPosition: number | null;
  name: string;
  /** Best place in the qualifying bracket (5–6 → 5). */
  qualPosition: number | null;
  qualPoints: number | null;
  qualScore100?: number | null;
  gridPoints: number | null;
  points: number;
}

export const DM_2014_R1_EVENT = {
  slug: 'dm-r1',
  roundNumber: 1,
  nameEn: 'Round 1',
  nameRu: 'Round 1',
  trackEn: 'PGE Arena Gdańsk',
  trackRu: 'PGE Arena Gdańsk',
  startsAt: '2014-06-21T12:00:00.000Z',
} as const;

export const DM_2014_R1_RESULTS: DmManualRoundResult[] = [
  { tandemPosition: 1, name: 'Piotr Więcek', qualPosition: 2, qualPoints: 10, gridPoints: 100, points: 110 },
  { tandemPosition: 2, name: 'Bartosz Stolarski', qualPosition: 4, qualPoints: 6, gridPoints: 88, points: 94 },
  { tandemPosition: 3, name: 'Jakub Skomorucha', qualPosition: 5, qualPoints: 4, gridPoints: 78, points: 82 },
  { tandemPosition: 4, name: 'Marcin Mospinek', qualPosition: 9, qualPoints: 2, gridPoints: 69, points: 71 },
  { tandemPosition: 5, name: 'Dawid Karkosik', qualPosition: 5, qualPoints: 4, gridPoints: 61, points: 65 },
  { tandemPosition: 6, name: 'Mateusz Włodarczyk', qualPosition: 7, qualPoints: 3, gridPoints: 61, points: 64 },
  { tandemPosition: 7, name: 'Artur Opiela', qualPosition: 1, qualPoints: 12, gridPoints: 61, points: 73 },
  { tandemPosition: 8, name: 'Piotr Jankowski', qualPosition: 13, qualPoints: 1, gridPoints: 61, points: 62 },
  { tandemPosition: 9, name: 'Maciej Bochenek', qualPosition: 3, qualPoints: 8, gridPoints: 54, points: 62 },
  { tandemPosition: 10, name: 'Krzysztof Romanowski', qualPosition: 13, qualPoints: 1, gridPoints: 52, points: 53 },
  { tandemPosition: 11, name: 'Grzegorz Hypki', qualPosition: 7, qualPoints: 3, gridPoints: 50, points: 53 },
  { tandemPosition: 12, name: 'Paweł Trela', qualPosition: 9, qualPoints: 2, gridPoints: 48, points: 50 },
  { tandemPosition: 13, name: 'Marek Wartałowicz', qualPosition: 13, qualPoints: 1, gridPoints: 46, points: 47 },
  { tandemPosition: 14, name: 'Sławomir Grausam', qualPosition: 9, qualPoints: 2, gridPoints: 44, points: 46 },
  { tandemPosition: 15, name: 'Niels Becker', qualPosition: 13, qualPoints: 1, gridPoints: 42, points: 43 },
  { tandemPosition: 16, name: 'Szymon Budzyński', qualPosition: 9, qualPoints: 2, gridPoints: 40, points: 42 },
  { tandemPosition: 17, name: 'Piotr Trojanek', qualPosition: null, qualPoints: null, gridPoints: null, points: 0 },
  { tandemPosition: 18, name: 'Piotr Kozłowski', qualPosition: null, qualPoints: null, gridPoints: null, points: 0 },
  { tandemPosition: 19, name: 'Marcin Witchen', qualPosition: null, qualPoints: null, gridPoints: null, points: 0 },
  { tandemPosition: 20, name: 'Wojciech Łubkowski', qualPosition: null, qualPoints: null, gridPoints: null, points: 0 },
  { tandemPosition: 21, name: 'Sebastian Matuszewski', qualPosition: null, qualPoints: null, gridPoints: null, points: 0 },
  { tandemPosition: 22, name: 'Maciej Jarkiewicz', qualPosition: null, qualPoints: null, gridPoints: null, points: 0 },
  { tandemPosition: 23, name: 'Bartłomiej Owczarek', qualPosition: null, qualPoints: null, gridPoints: null, points: 0 },
  { tandemPosition: 24, name: 'Wojciech Jakubowski', qualPosition: null, qualPoints: null, gridPoints: null, points: 0 },
  { tandemPosition: 25, name: 'Szymon Jaśkiewicz', qualPosition: null, qualPoints: null, gridPoints: null, points: 0 },
  { tandemPosition: 26, name: 'Kewin Kosowski', qualPosition: null, qualPoints: null, gridPoints: null, points: 0 },
  { tandemPosition: 27, name: 'Mateusz Fijał', qualPosition: null, qualPoints: null, gridPoints: null, points: 0 },
  { tandemPosition: 28, name: 'Wojciech Goździewicz', qualPosition: null, qualPoints: null, gridPoints: null, points: 0 },
  { tandemPosition: 29, name: 'Adrian Zatoń', qualPosition: null, qualPoints: null, gridPoints: null, points: 0 },
  { tandemPosition: 30, name: 'Maciej Wodziński', qualPosition: null, qualPoints: null, gridPoints: null, points: 0 },
];
