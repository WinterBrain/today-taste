'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { migrate, COLUMNS } = require('../lib/migrate');

function tmpDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-mig-'));
  return { db: new Database(path.join(dir, 'm.sqlite')), dir };
}

test('migrate creates every declared column on a fresh database', () => {
  const { db, dir } = tmpDb();
  migrate(db);
  for (const [table, cols] of Object.entries(COLUMNS)) {
    const have = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    for (const [name] of cols) assert.ok(have.includes(name), `${table}.${name}`);
  }
  db.close(); fs.rmSync(dir, { recursive: true, force: true });
});

test('migrate upgrades a legacy database and keeps rows', () => {
  const { db, dir } = tmpDb();
  db.exec(`CREATE TABLE groups (id INTEGER PRIMARY KEY AUTOINCREMENT, field TEXT NOT NULL, tag TEXT NOT NULL DEFAULT '', name TEXT NOT NULL, icon TEXT NOT NULL DEFAULT '', place TEXT NOT NULL DEFAULT '', duration TEXT NOT NULL DEFAULT '', fee INTEGER NOT NULL DEFAULT 0, exposed INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT '운영', tagline TEXT NOT NULL DEFAULT '', intro TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')));
           INSERT INTO groups(field,name) VALUES('만들기','레거시 모임');`);
  migrate(db);
  const g = db.prepare('SELECT * FROM groups').get();
  assert.equal(g.name, '레거시 모임');
  assert.equal(g.cover_url, '');
  assert.equal(g.for_whom_json, '[]');
  db.close(); fs.rmSync(dir, { recursive: true, force: true });
});
