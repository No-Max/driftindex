import { computed, readonly, ref } from 'vue';
import {
  type AuthUser,
  type TelegramLoginPayload,
  fetchAuthMe,
  loginWithTelegram,
  logoutAuth,
} from '../api/auth';

const user = ref<AuthUser | null>(null);
const loading = ref(false);
const ready = ref(false);
let bootPromise: Promise<void> | null = null;

async function refresh() {
  loading.value = true;
  try {
    const data = await fetchAuthMe();
    user.value = data.user;
  } catch {
    user.value = null;
  } finally {
    loading.value = false;
    ready.value = true;
  }
}

export function useAuth() {
  if (!bootPromise) {
    bootPromise = refresh();
  }

  async function loginTelegram(payload: TelegramLoginPayload) {
    loading.value = true;
    try {
      const data = await loginWithTelegram(payload);
      user.value = data.user;
      return data.user;
    } finally {
      loading.value = false;
      ready.value = true;
    }
  }

  async function logout() {
    loading.value = true;
    try {
      await logoutAuth();
      user.value = null;
    } finally {
      loading.value = false;
    }
  }

  return {
    user: readonly(user),
    loading: readonly(loading),
    ready: readonly(ready),
    isAuthenticated: computed(() => user.value != null),
    refresh,
    loginTelegram,
    logout,
  };
}
