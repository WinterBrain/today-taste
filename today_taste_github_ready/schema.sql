PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','operator')),
  active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  field TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '✨',
  place TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  fee INTEGER NOT NULL DEFAULT 0 CHECK(fee >= 0),
  exposed INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT '운영' CHECK(status IN ('운영','일시중지','폐쇄')),
  tagline TEXT NOT NULL DEFAULT '',
  intro TEXT NOT NULL DEFAULT '',
  host_name TEXT NOT NULL DEFAULT '',
  host_role TEXT NOT NULL DEFAULT '',
  order_json TEXT NOT NULL DEFAULT '[]',
  prep_json TEXT NOT NULL DEFAULT '[]',
  refund_policy TEXT NOT NULL DEFAULT '',
  faq_json TEXT NOT NULL DEFAULT '[]',
  cover_url TEXT NOT NULL DEFAULT '',
  gallery_json TEXT NOT NULL DEFAULT '[]',
  for_whom_json TEXT NOT NULL DEFAULT '[]',
  includes_json TEXT NOT NULL DEFAULT '[]',
  fee_note TEXT NOT NULL DEFAULT '',
  host_bio TEXT NOT NULL DEFAULT '',
  host_photo_url TEXT NOT NULL DEFAULT '',
  place_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS operator_groups (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, group_id)
);

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  place TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 2 CHECK(capacity > 0),
  fee INTEGER NOT NULL DEFAULT 0 CHECK(fee >= 0),
  cancelled INTEGER NOT NULL DEFAULT 0,
  occurred INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES groups(id),
  schedule_id INTEGER NOT NULL REFERENCES schedules(id),
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  job TEXT NOT NULL,
  mbti TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  ad_source TEXT NOT NULL DEFAULT '직접/기타',
  preferred_times TEXT NOT NULL DEFAULT '[]',
  selection_method TEXT NOT NULL DEFAULT '직접',
  motivation TEXT NOT NULL DEFAULT '',
  marketing_ok INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '접수',
  applied_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  approved_at TEXT,
  participation_token TEXT UNIQUE,
  participation_confirmed_at TEXT,
  payment_deadline TEXT,
  paid_at TEXT,
  attendance TEXT,
  review_token TEXT UNIQUE,
  purged_at TEXT,
  UNIQUE(schedule_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_app_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_app_schedule ON applications(schedule_id);
CREATE INDEX IF NOT EXISTS idx_sched_group ON schedules(group_id);

CREATE TABLE IF NOT EXISTS refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER REFERENCES applications(id),
  reason TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '대기' CHECK(status IN ('대기','처리완료')),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  processed_at TEXT
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL UNIQUE REFERENCES applications(id),
  satisfaction INTEGER NOT NULL CHECK(satisfaction BETWEEN 1 AND 5),
  revisit INTEGER NOT NULL CHECK(revisit BETWEEN 1 AND 5),
  progress INTEGER NOT NULL CHECK(progress BETWEEN 1 AND 5),
  place INTEGER NOT NULL CHECK(place BETWEEN 1 AND 5),
  value INTEGER NOT NULL CHECK(value BETWEEN 1 AND 5),
  text TEXT NOT NULL DEFAULT '',
  report INTEGER NOT NULL DEFAULT 0,
  report_text TEXT NOT NULL DEFAULT '',
  publish_ok INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER REFERENCES applications(id),
  type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'mock',
  payload TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
