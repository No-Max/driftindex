/**
 * Loads Umami when VITE_UMAMI_WEBSITE_ID is set at build time.
 * Official script tracks SPA route changes via History API — no afterEach needed.
 * @see https://docs.umami.is/docs/guides/track-single-page-apps
 */
export function initUmami() {
  const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined;
  if (!websiteId) return;

  const scriptUrl =
    (import.meta.env.VITE_UMAMI_SCRIPT_URL as string | undefined) || '/stats/stats.js';

  if (document.querySelector(`script[data-website-id="${websiteId}"]`)) return;

  const script = document.createElement('script');
  script.defer = true;
  script.src = scriptUrl;
  script.dataset.websiteId = websiteId;
  document.head.appendChild(script);
}
