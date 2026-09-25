/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MEDIA_ORIGIN?: string;
  readonly VITE_SITE_ORIGIN?: string;
  readonly VITE_UMAMI_WEBSITE_ID?: string;
  readonly VITE_UMAMI_SCRIPT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
