import type {
  PollDetail,
  PollListResponse,
  PollOptionView,
  PollSummary,
} from '@drift-index/shared';
import type { Poll, PollOption, Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

type PollWithOptions = Poll & { options: PollOption[] };

function asMeta(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toOptionView(
  option: PollOption,
  voteCount: number,
): PollOptionView {
  const meta = asMeta(option.metaJson);
  const pilotSlug =
    typeof meta?.pilotSlug === 'string' ? meta.pilotSlug : null;
  return {
    id: option.id,
    label: option.label,
    sortOrder: option.sortOrder,
    photoUrl: option.photoUrl,
    pilotSlug,
    meta,
    voteCount,
  };
}

export async function listActivePolls(viewerUserId: string | null): Promise<PollListResponse> {
  const polls = await prisma.poll.findMany({
    where: { status: 'ACTIVE' },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  });

  const details = await Promise.all(
    polls.map((poll) => hydratePoll(poll, viewerUserId)),
  );

  return { polls: details };
}

export async function getPollBySlug(
  slug: string,
  viewerUserId: string | null,
): Promise<PollDetail | null> {
  const poll = await prisma.poll.findUnique({
    where: { slug },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!poll) return null;
  return hydratePoll(poll, viewerUserId);
}

async function hydratePoll(
  poll: PollWithOptions,
  viewerUserId: string | null,
): Promise<PollDetail> {
  const groups = await prisma.pollVote.groupBy({
    by: ['optionId'],
    where: { pollId: poll.id },
    _count: { _all: true },
  });
  const countByOption = new Map(groups.map((row) => [row.optionId, row._count._all]));
  const totalVotes = groups.reduce((sum, row) => sum + row._count._all, 0);

  let myOptionId: string | null = null;
  if (viewerUserId) {
    const mine = await prisma.pollVote.findUnique({
      where: { pollId_userId: { pollId: poll.id, userId: viewerUserId } },
      select: { optionId: true },
    });
    myOptionId = mine?.optionId ?? null;
  }

  const summary: PollSummary = {
    id: poll.id,
    slug: poll.slug,
    name: poll.name,
    description: poll.description,
    status: poll.status as PollSummary['status'],
    type: poll.type as PollSummary['type'],
    year: poll.year,
    sortOrder: poll.sortOrder,
    totalVotes,
    myOptionId,
  };

  return {
    ...summary,
    options: poll.options.map((option) =>
      toOptionView(option, countByOption.get(option.id) ?? 0),
    ),
  };
}

export async function castPollVote(input: {
  slug: string;
  optionId: string;
  userId: string;
}): Promise<PollDetail> {
  const poll = await prisma.poll.findUnique({
    where: { slug: input.slug },
    include: { options: true },
  });
  if (!poll) {
    throw Object.assign(new Error('Poll not found'), { status: 404 });
  }
  if (poll.status !== 'ACTIVE') {
    throw Object.assign(new Error('Poll is not open for voting'), { status: 400 });
  }
  const option = poll.options.find((row) => row.id === input.optionId);
  if (!option) {
    throw Object.assign(new Error('Option is not in this poll'), { status: 400 });
  }

  const existing = await prisma.pollVote.findUnique({
    where: { pollId_userId: { pollId: poll.id, userId: input.userId } },
    select: { id: true },
  });
  if (existing) {
    throw Object.assign(new Error('Already voted'), { status: 409 });
  }

  await prisma.pollVote.create({
    data: {
      pollId: poll.id,
      optionId: option.id,
      userId: input.userId,
    },
  });

  const refreshed = await getPollBySlug(input.slug, input.userId);
  if (!refreshed) {
    throw Object.assign(new Error('Poll not found'), { status: 404 });
  }
  return refreshed;
}
