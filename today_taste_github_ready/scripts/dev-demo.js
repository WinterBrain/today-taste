'use strict';
// 개발·시연용 서버 실행: 임시 DB(기본 data/dev_temp.sqlite)를 필요할 때 데모 데이터로 새로 만들고 node --watch 로 서버를 켠다.
// 임시 DB를 다시 만드는 경우: DB가 없음 / scripts/seed-demo.js 가 바뀜(새 사진·후기 반영) / 마지막 시드가 오늘이 아님(데모 일정이 시드한 날 기준이라 며칠 지나면 모두 지난 일정이 됨).
// 임시 DB에서 고친 내용을 유지하려면: npm run dev:demo -- --keep
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DB = path.resolve(ROOT, process.env.DB_PATH || 'data/dev_temp.sqlite');
if (DB === path.resolve(ROOT, 'data/today_taste.sqlite')) {
  console.error('data/today_taste.sqlite 는 git 에 올라가 있어서 초기화하지 않아요. DB_PATH 를 비우거나 다른 경로로 지정해 주세요.');
  process.exit(1);
}
const SEED = path.join(__dirname, 'seed-demo.js');
const META = DB + '.seed.json';
const seedHash = crypto.createHash('sha256').update(fs.readFileSync(SEED)).digest('hex').slice(0, 16);
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
let meta = {};
try { meta = JSON.parse(fs.readFileSync(META, 'utf8')); } catch {}

const keep = process.argv.includes('--keep');
const reason = !fs.existsSync(DB) ? '임시 DB가 없어요'
  : keep ? null
  : meta.hash !== seedHash ? '데모 데이터 스크립트가 바뀌었어요'
  : meta.date !== today ? '데모 일정을 오늘 날짜 기준으로 맞춰요'
  : null;
const env = { ...process.env, DB_PATH: DB };

if (reason) {
  console.log(`[dev:demo] ${reason} → 데모 데이터로 새로 만들어요: ${path.relative(ROOT, DB)}`);
  execFileSync(process.execPath, [SEED, '--reset'], { cwd: ROOT, env, stdio: 'inherit' });
  fs.writeFileSync(META, JSON.stringify({ hash: seedHash, date: today }));
} else {
  console.log(`[dev:demo] 기존 임시 DB를 그대로 써요: ${path.relative(ROOT, DB)}`);
}

const server = spawn(process.execPath, ['--watch', 'server.js'], { cwd: ROOT, env, stdio: 'inherit' });
server.on('exit', code => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.kill(sig));
