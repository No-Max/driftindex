import { Router } from 'express';
import { castPollVote, getPollBySlug, listActivePolls } from '../lib/polls.js';
import { getSessionUserId } from '../lib/session.js';

export const pollsRouter = Router();

pollsRouter.get('/polls', async (req, res) => {
  const userId = getSessionUserId(req);
  const payload = await listActivePolls(userId);
  res.json(payload);
});

pollsRouter.get('/polls/:slug', async (req, res) => {
  const userId = getSessionUserId(req);
  const poll = await getPollBySlug(req.params.slug, userId);
  if (!poll) {
    res.status(404).json({ error: 'Poll not found' });
    return;
  }
  res.json(poll);
});

pollsRouter.post('/polls/:slug/vote', async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Sign in required' });
    return;
  }

  const optionId =
    typeof req.body?.optionId === 'string' ? req.body.optionId.trim() : '';
  if (!optionId) {
    res.status(400).json({ error: 'optionId is required' });
    return;
  }

  try {
    const poll = await castPollVote({
      slug: req.params.slug,
      optionId,
      userId,
    });
    res.json(poll);
  } catch (error) {
    const status =
      typeof error === 'object' &&
      error &&
      'status' in error &&
      typeof (error as { status: unknown }).status === 'number'
        ? (error as { status: number }).status
        : 500;
    const message = error instanceof Error ? error.message : 'Vote failed';
    res.status(status).json({ error: message });
  }
});
