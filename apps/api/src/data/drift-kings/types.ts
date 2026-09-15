export interface DkArchiveEvent {
  slug: string;
  roundNumber: number;
  name: string;
  trackName: string;
  country: string;
  city: string;
  startsAt: string;
  status: 'FINISHED';
  sourceUrl: string;
}

export interface DkArchiveQuali {
  position: number;
  score: number | null;
}

/** Championship Q + tandem points for one round. Null = did not score. */
export type DkArchiveRound = readonly [q: number, t: number];

export interface DkArchiveDriver {
  name: string;
  aliases?: readonly string[];
  rounds: ReadonlyArray<DkArchiveRound | null>;
}

export interface DkArchiveSeason {
  year: number;
  sourceUrl: string;
  standingsUrl: string;
  sourceLabelEn: string;
  sourceLabelRu: string;
  events: readonly DkArchiveEvent[];
  /** Labeled Pro tandem finishes from official recaps only. */
  podiums: Readonly<Record<number, readonly string[]>>;
  /** Confirmed judging-score / place fragments only — not inferred from Q points. */
  qualifying: Readonly<Record<number, Readonly<Record<string, DkArchiveQuali>>>>;
  drivers: readonly DkArchiveDriver[];
}

export interface DkArchiveResultRow {
  eventSlug: string;
  roundNumber: number;
  name: string;
  aliases: readonly string[];
  points: number;
  qualPoints: number | null;
  tandemPosition: number | null;
  qualPosition: number | null;
  qualScore100: number | null;
}

export function expandDkArchiveResults(season: DkArchiveSeason): DkArchiveResultRow[] {
  const names = new Set(season.drivers.map((driver) => driver.name));
  for (const [round, podium] of Object.entries(season.podiums)) {
    for (const name of podium) {
      if (!names.has(name)) {
        throw new Error(`DK ${season.year} podium driver missing from standings: R${round} ${name}`);
      }
    }
  }
  for (const [round, quali] of Object.entries(season.qualifying)) {
    for (const name of Object.keys(quali)) {
      if (!names.has(name)) {
        throw new Error(`DK ${season.year} qualifying driver missing from standings: R${round} ${name}`);
      }
    }
  }

  return season.drivers.flatMap((driver) =>
    driver.rounds.flatMap((round, index) => {
      if (!round) return [];
      const [q, t] = round;
      const points = q + t;
      if (points <= 0) return [];
      const roundNumber = index + 1;
      const podium = season.podiums[roundNumber];
      const quali = season.qualifying[roundNumber]?.[driver.name];
      const place = podium ? podium.indexOf(driver.name) : -1;
      return [
        {
          eventSlug: `dk-r${roundNumber}`,
          roundNumber,
          name: driver.name,
          aliases: driver.aliases ?? [],
          points,
          qualPoints: q > 0 ? q : null,
          tandemPosition: place >= 0 ? place + 1 : null,
          qualPosition: quali?.position ?? null,
          qualScore100: quali?.score ?? null,
        },
      ];
    }),
  );
}
