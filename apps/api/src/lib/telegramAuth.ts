import crypto from 'node:crypto';

export type TelegramLoginData = {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
};

const DEFAULT_MAX_AGE_SEC = 24 * 60 * 60;

export function verifyTelegramLogin(
  data: TelegramLoginData,
  botToken: string,
  maxAgeSec = DEFAULT_MAX_AGE_SEC,
): boolean {
  if (!botToken || !data?.hash) return false;

  const { hash, ...fields } = data;
  const checkString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${String(fields[key as keyof typeof fields] ?? '')}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const computed = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
  if (computed.length !== hash.length) return false;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash))) return false;
  } catch {
    return false;
  }

  const authDate = Number(data.auth_date);
  if (!Number.isFinite(authDate)) return false;
  const ageSec = Math.floor(Date.now() / 1000) - authDate;
  return ageSec >= 0 && ageSec <= maxAgeSec;
}
