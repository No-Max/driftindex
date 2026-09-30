import type { PollDetail } from '@drift-index/shared';

type Translate = (key: string, values?: Record<string, unknown>) => string;

export function isSeriesLeaderDuelPoll(poll: PollDetail): boolean {
  return poll.type === 'DUEL' && poll.slug.startsWith('series-duel-');
}

function withYear(title: string, year: number | null | undefined): string {
  return year != null ? `${title} · ${year}` : title;
}

export function pollTitle(
  poll: PollDetail,
  t: Translate,
  seriesPair?: { a: string; b: string } | null,
): string {
  switch (poll.type) {
    case 'PILOTS':
      return withYear(t('home.fanVote.pilot'), poll.year);
    case 'SERIES':
      return withYear(t('home.fanVote.series'), poll.year);
    case 'CARS':
      return withYear(t('home.fanVote.platform'), poll.year);
    case 'DUEL':
      if (isSeriesLeaderDuelPoll(poll)) {
        if (seriesPair) {
          return t('home.fanVote.seriesDuelTitle', seriesPair);
        }
        return poll.name;
      }
      return withYear(t('home.fanVote.duelTitle'), poll.year);
    default:
      return poll.name;
  }
}

export function pollDescription(poll: PollDetail, t: Translate): string {
  switch (poll.type) {
    case 'PILOTS':
      return t('home.fanVote.pilotSub');
    case 'SERIES':
      return t('home.fanVote.seriesSub');
    case 'CARS':
      return t('home.fanVote.platformSub');
    case 'DUEL':
      return isSeriesLeaderDuelPoll(poll)
        ? t('home.fanVote.seriesDuelSub')
        : t('home.fanVote.duelSub');
    default:
      return poll.description ?? '';
  }
}
