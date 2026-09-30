<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TelegramLoginPayload } from '../api/auth';

const props = defineProps<{
  botUsername: string;
}>();

const emit = defineEmits<{
  auth: [payload: TelegramLoginPayload];
  error: [message: string];
}>();

const { t } = useI18n();
const host = ref<HTMLElement | null>(null);

const GLOBAL_CB = '__driftindexOnTelegramAuth';

type AuthWindow = Window &
  typeof globalThis & {
    [GLOBAL_CB]?: (user: TelegramLoginPayload) => void;
  };

function widgetDomId(bot: string) {
  return `telegram-login-${bot.replace(/[^a-z0-9_]/gi, '-')}`;
}

function cleanupWidget(bot: string) {
  document.getElementById(widgetDomId(bot))?.remove();
  host.value?.querySelectorAll('script[data-telegram-login]').forEach((el) => el.remove());
}

onMounted(() => {
  if (!host.value || !props.botUsername) return;

  // Telegram reuses a fixed iframe id per bot. After Vue remounts (locale
  // redirect), a leftover iframe keeps the dead onauth callback — remove it.
  cleanupWidget(props.botUsername);

  const authWindow = window as AuthWindow;
  authWindow[GLOBAL_CB] = (user: TelegramLoginPayload) => {
    emit('auth', user);
  };

  const script = document.createElement('script');
  script.src = 'https://telegram.org/js/telegram-widget.js?22';
  script.async = true;
  script.setAttribute('data-telegram-login', props.botUsername);
  script.setAttribute('data-size', 'large');
  script.setAttribute('data-radius', '8');
  script.setAttribute('data-request-access', 'write');
  script.setAttribute('data-userpic', 'false');
  script.setAttribute('data-onauth', `${GLOBAL_CB}(user)`);
  script.onerror = () => emit('error', t('home.fanVote.loginFailed'));
  host.value.appendChild(script);
});

onBeforeUnmount(() => {
  cleanupWidget(props.botUsername);
  const authWindow = window as AuthWindow;
  delete authWindow[GLOBAL_CB];
});
</script>

<template>
  <div ref="host" class="tg-login" />
</template>

<style scoped>
.tg-login {
  min-height: 40px;
  display: flex;
  align-items: center;
}
</style>
