'use strict';
const fs = require('fs');
const path = require('path');

// 기존 테이블에 추가되는 컬럼은 여기에만 선언한다. server.js 와 scripts/seed-demo.js 가 함께 사용한다.
const COLUMNS = {
  groups: [
    ['host_name', "TEXT NOT NULL DEFAULT ''"], ['host_role', "TEXT NOT NULL DEFAULT ''"],
    ['order_json', "TEXT NOT NULL DEFAULT '[]'"], ['prep_json', "TEXT NOT NULL DEFAULT '[]'"],
    ['refund_policy', "TEXT NOT NULL DEFAULT ''"], ['faq_json', "TEXT NOT NULL DEFAULT '[]'"],
    ['cover_url', "TEXT NOT NULL DEFAULT ''"], ['gallery_json', "TEXT NOT NULL DEFAULT '[]'"],
    ['for_whom_json', "TEXT NOT NULL DEFAULT '[]'"], ['includes_json', "TEXT NOT NULL DEFAULT '[]'"],
    ['fee_note', "TEXT NOT NULL DEFAULT ''"], ['host_bio', "TEXT NOT NULL DEFAULT ''"],
    ['host_photo_url', "TEXT NOT NULL DEFAULT ''"], ['place_note', "TEXT NOT NULL DEFAULT ''"],
  ],
  applications: [['motivation', "TEXT NOT NULL DEFAULT ''"], ['marketing_ok', 'INTEGER NOT NULL DEFAULT 0'], ['purged_at', 'TEXT']],
  reviews: [['publish_ok', 'INTEGER NOT NULL DEFAULT 0'], ['hidden', 'INTEGER NOT NULL DEFAULT 0']],
};

function migrate(db) {
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));
  for (const [table, cols] of Object.entries(COLUMNS)) {
    const have = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name));
    for (const [name, def] of cols) if (!have.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);
  }
}

module.exports = { migrate, COLUMNS };
