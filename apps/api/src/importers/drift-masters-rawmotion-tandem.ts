import { RAWMOTION_DM_EVENT_IDS, fetchRawMotionContestRounds } from './drift-masters-rawmotion.js';

export interface DmTandemResult {
  roundNumber: number;
  tandemPosition: number;
  firstName: string;
  lastName: string;
  fullName: string;
  bib: number | null;
  externalAthleteId: string | null;
}

interface RawMotionBattleRow {
  rank?: number;
  order?: number;
  bib?: string;
  firstname?: string;
  lastname?: string;
  externalAthleteId?: string;
}

interface RawMotionHeat {
  results?: RawMotionBattleRow[];
  startList?: Array<{
    order?: number;
    bib?: string;
    athlete?: {
      externalId?: string;
      firstName?: string;
      lastName?: string;
      fullName?: string;
    };
  }>;
}

interface RawMotionRound {
  name: string;
  heats?: RawMotionHeat[];
}

function titleCaseName(value: string): string {
  return value
    .toLowerCase()
    .split(/([\s-'])/)
    .map((part) => (/^[a-z]/i.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join('');
}

function parseBib(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowName(row: RawMotionBattleRow): string {
  const first = row.firstname?.trim() ?? '';
  const last = row.lastname?.trim() ?? '';
  return [first, last].filter(Boolean).join(' ');
}

function buildAthleteDirectory(
  rounds: RawMotionRound[],
): Map<string, { firstName: string; lastName: string; fullName: string }> {
  const directory = new Map<string, { firstName: string; lastName: string; fullName: string }>();

  const remember = (externalId: string | undefined, firstName: string, lastName: string, fullName?: string) => {
    if (!externalId) return;
    const resolvedFull =
      fullName?.trim() || [firstName, lastName].filter(Boolean).join(' ').trim();
    if (!resolvedFull) return;
    directory.set(externalId, {
      firstName,
      lastName,
      fullName: resolvedFull,
    });
  };

  for (const round of rounds) {
    for (const heat of round.heats ?? []) {
      for (const entry of heat.startList ?? []) {
        const athlete = entry.athlete;
        if (!athlete) continue;
        remember(
          athlete.externalId,
          athlete.firstName ? titleCaseName(athlete.firstName) : '',
          athlete.lastName ? titleCaseName(athlete.lastName) : '',
          athlete.fullName,
        );
      }
      for (const row of heat.results ?? []) {
        remember(
          row.externalAthleteId,
          row.firstname ? titleCaseName(row.firstname) : '',
          row.lastname ? titleCaseName(row.lastname) : '',
        );
      }
    }
  }

  return directory;
}

function resolveRowName(
  row: RawMotionBattleRow,
  athletes: Map<string, { firstName: string; lastName: string; fullName: string }>,
): string {
  const direct = rowName(row);
  if (direct) return direct;
  if (!row.externalAthleteId) return '';
  return athletes.get(row.externalAthleteId)?.fullName ?? '';
}

function heatWinnerLoser(
  heat: RawMotionHeat,
  athletes: Map<string, { firstName: string; lastName: string; fullName: string }>,
): { winner: string | null; loser: string | null } {
  const results = [...(heat.results ?? [])].sort(
    (a, b) => (a.rank ?? 99) - (b.rank ?? 99) || (a.order ?? 99) - (b.order ?? 99),
  );
  if (results.length < 2) return { winner: null, loser: null };
  const winner = resolveRowName(results[0]!, athletes);
  const loser = resolveRowName(results[1]!, athletes);
  return {
    winner: winner || null,
    loser: loser || null,
  };
}

function parseEventResultRound(round: RawMotionRound): DmTandemResult[] {
  const heat = round.heats?.[0];
  if (!heat) return [];

  const fromResults = [...(heat.results ?? [])]
    .sort((a, b) => (a.rank ?? a.order ?? 99) - (b.rank ?? b.order ?? 99))
    .map((row, index) => {
      const firstName = row.firstname ? titleCaseName(row.firstname) : '';
      const lastName = row.lastname ? titleCaseName(row.lastname) : '';
      const fullName = rowName(row);
      if (!fullName && !row.externalAthleteId) return null;
      return {
        tandemPosition: row.rank ?? index + 1,
        firstName,
        lastName,
        fullName: fullName || 'Unknown',
        bib: parseBib(row.bib),
        externalAthleteId: row.externalAthleteId ?? null,
      };
    })
    .filter((row): row is Omit<DmTandemResult, 'roundNumber'> => row != null);

  if (fromResults.length > 0 && fromResults.some((row) => row.fullName !== 'Unknown')) {
    return fromResults.map((row) => ({ roundNumber: 0, ...row }));
  }

  const fromStartList = [...(heat.startList ?? [])]
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .map((entry, index) => {
      const athlete = entry.athlete;
      if (!athlete) return null;
      const firstName = athlete.firstName ? titleCaseName(athlete.firstName) : '';
      const lastName = athlete.lastName ? titleCaseName(athlete.lastName) : '';
      const fullName =
        athlete.fullName?.trim() || [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
      return {
        tandemPosition: index + 1,
        firstName,
        lastName,
        fullName,
        bib: parseBib(entry.bib),
        externalAthleteId: athlete.externalId ?? null,
      };
    })
    .filter((row): row is Omit<DmTandemResult, 'roundNumber'> => row != null);

  return fromStartList.map((row) => ({ roundNumber: 0, ...row }));
}

/** Derive tandem finishing order from elimination bracket (pre-2024 RawMotion layout). */
function parseBracketRound(
  rounds: RawMotionRound[],
  qualRankByName: Map<string, number>,
  athletes: Map<string, { firstName: string; lastName: string; fullName: string }>,
): DmTandemResult[] {
  const bands: Array<{ roundName: string; lo: number; hi: number }> = [
    { roundName: 'Top 32', lo: 17, hi: 32 },
    { roundName: 'Top 16', lo: 9, hi: 16 },
    { roundName: 'Top 8', lo: 5, hi: 8 },
  ];

  const losersByBand = new Map<string, string[]>();
  let finalWinner: string | null = null;
  let finalLoser: string | null = null;
  let playoffWinner: string | null = null;
  let playoffLoser: string | null = null;

  for (const round of rounds) {
    const name = round.name.trim();
    if (name === 'Final') {
      for (const heat of round.heats ?? []) {
        const { winner, loser } = heatWinnerLoser(heat, athletes);
        if (winner) finalWinner = winner;
        if (loser) finalLoser = loser;
      }
      continue;
    }
    if (/play\s*off/i.test(name)) {
      for (const heat of round.heats ?? []) {
        const { winner, loser } = heatWinnerLoser(heat, athletes);
        if (winner) playoffWinner = winner;
        if (loser) playoffLoser = loser;
      }
      continue;
    }

    const band = bands.find((item) => item.roundName === name);
    if (!band) continue;

    const losers: string[] = [];
    for (const heat of round.heats ?? []) {
      const { loser } = heatWinnerLoser(heat, athletes);
      if (loser) losers.push(loser);
    }
    losers.sort((a, b) => (qualRankByName.get(a) ?? 999) - (qualRankByName.get(b) ?? 999));
    losersByBand.set(band.roundName, losers);
  }

  const positionByName = new Map<string, number>();
  if (finalWinner) positionByName.set(finalWinner, 1);
  if (finalLoser) positionByName.set(finalLoser, 2);
  if (playoffWinner) positionByName.set(playoffWinner, 3);
  if (playoffLoser) positionByName.set(playoffLoser, 4);

  for (const band of bands) {
    const losers = losersByBand.get(band.roundName) ?? [];
    losers.forEach((name, index) => {
      positionByName.set(name, band.lo + index);
    });
  }

  return [...positionByName.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([fullName, tandemPosition]) => {
      const parts = fullName.split(/\s+/);
      const firstName = parts[0] ? titleCaseName(parts[0]) : '';
      const lastName = parts.slice(1).map(titleCaseName).join(' ');
      return {
        roundNumber: 0,
        tandemPosition,
        firstName,
        lastName,
        fullName,
        bib: null,
        externalAthleteId: null,
      };
    });
}

function qualRankByDriverName(
  rounds: RawMotionRound[],
  athletes: Map<string, { firstName: string; lastName: string; fullName: string }>,
): Map<string, number> {
  const qualRound = rounds.find((round) => /^qualifying$/i.test(round.name.trim()));
  const rankByName = new Map<string, number>();
  if (!qualRound) return rankByName;

  for (const heat of qualRound.heats ?? []) {
    for (const row of heat.results ?? []) {
      const name = resolveRowName(row, athletes);
      if (name && row.rank != null) rankByName.set(name, row.rank);
    }
  }
  return rankByName;
}

export function parseRawMotionTandemPlacements(rounds: RawMotionRound[]): DmTandemResult[] {
  const athletes = buildAthleteDirectory(rounds);

  const eventResult = rounds.find((round) => /event\s*result/i.test(round.name));
  if (eventResult) {
    const rows = parseEventResultRound(eventResult);
    if (rows.length > 0) return rows;
  }

  const qualRanks = qualRankByDriverName(rounds, athletes);
  return parseBracketRound(rounds, qualRanks, athletes);
}

export async function fetchDriftMastersTandemByRound(
  seasonYear: number,
  roundCount = 7,
): Promise<Map<number, DmTandemResult[]>> {
  const eventId = RAWMOTION_DM_EVENT_IDS[seasonYear];
  if (!eventId) return new Map();

  const byRound = new Map<number, DmTandemResult[]>();
  for (let roundNumber = 1; roundNumber <= roundCount; roundNumber++) {
    try {
      const rounds = (await fetchRawMotionContestRounds(
        eventId,
        roundNumber,
      )) as RawMotionRound[];
      const parsed = parseRawMotionTandemPlacements(rounds).map((row) => ({
        ...row,
        roundNumber,
      }));
      if (parsed.length > 0) byRound.set(roundNumber, parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`RawMotion tandem unavailable for ${seasonYear} round ${roundNumber}: ${message}`);
    }
  }
  return byRound;
}
