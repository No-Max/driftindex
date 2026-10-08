import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeXml, renderSitemapXml } from './sitemap.js';

test('renderSitemapXml emits hreflang alternates and lastmod', () => {
  const xml = renderSitemapXml('https://driftindex.pro', [
    { path: '/pilots/foo', lastmod: new Date('2026-03-15T12:00:00.000Z') },
  ]);

  assert.match(xml, /<loc>https:\/\/driftindex\.pro\/en\/pilots\/foo<\/loc>/);
  assert.match(xml, /hreflang="ru" href="https:\/\/driftindex\.pro\/ru\/pilots\/foo"/);
  assert.match(xml, /<lastmod>2026-03-15<\/lastmod>/);
  assert.equal((xml.match(/<url>/g) ?? []).length, 1);
});

test('escapeXml encodes special characters', () => {
  assert.equal(escapeXml(`a&b"c'd`), 'a&amp;b&quot;c&apos;d');
});
