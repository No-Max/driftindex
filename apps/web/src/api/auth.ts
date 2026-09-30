export type AuthUser = {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
};

export type TelegramLoginPayload = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function fetchAuthMe() {
  return requestJson<{ user: AuthUser | null }>('/api/auth/me');
}

export function loginWithTelegram(payload: TelegramLoginPayload) {
  return requestJson<{ user: AuthUser }>('/api/auth/telegram', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function logoutAuth() {
  return requestJson<{ ok: boolean }>('/api/auth/logout', {
    method: 'POST',
    body: '{}',
  });
}
