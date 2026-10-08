import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeXml, normalizeSitemapUrl, renderSitemapXml } from './sitemap.js';

test('renderSitemapXml emits locale locs and lastmod without xhtml', () => {
  const xml = renderSitemapXml('https://driftindex.pro', [
    { path: '/pilots/foo', lastmod: new Date('2026-03-15T12:00:00.000Z') },
  ]);

  assert.match(xml, /<loc>https:\/\/driftindex\.pro\/en\/pilots\/foo<\/loc>/);
  assert.match(xml, /<loc>https:\/\/driftindex\.pro\/ru\/pilots\/foo<\/loc>/);
  assert.match(xml, /<lastmod>2026-03-15<\/lastmod>/);
  assert.doesNotMatch(xml, /xhtml:link/);
  assert.equal((xml.match(/<url>/g) ?? []).length, 2);
});

test('normalizeSitemapUrl percent-encodes non-ASCII path segments', () => {
  const encoded = normalizeSitemapUrl('https://driftindex.pro/en/pilots/d1-ドリフト侍');
  assert.match(encoded, /d1-%E3%83%89/);
});

test('escapeXml encodes special characters', () => {
  assert.equal(escapeXml(`a&b"c'd`), 'a&amp;b&quot;c&apos;d');
});
