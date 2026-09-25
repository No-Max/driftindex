import { createApp } from 'vue';
import App from './App.vue';
import { i18n } from './i18n';
import { initUmami } from './lib/umami';
import { router } from './router';
import './style.css';

initUmami();

createApp(App).use(i18n).use(router).mount('#app');
