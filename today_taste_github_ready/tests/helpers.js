'use strict';
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..');
const TEST_ENV = { PAYMENT_BANK: '카카오뱅크', PAYMENT_ACCOUNT: '3333-01-2345678', PAYMENT_HOLDER: '오늘의취향' };

async function startServer({ seed = true, env = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-test-'));
  const dbPath = path.join(dir, 'test.sqlite');
  const fullEnv = { ...process.env, ...TEST_ENV, ...env, DB_PATH: dbPath };
  if (seed) execFileSync(process.execPath, ['scripts/seed-demo.js', '--reset'], { cwd: ROOT, env: fullEnv, stdio: 'pipe' });
  const port = 3900 + Math.floor(Math.random() * 900);
  const proc = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...fullEnv, PORT: String(port) }, stdio: 'pipe' });
  let stderr = '';
  proc.stderr.on('data', d => { stderr += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(base + '/api/health'); if (r.ok) break; } catch {}
    await new Promise(r => setTimeout(r, 100));
    if (i === 79) throw new Error('server did not start: ' + stderr);
  }
  return {
    base,
    dbPath,
    open: () => new Database(dbPath),
    stop: async () => {
      await new Promise(r => { proc.once('exit', r); proc.kill(); });
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    },
  };
}

async function api(base, p, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(base + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = {};
  try { json = await r.json(); } catch {}
  return { status: r.status, body: json };
}

async function login(base, username, password) {
  const r = await api(base, '/api/auth/login', { method: 'POST', body: { username, password } });
  if (r.status !== 200) throw new Error('login failed ' + JSON.stringify(r.body));
  return r.body.token;
}

module.exports = { ROOT, startServer, api, login };
