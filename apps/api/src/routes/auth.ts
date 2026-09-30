import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  clearSessionCookie,
  getSessionUserId,
  setSessionCookie,
} from '../lib/session.js';
import { type TelegramLoginData, verifyTelegramLogin } from '../lib/telegramAuth.js';

export const authRouter = Router();

function publicUser(user: {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
}) {
  return {
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
  };
}

authRouter.get('/auth/config', (_req, res) => {
  res.json({
    telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME?.trim() || null,
  });
});

authRouter.get('/auth/me', async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.json({ user: null });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    clearSessionCookie(res);
    res.json({ user: null });
    return;
  }

  res.json({ user: publicUser(user) });
});

authRouter.post('/auth/telegram', async (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) {
    res.status(503).json({ error: 'Telegram auth is not configured' });
    return;
  }

  const data = req.body as TelegramLoginData;
  if (!verifyTelegramLogin(data, botToken)) {
    res.status(401).json({ error: 'Invalid Telegram login payload' });
    return;
  }

  const telegramId = String(data.id);
  const user = await prisma.user.upsert({
    where: { telegramId },
    create: {
      telegramId,
      username: data.username ?? null,
      firstName: data.first_name ?? null,
      lastName: data.last_name ?? null,
      photoUrl: data.photo_url ?? null,
    },
    update: {
      username: data.username ?? null,
      firstName: data.first_name ?? null,
      lastName: data.last_name ?? null,
      photoUrl: data.photo_url ?? null,
    },
  });

  setSessionCookie(res, user.id);
  res.json({ user: publicUser(user) });
});

authRouter.post('/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});
