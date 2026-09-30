import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { describe, it } from 'node:test';
import { verifyTelegramLogin } from './telegramAuth.js';

function sign(fields: Record<string, string | number>, botToken: string): string {
  const checkString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${String(fields[key])}`)
    .join('\n');
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  return crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
}

describe('verifyTelegramLogin', () => {
  const botToken = '123456:ABC-DEF';

  it('accepts a valid fresh payload', () => {
    const fields = {
      id: 42,
      first_name: 'Ada',
      username: 'ada',
      auth_date: Math.floor(Date.now() / 1000),
    };
    const hash = sign(fields, botToken);
    assert.equal(verifyTelegramLogin({ ...fields, hash }, botToken), true);
  });

  it('rejects tampered hash', () => {
    const fields = {
      id: 42,
      auth_date: Math.floor(Date.now() / 1000),
    };
    assert.equal(
      verifyTelegramLogin({ ...fields, hash: '0'.repeat(64) }, botToken),
      false,
    );
  });

  it('rejects expired auth_date', () => {
    const fields = {
      id: 42,
      auth_date: Math.floor(Date.now() / 1000) - 48 * 60 * 60,
    };
    const hash = sign(fields, botToken);
    assert.equal(verifyTelegramLogin({ ...fields, hash }, botToken), false);
  });
});
