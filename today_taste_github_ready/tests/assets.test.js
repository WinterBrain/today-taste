'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, ROOT } = require('./helpers');

test('every seeded image path exists under public/', async () => {
  const s = await startServer();
  try {
    const db = s.open();
    const rows = db.prepare('SELECT name,cover_url,gallery_json,host_photo_url FROM groups').all();
    db.close();
    const urls = rows.flatMap(g => [g.cover_url, g.host_photo_url, ...JSON.parse(g.gallery_json)]).filter(Boolean);
    assert.ok(urls.length >= 9, 'at least 9 seeded images');
    for (const u of urls) assert.ok(fs.existsSync(path.join(ROOT, 'public', u)), 'missing ' + u);
  } finally { await s.stop(); }
});

test('seed provides rich content and public reviews', async () => {
  const s = await startServer();
  try {
    const db = s.open();
    const g = db.prepare("SELECT * FROM groups WHERE tag='향수'").get();
    assert.ok(JSON.parse(g.for_whom_json).length >= 3);
    assert.ok(JSON.parse(g.includes_json).length >= 2);
    assert.ok(g.host_bio.length > 40 && g.place_note && g.fee_note);
    assert.match(JSON.parse(g.order_json)[0], /^\d+분\|/);
    const pub = db.prepare('SELECT COUNT(*) c FROM reviews WHERE publish_ok=1').get().c;
    assert.ok(pub >= 8, 'public reviews ' + pub);
    db.close();
  } finally { await s.stop(); }
});

test('CSS uses design tokens: no raw colors/radius/z-index/font sizes, and every var() is defined', () => {
  const css = f => fs.readFileSync(path.join(ROOT, 'public', 'assets', 'css', f), 'utf8');
  const tokens = css('tokens.css');
  const defined = new Set([...tokens.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  for (const f of ['app.css', 'admin.css']) {
    const src = css(f).replace(/\/\*[\s\S]*?\*\//g, '');
    const raw = src.match(/#[0-9a-f]{3,8}\b|rgba?\(|z-index:\s*\d|border-radius:\s*\d|font-size:\s*\d/gi);
    assert.equal(raw, null, `${f} has raw values: ${raw}`);
    for (const m of src.matchAll(/var\((--[\w-]+)/g)) assert.ok(defined.has(m[1]), `${f} uses undefined ${m[1]}`);
  }
});
