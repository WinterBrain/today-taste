'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, login } = require('./helpers');
const { imageExt } = require('../lib/upload');

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 2)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(32, 3)]);

test('imageExt recognises jpg/png/webp by signature only', () => {
  assert.equal(imageExt(JPG), 'jpg');
  assert.equal(imageExt(PNG), 'png');
  assert.equal(imageExt(WEBP), 'webp');
  assert.equal(imageExt(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(imageExt(Buffer.from([0xff, 0xd8])), null);
  assert.equal(imageExt({}), null);
});

let s, admin, op;
test.before(async () => { s = await startServer(); admin = await login(s.base, 'tasteadmin', 'Taste!2026'); op = await login(s.base, 'seoyun', 'TasteOp!2026'); });
test.after(async () => { await s.stop(); });

const upload = async (body, { token, type = 'image/png' } = {}) => {
  const headers = { 'Content-Type': type };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(s.base + '/api/admin/uploads', { method: 'POST', headers, body });
  let json = {};
  try { json = await r.json(); } catch {}
  return { status: r.status, body: json };
};

test('admin uploads an image; it is saved next to the DB and served from /uploads', async () => {
  const r = await upload(PNG, { token: admin, type: 'image/jpeg' });
  assert.equal(r.status, 200);
  assert.match(r.body.url, /^\/uploads\/\d+-[0-9a-f]{16}\.png$/);
  const file = path.join(path.dirname(s.dbPath), 'uploads', path.basename(r.body.url));
  assert.ok(fs.existsSync(file));
  const got = await fetch(s.base + r.body.url);
  assert.equal(got.status, 200);
  assert.equal(got.headers.get('content-type'), 'image/png');
  assert.equal(got.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await got.arrayBuffer()), PNG);
  const db = s.open();
  assert.ok(db.prepare("SELECT 1 FROM audit_logs WHERE action='upload_image' AND entity_id=?").get(path.basename(r.body.url)));
  db.close();
});

test('upload is admin only', async () => {
  assert.equal((await upload(PNG)).status, 401);
  assert.equal((await upload(PNG, { token: op })).status, 403);
});

test('non-image and oversize uploads are rejected with a JSON error', async () => {
  let r = await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), { token: admin, type: 'image/svg+xml' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /JPG·PNG·WebP/);
  r = await upload(JSON.stringify({ a: 1 }), { token: admin, type: 'application/json' });
  assert.equal(r.status, 400);
  r = await upload(Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]), { token: admin });
  assert.equal(r.status, 413);
  assert.match(r.body.error, /5MB/);
});
